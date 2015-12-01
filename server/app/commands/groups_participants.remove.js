var util = require("util");
var redis = require("redis"),
    client = redis.createClient();

var firebase = require('../firebase.connection');
var log = require("../simple.log")();


/*
    Remove the user from groups_participants and caches
 */
firebase("commands/groups_participants/remove").on("child_added", function(snapshot){
    var value = snapshot.val();

    var commands = {};
    commands["groups_participants/" + value.groupId + "/" + value.id] = null;
    commands["commands/groups_participants/remove/" + value.id] = null;

    firebase().update(commands, function(){
        client.srem(["groups_participants" + value.groupId, value.id]);

        var cacheKey = util.format("groups%s-platforms-*", value.groupId);
        client.keys(cacheKey, function(error, keys){
            if(error) return;
            for (var i = 0; i < keys.length; i++) {
                client.srem([keys[i], value.id], log.ifError);
            }
        })
    });
});