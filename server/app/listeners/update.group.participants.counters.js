var events = require('events');
var util = require('util');
var async = require("async");
var redis = require("redis"),
    client = redis.createClient();

var debug = require("debug");
    log = debug("member-counter:log");
    error = debug("member-counter:error");

var firebase = require('../firebase.connection');


/*
    Update the total participants and with attributes of a group when participants enters or leaves the group.
 */
function MemberCounter(){
    events.call(this);
};

util.inherits(MemberCounter, events);

const listener = new MemberCounter();

listener.on("addMemberToGroupCache", function(group, member){
    var cacheKey = "groups_participants" + group.id;
    client.sadd([cacheKey, member.id], function(err){
        if(err) return listener.emit("error", err);

        var with_ = group.with || "";
        if(with_.indexOf(member.nickname) == -1) {
            with_ = with_.trim() + " @"+member.nickname;
        }
        group.with = with_;

        firebase("groups_participants/" + group.id + "/" + member.id + "/version").set(1, function(){
            listener.emit("increaseMemberCount", group);
            log("Member %s added succefuly.", member.id);
        });
    });
});

listener.on("increaseMemberCount", function(group){
    client.scard("groups_participants"+group.id, function(err, count){
        count = count || 0;
        group.totalParticipants = count;
        var command = {};
        command["groups/" + group.id + "/totalParticipants"] = group.totalParticipants;
        command["groups/" + group.id + "/with"] = group.with;
        firebase().update(command, function(err){
            if(err) return listener.emit("error", err);
            var cacheKey = "group" + group.id;
            client.hmset(cacheKey, ["totalParticipants", group.totalParticipants, "with" , group.with], function(){
                log("Group %s member counter updated to %d", group.id, group.totalParticipants);
                listener.emit("propagateGroupMembers", group);
            });
        });
    });
});

listener.on("propagateGroupMembers", function(group){
    client.smembers("groups_participants" + group.id, function(err, members){
        var command = {};
        members.forEach(function (value) {
            command["users/" + value + "/groups/" + group.type + "/" + group.id + "/totalParticipants"] = group.totalParticipants;
            command["users/" + value + "/groups/" + group.type + "/" + group.id + "/with"] = group.with;
        });
        firebase().update(command, function(err){
            if(err) return listener.emit("error", err);
            log("Group %s changes propagate to %d members ", group.id, members.length);
            listener.emit("propagateGroupSuggestion", group);
        });
    });
});

listener.on("propagateGroupSuggestion", function(group){
    if(group.type == 'public'){
        firebase("suggestions/groups/" + group.language + "/" + group.id).once("value", function(snapshot){
            if(snapshot.exists()){
                var command = {};
                command["suggestions/groups/" + group.language + "/" + group.id + "/totalParticipants"] = group.totalParticipants;
                command["suggestions/groups/" + group.language + "/" + group.id + "/with"] = group.with;
                firebase().update(command, function(err){
                    if(err) return listener.emit("error", err);
                    log("Group %s changes propagate to suggestions", group.id);
                });
            }
        });
    }
});

listener.on("removeMemberFromGroupCache", function(group, member){
    var cacheKey = "groups_participants" + group.id;
    client.srem([cacheKey, member.id], function(err){
        if(err) return listener.emit("error", err);

        var with_ = group.with || "";
        if(with_.indexOf(member.nickname) != -1){
            with_ = with_.replace("@"+member.nickname, "");
        }
        group.with = with_;

        listener.emit("decreaseMemberCount", group);
        log("Member %s out succefuly.", member.id);
    });
});

listener.on("decreaseMemberCount", function(group){
    client.scard("groups_participants"+group.id, function(err, count){
        count = count || 0;
        group.totalParticipants = count;
        var command = {};
        if(group.totalParticipants == 0 && group.type != 'public') {
            command["groups/" + group.id] = null;
        } else {
            command["groups/" + group.id + "/totalParticipants"] = group.totalParticipants;
            command["groups/" + group.id + "/with"] = group.with;
        }
        firebase().update(command, function(err){
            if(err) return listener.emit("error", err);
            var cacheKey = "group" + group.id;
            client.hmset(cacheKey, ["totalParticipants", group.totalParticipants, "with" , group.with], function(){
                log("Group %s member counter updated to %d", group.id, group.totalParticipants);
                listener.emit("propagateGroupMembers", group);
            });
        });
    });
});


listener.on("memberIn", function(group, member){
    listener.emit("addMemberToGroupCache", group, member);
});


listener.on("memberOut", function(group, member){
    listener.emit("removeMemberFromGroupCache", group, member);
});

listener.on('error', function(err){
    error(err);
});


firebase("groups_participants").on("child_added", function(snapshot){

    firebase("groups_participants/" + snapshot.key()).on("child_added", function(value){
        if(!value.val().version || value.val().version <= 0){
            client.hgetall("group"+this.groupId, function(error, group){
                if(!group) return;
                listener.emit("memberIn", group, value.val());
            });
        }
    }, {groupId : snapshot.key()});


    firebase("groups_participants/" + snapshot.key()).on("child_removed", function(value){
        client.hgetall("group"+this.groupId, function(error, group){
            if(!group) return;
            listener.emit("memberOut", group, value.val());
        });
    }, {groupId : snapshot.key()});
});