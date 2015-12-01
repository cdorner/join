var Firebase = require("firebase");
var firebaseUrl = require('./join.firebase');

var async = require("async");


new Firebase(firebaseUrl + "/groups/activity").on("child_added", function(snapshot){
    update(snapshot);
});

new Firebase(firebaseUrl + "/groups/activity").on("child_removed", function(snapshot){
    update(snapshot, "removed");
});

new Firebase(firebaseUrl + "/groups/private").on("child_removed", function(snapshot){
    update(snapshot, "removed");
});

var update = function(snapshot, removed){
    var activity = snapshot.val();
    activity.id = snapshot.key();
    activity.removed = removed;

    async.waterfall([
        function preventIncrementTwice(callback){
            if(activity.removed) {
                return callback(null, activity);
            }
            new Firebase(firebaseUrl + "/groups_activities/" + activity.parent + "/" + snapshot.key()).once("value", function(value){
                if(value.exists())
                    return callback("cancel");
                return callback(null, activity);
            });
        },

        function createGroupActivity(activity, callback){
            new Firebase(firebaseUrl + "/groups_activities/" + activity.parent + "/" + activity.id).set({enable : true}, function(){
                callback(null, activity);
            });
        },

        function updateParent(activity, callback){
            var groups = new Firebase(firebaseUrl + "/groups");
            var public = groups.child("public/"+ activity.parent);
            var private = groups.child("private/"+ activity.parent);

            public.once("value", function(snapshot){
                if(snapshot.exists()){
                    if(this.removed)
                        remove(this, "public");
                    else
                        incrementActivities(snapshot, this);
                }
            }, activity);

            private.once("value", function(snapshot){
                if(snapshot.exists()){
                    if(this.removed)
                        remove(this, "private");
                    else
                        incrementActivities(snapshot, this);
                }
            }, activity);
        }
    ], function(err, result){

    });

};

var incrementActivities = function(snapshot){
    var totalActivities = new Firebase(snapshot.ref().toString() + "/totalActivities");
    totalActivities.transaction(function(currentActivities) {
        return (currentActivities || 0) + 1;
    });
};

var decrementActivities = function(ref){
    var totalActivities = new Firebase(ref + "/totalActivities");
    totalActivities.transaction(function(currentActivities) {
        if(currentActivities == 0) return currentActivities;
        return (currentActivities || 0) - 1;
    });
};

var remove = function(removed, parentType){
    var commands = {};
    commands["/groups_conversation/" + removed.id] = null;
    commands["/groups_messages_delivery/" + removed.id] = null;
    commands["/groups_messages_unread/" + removed.id] = null;
    if(removed.parent)
        commands["/groups_activities/" + removed.parent + "/" + removed.id] = null;
    new Firebase(firebaseUrl).update( commands );
    decrementActivities(firebaseUrl + "/groups/" + parentType + "/" + removed.parent);
};