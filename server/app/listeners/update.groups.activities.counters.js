var async = require("async");
var Firebase = require("firebase");
var redis = require("redis"),
    client = redis.createClient();

var firebase = require('../firebase.connection');


var workers = async.queue(function(task, callback){
    if(task.remove)
        return removed(task.group, callback);
    added(task.group, callback);
}, 1);

firebase("groups").orderByChild('type').equalTo('activity').on("child_added", function(snapshot){
    var activity = snapshot.val();
    activity.$id = snapshot.key();
    workers.push({ group : activity});
});

firebase("groups").orderByChild('type').equalTo('activity').on("child_removed", function(snapshot){
    var activity = snapshot.val();
    activity.$id = snapshot.key();
    workers.push({ group : activity, remove : true});
});

var added = function(activity, workerDone){
    async.waterfall([
        async.apply(function preventIncrementTwice(activity, callback){
            firebase("groups_activities/" + activity.parent + "/" + activity.$id).once("value", function(value){
                if(value.exists())
                    return callback("cancel");
                return callback(null, activity);
            });
        }, activity)
        ,

        function cache(activity, callback){
            client.sadd(["groups_activities" + activity.parent, activity.id], function(error){
                callback(null, activity);
            });
        },

        function createGroupActivity(activity, callback){
            var commands = {};
            commands["groups_activities/" + activity.parent + "/" + activity.$id] = {enable : true};
            callback(null, activity, commands);
        },

        function updateParent(activity, commands, callback){
            firebase("groups/" + activity.parent).once("value", function(parent){
                if(parent.exists()){
                    var type = parent.child('type').val();
                    client.scard("groups_activities"+activity.parent, function(err, count){
                        count = count || 0;

                        commands["groups/" + activity.parent + "/totalActivities"] = count;
                        callback(null, activity, commands, type, count);
                    });
                } else {
                    callback(null, activity, commands, null, count);
                }
            });
        },
        function updateSuggestions(activity, commands, type, count, callback){
            firebase("suggestions/groups/" + activity.language + "/" + activity.parent).once("value", function(snapshot){
                if(snapshot.exists()){
                    commands["suggestions/groups/" + activity.language + "/" + activity.parent + "/totalActivities"] = count;
                }
                callback(null, activity, commands, type, count);
            });
        },
        function propagateToParticipants(activity, commands, type, count, callback){
            if(type){
                client.smembers("groups_participants" + activity.parent, function(err, members){
                    members.forEach(function (value) {
                        commands["users/" + value + "/groups/" + type + "/" + activity.parent + "/totalActivities"] = count;
                    });
                    callback(null, commands);
                });
            } else {
                callback(null, commands);
            }
        }
    ], function(err, commands){
        if(err)
            return workerDone();
        firebase().update( commands, workerDone);
    });

};

var removed = function(activity, workerDone){
    async.waterfall([
        async.apply(function init(activity, callback){
            var commands = {};

            firebase("groups_activities/" + activity.parent + "/" + activity.$id).once("value", function(value){
                if(value.exists())
                    commands["groups_activities/" + activity.parent + "/" + activity.$id] = null;
                callback(null, activity, commands);
            });
        }, activity),

        function cache(activity, commands, callback){
            client.srem(["groups_activities" + activity.parent, activity.id], function(error){
                callback(null, activity, commands);
            });
        },

        function updateParent(activity, commands, callback){
            firebase("groups/" + activity.parent).once("value", function(parent){
                if(parent.exists()){
                    client.scard("groups_activities"+activity.parent, function(err, count){
                        count = count || 0;

                        commands["groups/" + activity.parent + "/totalActivities"] = count;

                        callback(null, activity, commands, count, parent.val());
                    });
                } else {
                    callback(null, activity, commands);
                }
            });
        },
        function updateSuggestions(activity, commands, count, parent, callback){
            if(parent){
                firebase("suggestions/groups/" + parent.language + "/" + parent.id).once("value", function(snapshot){
                    if(snapshot.exists()){
                        commands["suggestions/groups/" + parent.language + "/" + parent.id + "/totalActivities"] = count;
                    }
                    callback(null, activity, commands, count, parent);
                });
                return;
            }
            callback(null, activity, commands, count);
        },

        function propagateToParticipants(activity, commands, count, parent, callback){
            if(parent){
                client.smembers("groups_participants" + activity.parent, function(err, members){
                    members.forEach(function (value) {
                        commands["users/" + value + "/groups/" + parent.type + "/" + activity.parent + "/totalActivities"] = count;
                    });
                    callback(null, commands);
                });
            } else {
                callback(null, commands);
            }
        }
    ], function(err, commands){
        if(err)
            return workerDone();
        firebase().update( commands, workerDone);
    });

};