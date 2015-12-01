var util = require("util");
var async = require("async");
var redis = require("redis"),
    client = redis.createClient();

var firebase = require('../firebase.connection');
var log = require("../simple.log")();

/*
    Update caches of groups and users
 */

firebase("groups").on("child_added", function(snapshot){
    var group = snapshot.val();
    delete group.activities;
    delete group.levels;
    delete group.platforms;

    client.hmset("group" + group.id, group);
});


firebase("groups").on("child_removed", function(snapshot){
    client.del("group" + snapshot.key());
    var platforms = snapshot.val().platforms;
    if(platforms)
        platforms.forEach(function(p){
            var cacheKey = util.format("groups%s-platforms-%s-%s", snapshot.key(), p.name, p.version);
            client.del(cacheKey);
        });
});

