var moment = require("moment");
var util = require("util");
var redis = require("redis"),
    client = redis.createClient();

var firebase = require('../firebase.connection');
var log = require("../simple.log")();

/*
    Occurs when a participant leaves the group, 'do not mistake with ban'.
 */
firebase("notifications/groups_participants/removed").on("child_added", function(snapshot){
    var value = snapshot.val();

    var chat = {
        chat : {value : "@" + value.nickname + " saiu."},
        sender : {id : value.id, nickname : "join"},
        timestamp : moment.utc(value.timestamp).toISOString()
    };

    var chatPushed = firebase("groups_conversation/" + value.groupId).push();

    var commands = {};
    commands["/groups_conversation/" + value.groupId + "/" + chatPushed.key()] = chat;
    commands["/notifications/groups_participants/removed/" + snapshot.key()] = null;

    firebase().update(commands, function(error){
        var cacheKey = util.format("groups%s-platforms-*", value.groupId);
        client.keys(cacheKey, function(error, keys){
            if(error) return;
            for (var i = 0; i < keys.length; i++) {
                client.srem([keys[i], value.id], log.ifError);
            }
        })
    });
});