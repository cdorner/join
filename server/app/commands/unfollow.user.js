var util = require("util");
var async = require("async");
var redis = require("redis"),
    client = redis.createClient();

var firebase = require('../firebase.connection');
var log = require("../simple.log")();


firebase("commands/users/unfollow").on("child_added", function(snapshot){
    var cmd = snapshot.val();
    firebase("users_followers/" + cmd.unfollow + "/" + cmd.id).remove(function(error){
        if(!error){
            firebase("commands/users/unfollow/"+ cmd.id).remove();
        }
    });
});