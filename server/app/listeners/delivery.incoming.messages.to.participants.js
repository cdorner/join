var events = require('events');
var util = require('util');
var debug = require("debug");
    log = debug("message-delivery:log");
    error = debug("message-delivery:error");

var redis = require("redis"),
    client = redis.createClient();

var firebase = require("../firebase.connection");

/*
    When a new message is send it's stored on groups_conversation/$groupId, then this actor will get the members of the group and
    delivery to then as /users/$userId/chats/unread_messages/$groupId, to be consumed by the client
 */
function MessageDelivery(){
    events.call(this);
};

util.inherits(MessageDelivery, events);

const messageDelivery = new MessageDelivery();

firebase("groups_conversation").on("child_added", function(snapshot){

    firebase("groups_messages_delivery/" + snapshot.key()).once("value", function(snapshot){
        if(snapshot.exists()){
            firebase("groups_conversation/" + snapshot.key()).orderByKey().startAt(snapshot.val()).on("child_added", function(snapshot){
                if(this.ignore != snapshot.key()){
                    var message = snapshot.val();
                    message.id = snapshot.key();
                    messageDelivery.emit("newMessage", { groupId : this.groupId }, message);
                }
            }, {groupId : snapshot.key(), ignore : snapshot.val()});
        } else {
            firebase("groups_conversation/" + snapshot.key()).on("child_added", function(snapshot){
                var message = snapshot.val();
                message.id = snapshot.key();
                messageDelivery.emit("newMessage", { groupId : this.groupId }, message);
            }, {groupId : snapshot.key()});
        }
    }, {groupId : snapshot.key()});

});

messageDelivery.on("newMessage", function deliveryMessage(context, message){
    // keep bringing all members for now
    client.smembers("groups_participants" + context.groupId, function(err, members){
        if(err){
            return messageDelivery.emit("error", err);
        }

        var commands = {};
        members.forEach(function (value) {
            if(value && context.groupId && message.id && message)
                commands["/users/" + value + "/chats/" + context.groupId + "/unread_messages/" + message.id] = message;
        });
        commands["/groups_messages_delivery/" + context.groupId] = message.id;
        firebase().update(commands, function(error){
            log("groups_conversation/%s/%s complete %s", context.groupId, message.id, JSON.stringify(error || {done : 'ok'}));
        });
    });
});

messageDelivery.on('error', function(err){
    error(err);
});