var Firebase = require("firebase");
var firebaseUrl = require('./join.firebase');

var redis = require("redis"),
    client = redis.createClient();


new Firebase(firebaseUrl + "/groups/activity").on("child_added", function(snapshot){
    client.hmset("group" + snapshot.key(), snapshot.val());
});

new Firebase(firebaseUrl + "/groups/public").on("child_added", function(snapshot){
    client.hmset("group" + snapshot.key(), snapshot.val());
});

new Firebase(firebaseUrl + "/groups/private").on("child_added", function(snapshot){
    client.hmset("group" + snapshot.key(), snapshot.val());
});

new Firebase(firebaseUrl + "/users/").on("child_added", function(snapshot){
    var user = snapshot.val();
    if(!user.device) user.device = {};
    client.hmset("users-" + snapshot.key(), {id : snapshot.key(), nickname : user.nickname,
        deviceRegistrationId : user.device.registrationId, devicePlatform : user.device.platform});
});

new Firebase(firebaseUrl + "/users/").on("child_changed", function(snapshot){
    var user = snapshot.val();
    if(!user.device) user.device = {};
    client.hmset("users-" + snapshot.key(), {id : snapshot.key(), nickname : user.nickname,
        deviceRegistrationId : user.device.registrationId, devicePlatform : user.device.platform});
});