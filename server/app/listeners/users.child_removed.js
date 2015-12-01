var Firebase = require('firebase');
var firebase = require('../firebase.connection');
var util = require("util");
var redis = require("redis"),
    client = redis.createClient();

var log = require("../simple.log")();

/*
    Create a tree used for search a user by his nickname
 */
firebase("users").on("child_removed", function(snapshot){
    var user = snapshot.val();
    if(user){
        var commands = {};
        commands["commands/users_searches/remove/"+snapshot.key()] = { id : snapshot.key()};
        commands["commands/cache/user/remove/"+snapshot.key()] = { id : snapshot.key()};
        if(user.groups){
            for(var type in user.groups){
                for(var groupId in user.groups[type]){
                    commands["commands/groups_participants/remove/" + snapshot.key()] = {id : snapshot.key(), nickname : user.info ? user.info.nickname : "", timestamp : Firebase.ServerValue.TIMESTAMP, groupId : groupId};
                }
            }
        }
        firebase().update(commands);
    }
});