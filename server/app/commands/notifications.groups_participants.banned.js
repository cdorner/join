var moment = require("moment");
var util = require("util");

var firebase = require('../firebase.connection');

/*
    Ban a user from a group, he will not be allowed to enter until a invite be sent to him.
 */
firebase("notifications/groups_participants/banned").on("child_added", function(snapshot){
    var value = snapshot.val();

    var chat = {
        chat : {value : "@" + value.nickname + " foi removido do grupo."},
        sender : {id : value.id, nickname : "join"},
        kick : { id : value.id},
        timestamp : moment.utc(value.timestamp).toISOString()
    };

    var chatPushed = firebase("groups_conversation/" + value.groupId).push();

    var commands = {};

    commands["/users" + "/" + value.id + "/groups/" + value.type + "/" + value.groupId] = null;
    commands["/users" + "/" + value.id + "/groups/" + "invite/" + value.groupId] = null;
    commands["/groups_participants/" + value.groupId + "/" +  value.id] = null;
    commands["/groups_conversation/" + value.groupId + "/" + chatPushed.key()] = chat;
    commands["/users" + "/" + value.id + "/chats/" + value.groupId + "/unread_messages/" + chatPushed.key()] = chat;
    commands["/notifications/groups_participants/banned/" + snapshot.key()] = null;

    firebase().update(commands, function(error){
        var message = "notifications/groups_participants/banned/%s/%s complete %s";
        console.log(util.format(message, value.groupId, value.id, JSON.stringify(error || {done : 'ok'})));
    });
});