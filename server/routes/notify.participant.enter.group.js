var Firebase = require("firebase");
var firebaseUrl = require('./join.firebase');
var moment = require("moment");

var ref = new Firebase(firebaseUrl + "/notifications/groups_participants/added").on("child_added", function(snapshot){

    var value = snapshot.val();

    var chat = {
        chat : {value : "@" + value.nickname + " entrou."},
        sender : {id : value.userId, nickname : value.nickname},
        timestamp : moment.utc(value.timestamp).toISOString()
    };

    var chatPushed = new Firebase(firebaseUrl + "/groups_conversation/" + value.groupId).push();

    var commands = {};
    commands["/groups_conversation/" + value.groupId + "/" + chatPushed.key()] = chat;
    commands["/notifications/groups_participants/added/" + snapshot.key()] = null;

    // TODO insert proper log
    new Firebase(firebaseUrl).update(commands);
});

var ref = new Firebase(firebaseUrl + "/notifications/groups_participants/removed").on("child_added", function(snapshot){

    var value = snapshot.val();

    var chat = {
        chat : {value : "@" + value.nickname + " saiu."},
        sender : {id : value.userId, nickname : value.nickname},
        timestamp : moment.utc(value.timestamp).toISOString()
    };

    var chatPushed = new Firebase(firebaseUrl + "/groups_conversation/" + value.groupId).push();

    var commands = {};
    commands["/groups_conversation/" + value.groupId + "/" + chatPushed.key()] = chat;
    commands["/notifications/groups_participants/removed/" + snapshot.key()] = null;

    // TODO insert proper log
    new Firebase(firebaseUrl).update(commands);
});

var ref = new Firebase(firebaseUrl + "/notifications/groups_participants/confirmed").on("child_added", function(snapshot){

    var value = snapshot.val();

    var chat = {
        chat : {value : "@" + value.nickname + " confirmou presença."},
        sender : {id : value.userId, nickname : value.nickname},
        timestamp : moment.utc(value.timestamp).toISOString()
    };

    var chatPushed = new Firebase(firebaseUrl + "/groups_conversation/" + value.groupId).push();

    var commands = {};
    commands["/groups_conversation/" + value.groupId + "/" + chatPushed.key()] = chat;
    commands["/notifications/groups_participants/confirmed/" + snapshot.key()] = null;

    // TODO insert proper log
    new Firebase(firebaseUrl).update(commands);
});



module.exports = ref;