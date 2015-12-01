var async = require('async');
var util = require('util');
var Firebase = require("firebase");
var redis = require("redis"),
    client = redis.createClient();

var firebase = require('../firebase.connection');
var push = require('../push');

/*
    Send a push notification when user has unread messages.
    He sets the first message of each user has notified when pushed occurs so on next execution if the user not consume the message the notification will not be sent again.
    Runs every 20s on instantly when prior execution takes longer than that.
 */

var doForever = function(){
    async.forever(
        function(next) {

        },
        function(err) {
            console.error(err);
            doForever();
        }
    );
};

var notifyUnreadMessages = function(url, message){
    var matcher = url.match(/groups_messages_unread\/(-.*)\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/);
    if(matcher && matcher.length == 3){
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
        if(user && user.deviceRegistrationId && user.deviceRegistrationId != "undefined"){
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
        }

    });


};

doForever();