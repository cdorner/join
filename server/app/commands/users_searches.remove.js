var util = require("util");
var async = require("async");
var redis = require("redis"),
    client = redis.createClient();

var firebase = require('../firebase.connection');
var log = require("../simple.log")();


firebase("commands/users_searches/remove").on("child_added", function(snapshot){
    var userId = snapshot.key();
    firebase("users_searches/" + userId).remove(function(error){
        if(error) return log.ifError(error);
        firebase("commands/users_searches/remove/" + userId).remove();
    });
});