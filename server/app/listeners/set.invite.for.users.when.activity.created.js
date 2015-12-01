var async = require("async");
var moment = require("moment");
var https = require("https");
var apn = require('apn');
var util = require('util');
var redis = require("redis"),
    client = redis.createClient();

var firebase = require("../firebase.connection");
var i18n = require('../i18n');
var push = require('../push');
var log = require('../simple.log')();


/*
    Set invite for each user that listening to specific platform for with activity was created.
 */

client.get("last_activity_invited", function(error, id){
    firebase("groups").orderByKey().startAt(id || "").on('child_added', function(snapshot) {
        if(id != snapshot.key())
            setInvite(snapshot);
    });
});
var setInvite = function(snapshot){
    client.set("last_activity_invited", snapshot.key());

    var group = snapshot.val();
    if("activity" == group.type){
        async.map([group], function(group, callback){
            // check size to create limits
            client.smembers(util.format("groups%s-platforms-%s-%s", group.parent, group.platforms[0].name, group.platforms[0].version), function(error, users){
                var commands = {};
                for (var i = 0; i < users.length; i++) {
                    if(users[i] != group.owner)
                        commands["users/" + users[i] + "/groups/invite/" + group.id] = {id: group.id, type : group.type};
                }
                callback(null, commands);
            });
        }, function(error, commands){
            firebase().update(commands[0], log.ifError);
        })
    }
};