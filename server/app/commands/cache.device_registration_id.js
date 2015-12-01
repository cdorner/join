var util = require("util");
var async = require("async");
var redis = require("redis"),
    client = redis.createClient();

var firebase = require('../firebase.connection');
var log = require("../simple.log")();


firebase("commands/update_device_registration_cache/user").on("child_added", function(snapshot){
    var cmd = snapshot.val();
    client.hmset("users-" + cmd.id, "deviceRegistrationId", cmd.registrationId, function (err, res) {
        firebase("commands/update_device_registration_cache/user/"+ cmd.id).remove();
    });
});