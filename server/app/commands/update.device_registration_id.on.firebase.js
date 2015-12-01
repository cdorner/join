var util = require("util");
var async = require("async");
var redis = require("redis"),
    client = redis.createClient();

var firebase = require('../firebase.connection');
var log = require("../simple.log")();


firebase("commands/update_device_registration/user").on("child_added", function(snapshot){
    var userId = snapshot.key();
    firebase("users/" + userId + "/info/device/registrationId").set(snapshot.val().registrationId, function(error){
        if(!error){
            firebase("commands/update_device_registration/user/"+ userId).remove();
        }
    });
});