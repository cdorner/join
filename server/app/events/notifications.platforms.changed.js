var moment = require("moment");
var util = require("util");
var async = require("async");
var redis = require("redis"),
    client = redis.createClient();

var firebase = require('../firebase.connection');
var log = require("../simple.log")();


/*
    Trigger when user change is platform preference
 */
var tree = "notifications/platforms/change/";
firebase(tree).on("child_added", function(snapshot){
    var cmd = snapshot.val();
    cmd.key = snapshot.key();

    var cacheKey = util.format("groups%s-platforms-%s-%s", cmd.groupId, cmd.name, cmd.version);
    if(cmd.allow){
        client.sadd([cacheKey, cmd.id], function(){
            firebase(tree + cmd.key).remove();
        });
    } else {
        client.srem([cacheKey, cmd.id], function(){
            firebase(tree + cmd.key).remove();
        });
    }
});