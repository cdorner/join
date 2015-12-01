var Firebase = require("firebase");
var firebaseUrl = require('./join.firebase');
var async = require('async');
var util = require('util');

var push = require('./push');

var redis = require("redis"),
    client = redis.createClient();

var doForever = function(){
    async.forever(
        function(next) {

            // TODO Fix race conditions
            new Firebase(firebaseUrl + "/groups_messages_unread").once("value", function(snapshot){
                snapshot.forEach(function(group){

                    new Firebase(firebaseUrl + "/groups_messages_unread/" + group.key()).once("value", function(snapshot){
                        snapshot.forEach(function(user){

                            new Firebase(user.ref().toString()).limitToFirst(1).once("child_added", function(snapshot){
                                if(snapshot.exists() && !snapshot.val().notified){

                                    new Firebase(this.user).limitToFirst(5).once("value", function(snapshot){
                                        var message = "";
                                        snapshot.forEach(function(value){
                                            if(value.val().chat){
                                                message += util.format("@%s %s \n", value.val().sender.nickname, value.val().chat.value);
                                            }
                                            new Firebase(value.ref().toString()).update({ notified : true });
                                        });
                                        notifyUnreadMessages(this.user, message);
                                    }, { user : this.user });

                                }
                            }, { user : user.ref().toString() });

                        });
                    });

                });
            });
            // TODO Remove timeout and put async
            setTimeout(function(){
                next();
            }, 60000);

        },
        function(err) {
            console.error(err);
            doForever();
        }
    );
};

var notifyUnreadMessages = function(url, message){
    var matcher = url.match(/groups_messages_unread\/(-.*)\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/);
    if(matcher.length == 3){
        var groupId = matcher[1];
        var userId = matcher[2];

        client.hgetall("group" + groupId, function(error, group){
            group.$id = groupId;
            sendMessage(group, userId, message)
        });
    }
};

var sendMessage = function(group, userId, message){

    client.hgetall("users-" + userId, function(error, user){
        var payload = {
            "title" : "Join " + group.name,
            "message" : message,
            "image" : group.photo,
            "notId" : parseInt(group.registrationTimestamp / 1000),
            "invite" : "false",
            "groupId" : group.$id,
            "type" : group.type
        };

        push.push(payload, user.deviceRegistrationId, user.devicePlatform);
    });
};

doForever();