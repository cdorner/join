var util = require("util");
var async = require("async");
var redis = require("redis"),
    client = redis.createClient();

var firebase = require('../firebase.connection');
var log = require("../simple.log")();


firebase("commands/cache/user/remove").on("child_added", function(snapshot){
    var userId = snapshot.key();

    client.del("users-" + userId, function(error){
        if(error) return log.ifError(error);
        firebase("commands/cache/user/remove/" + userId).remove();
    });
});