var moment = require("moment");
var util = require("util");
var async = require("async");
var redis = require("redis"),
    client = redis.createClient();

var firebase = require('../firebase.connection');
var log = require("../simple.log")();

/*
    Add an user to a group.
 */
firebase("notifications/groups_participants/add").on("child_added", function(snapshot){
    var value = snapshot.val();
    value.key = snapshot.key();

    firebase("groups/" + value.groupId).once("value", function(snapshot){
        var group = snapshot.val();
        group.platforms = group.platforms.map(function(p){
            p.allow = true;
            return p;
        });
        group.silent = false;

        var commands = {};
        var chat = { chat : {value : "@" + this.nickname + " entrou."},  sender : {id : this.id, nickname : "join"},  timestamp : moment.utc(this.timestamp).toISOString() };
        var chatPushed = firebase("groups_conversation/" + value.groupId).push();

        commands["/groups_conversation/" + this.groupId + "/" + chatPushed.key()] = chat;
        commands["/groups_participants/" + this.groupId + "/" + this.id] = { id : this.id, nickname : this.nickname, photo : this.photo, status : this.status};
        commands["/users/" + this.id + "/groups/" + this.type + "/"+ this.groupId] = group;
        commands["/notifications/groups_participants/add/" + this.key] = null;

        async.waterfall([
            async.apply(function update(commands, cmd, platforms, callback){
                firebase().update(commands, function(error){
                    callback(error, cmd, platforms);
                });
            }, commands, this, group.platforms),
            function updateCache(cmd, platforms, callback){
                for (var i = 0; i < platforms.length; i++) {
                    var p = platforms[i];
                    var cacheKey = util.format("groups%s-platforms-%s-%s", cmd.groupId, p.name, p.version);
                    client.sadd([cacheKey, cmd.id], log.ifError);
                }
                callback(null, cmd);
            }
        ], function(error, cmd){
            var message = "notifications/groups_participants/add/%s/%s complete %s";
            console.log(util.format(message, cmd.groupId, cmd.id, JSON.stringify(error || {done : 'ok'})));
        })

    }, value);
});