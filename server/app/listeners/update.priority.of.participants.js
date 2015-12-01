var async = require("async");
var redis = require("redis"),
    client = redis.createClient();

var firebase = require('../firebase.connection');

/*
    Update the priority of a participant on a group, the priority is used to define if the participant will be playing or be sent
    to bench until an opening on the fireteam occurs.
 */

var workers = async.queue(function(task, callback){
    updateRoster(task.groupId, task.value, task.removed, callback);
}, 1);

var workersPriorityChange = async.queue(function(task, callback){
    if(task.direction == "down")
        priorityChangeDown(task.groupId, task.value, callback);
    else {
        priorityChangeUp(task.groupId, task.value, callback);
    }
}, 1);


firebase("groups").on("child_added", function(snapshot){
    if(snapshot.exists() && snapshot.child('type').val() != 'activity') return;

    firebase("groups_participants/" + snapshot.key()).on("child_added", function(value){
        workers.push({ groupId : this.groupId, value : value });
    }, {groupId : snapshot.key()});

    firebase("groups_participants/" + snapshot.key()).on("child_removed", function(value){
        workers.push({ groupId : this.groupId, value : value, removed : "removed" });
    }, {groupId : snapshot.key()});

    firebase("notifications/groups_participants/priority/change", snapshot.key()).on("child_added", function(value){
        workersPriorityChange.push({ groupId : this.groupId, value : value, direction : value.val().newPriority > value.val().oldPriority ? "down" : "up" });
    }, {groupId : snapshot.key()});
});

var updateRoster = function(groupId, player, removed, callback){
    if(!removed && player.getPriority()) return callback();
    client.hgetall("group" + groupId, function(error, group){
        firebase("groups_participants/" + groupId).orderByPriority().once("value", function(value){
            var priority = 0;
            var command = {};

            value.forEach(function(p){
                if(p.key() != player.key()){
                    command["groups_participants/" + groupId + "/" + p.key() + "/.priority" ] = ++priority;
                }
            });
            if(removed){
                if(player.getPriority() <= group.players){
                    value.forEach(function(p){
                        if(p.getPriority() == (parseInt(group.players) + 1)){
                            command["notifications/groups_participants/roster/priority/changed/" + groupId + "/" + p.key() ] = { groupId : groupId, userId : p.key() };
                        }
                    });
                }
            } else {
                command["groups_participants/" + groupId + "/" + player.key() + "/.priority" ] = ++priority;
            }

            firebase().update(command, function(){
                callback();
            });
        });
    });
};

var priorityChangeDown = function(groupId, playerChanged, callback){
    client.hmget("group" + groupId, function(error, group){
        firebase("groups_participants/" + groupId).orderByPriority().startAt(playerChanged.val().oldPriority).once("value", function(value){
            var priority = playerChanged.val().oldPriority;
            var command = {};

            command["groups_participants/" + groupId + "/" + playerChanged.key() + "/.priority" ] = playerChanged.val().newPriority;

            value.forEach(function(player){
                if(player.key() != playerChanged.key()){
                    if(priority == playerChanged.val().newPriority){
                        priority++;
                    }
                    command["groups_participants/" + groupId + "/" + player.key() + "/.priority" ] = priority++;
                }
            });
            command["notifications/groups_participants/priority/change/" + groupId + "/" + playerChanged.key()] = null;

            firebase().update(command, function(){
                callback();
            });
        });
    });
};

var priorityChangeUp = function(groupId, playerChanged, callback){
    client.hmget("group" + groupId, function(error, group){
        firebase("groups_participants/" + groupId).orderByPriority().startAt(playerChanged.val().newPriority).once("value", function(value){
            var priority = playerChanged.val().newPriority;
            var command = {};

            command["groups_participants/" + groupId + "/" + playerChanged.key() + "/.priority" ] = playerChanged.val().newPriority;

            value.forEach(function(player){
                if(player.key() != playerChanged.key()){
                    command["groups_participants/" + groupId + "/" + player.key() + "/.priority" ] = ++priority;
                }
            });

            command["notifications/groups_participants/priority/change/" + groupId + "/" + playerChanged.key()] = null;
            firebase().update(command, function(){
                callback();
            });
        });
    });
};