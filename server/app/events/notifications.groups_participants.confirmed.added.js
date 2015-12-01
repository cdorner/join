var moment = require("moment");
var util = require("util");

var firebase = require("../firebase.connection");

/*
    Ocurrs when user confirm a participation on an activity, just send a message to chat informing that he will be playing.
 */
firebase("notifications/groups_participants/confirmed").on("child_added", function(snapshot){
    var value = snapshot.val();

    var chat = {
        chat : {value : "@" + value.nickname + " confirmou presença."},
        sender : {id : value.id, nickname : 'Join'},
        timestamp : moment.utc(value.timestamp).toISOString()
    };

    var chatPushed = firebase("groups_conversation/" + value.groupId).push();

    var commands = {};
    commands["/groups_conversation/" + value.groupId + "/" + chatPushed.key()] = chat;
    commands["/notifications/groups_participants/confirmed/" + snapshot.key()] = null;

    firebase().update(commands, function(error){
        var message = "notifications/groups_participants/confirmed/%s/%s complete %s";
        console.log(util.format(message, value.groupId, value.id, JSON.stringify(error || {done : 'ok'})));
    });
});