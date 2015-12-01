var moment = require("moment");
var util = require("util");
var async = require("async");
var redis = require("redis"),
    client = redis.createClient();

var Firebase = require('firebase');
var firebase = require('../firebase.connection');

firebase("commands/propagate_to_users/activity_change").on("child_added", function(snapshot){
    var cmd = snapshot.val();

    async.waterfall([
        async.apply(function findMembers(cmd, callback){
            client.smembers("groups_participants"+cmd.activity.id, function(error, members){
                callback(error, cmd, members);
            });
        }, cmd),
        function propagate(cmd, members, callback){
            var commands = {};
            for (var i = 0; i < members.length; i++) {
                commands["users/" + members[i] + "/groups/activity/" + cmd.activity.id + "/activity"] = cmd.activity.activity.name || cmd.activity.activity;
                commands["users/" + members[i] + "/groups/activity/" + cmd.activity.id + "/level"] = cmd.activity.level.name || cmd.activity.level;
                commands["users/" + members[i] + "/groups/activity/" + cmd.activity.id + "/players"] = cmd.activity.players;
                commands["users/" + members[i] + "/groups/activity/" + cmd.activity.id + "/timestamp"] = cmd.activity.newTimestamp;
                commands["users/" + members[i] + "/groups/activity/" + cmd.activity.id + "/platforms"] = cmd.activity.platforms;
            }
            callback(null, cmd, commands);
        },
        function notifyMembersByChat(cmd, commands, callback){
            var chat = firebase("groups_conversation", cmd.activity.id).push();
            var message = util.format("Pessoal, alterei a atividade agora ela é uma %s level %s e vai ocorrer em $timestamp no %s %s",
                cmd.activity.activity.name || cmd.activity.activity, cmd.activity.level.name || cmd.activity.level,
                cmd.activity.platforms[0].name, cmd.activity.platforms[0].version
            );

            commands["groups_conversation/" + cmd.activity.id + "/" + chat.key()] = {
                chat : {value : message, notification : true, data : {timestamp : cmd.activity.newTimestamp}},
                sender : {id : cmd.activity.owner, nickname : cmd.nickname},
                timestamp : Firebase.ServerValue.TIMESTAMP
            };
            callback(null, cmd, commands);
        },
        function update(cmd, commands, callback){
            firebase().update(commands, function(error){
                callback(null, cmd.activity);
            });
        }
    ], function(error, activity){
        firebase("commands/propagate_to_users/activity_change/" + activity.id).remove();
        client.hmset("group" + activity.id, activity);
    });
});