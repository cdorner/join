var Firebase = require("firebase");
var firebaseUrl = require('./join.firebase');
var async = require('async');

var redis = require("redis"),
    client = redis.createClient();

new Firebase(firebaseUrl + "/groups_conversation").on("child_added", function(snapshot){
    new Firebase(firebaseUrl + "/groups_messages_delivery/" + snapshot.key()).once("value", function(snapshot){
        if(snapshot.exists()){
            new Firebase(firebaseUrl + "/groups_conversation/" + snapshot.key()).orderByKey().startAt(snapshot.val()).on("child_added", function(snapshot){
                if(this.ignore != snapshot.key())
                    deliveryMessage(snapshot, this);
            }, {group : snapshot.key(), ignore : snapshot.val()});
        } else {
            new Firebase(firebaseUrl + "/groups_conversation/" + snapshot.key()).on("child_added", function(snapshot){
                deliveryMessage(snapshot, this);
            }, {group : snapshot.key()});
        }
    }, {group : snapshot.key()});

});

var deliveryMessage = function(snapshot, context){
    context.message = snapshot.val();
    context.messageId = snapshot.key();

    async.each([context], function(context, callback){
        client.smembers("groups_participants" + context.group, function(err, participants){
            var commands = {};
            participants.forEach(function(value){
                commands["/groups_messages_unread/" + context.group + "/" + value + "/" + context.messageId] = context.message;
            });
            commands["/groups_messages_delivery/" + context.group] = context.messageId;
            new Firebase(firebaseUrl).update(commands, callback);
        });
    }, function(){

    });
};