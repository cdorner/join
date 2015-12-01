var events = require('events');
var util = require('util');
var async = require("async");
var redis = require("redis"),
    client = redis.createClient();

var debug = require("debug");
    log = debug("flush-deleted-group:log");
    error = debug("flush-deleted-group:error");

var firebase = require('../firebase.connection');

function Flusher(){
    events.call(this);
};

util.inherits(Flusher, events);

const flush = new Flusher();

flush.on("flushGroupsUnusedInfo", function(group){
    var commands = {};
    commands["/groups_conversation/" + group.id] = null;
    commands["/groups_messages_delivery/" + group.id] = null;
    commands["/groups_messages_unread/" + group.id] = null;

    firebase().update(commands, function(err){
        if(err) return flush.emit("error", err);
        firebase("groups_participants/" + group.id).off("value");
        firebase("groups_participants/" + group.id).off("child_added");
        firebase("groups_participants/" + group.id).off("child_removed");
    });
});

flush.on('error', function(err){
    error(err);
});

firebase("groups").on("child_removed", function(snapshot){
    var group = snapshot.val();
    flush.emit("flushGroupsUnusedInfo", group);
});