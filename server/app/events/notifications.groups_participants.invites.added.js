var async = require("async");
var moment = require("moment");
var util = require('util');
var redis = require("redis"),
    client = redis.createClient();

var firebase = require("../firebase.connection");
var i18n = require('../i18n');
var push = require('../push');

/*
    Invite a user to participate of an activity, updates firebase with invite and send push notification.
 */

firebase("notifications/groups_participants/invites").on("child_added", function(snapshot){
    async.waterfall([
        async.apply(
            function buildGroup(groupId, callback){
                client.hgetall("group" + groupId, function(error, group){
                    callback(null, group, snapshot);
                });
            }, snapshot.key())
        ,

        function transformUsers(group, snapshot, callback){
            var users = [];
            snapshot.forEach(function(item){
                users.push(item.key());
            });
            async.map(users, function(user, callback){
                client.hgetall("users-" + user, function(error, values){
                    if(values){
                        return callback(null, values);
                    }
                });
            }, function(error, users){
                callback(null, group, users);
            });
        },

        function insertInviteAndRemoveBan(group, users, callback){
            var commands = {};
            users.forEach(function(user){
                commands["groups/" + group.id + "/banned/" + user.id] = null;
                // To much bugs, counter became unstable, when try join messages popup because already on group... think better..
                //commands["groups_participants/" + group.id + "/" + user.id] = { id : user.id, nickname : user.nickname, photo : user.photo, status : 'invited' };
                commands["users/" + user.id + "/groups/invite/" + group.id] = group;
            });
            firebase().update(commands, function(){
                callback(null, group, users);
            });
        },

        function separateTimezoneAndLanguage(group, users, callback){
            var devices = {  };

            for (var i = 0; i < users.length; i++) {
                var timezone = users[i].utcOffset || 0;
                var language = users[i].language || "en";
                if(language != "pt-br" && language != "en") language = "en";

                if(!devices[timezone]) devices[timezone] = {};
                if(!devices[timezone][language]) devices[timezone][language] = [];
                devices[timezone][language].push(users[i]);
            }

            callback(null, group, devices);
        },

        function send(group, devices, callback){
            for(var timezone in devices){
                for(var language in devices[timezone]){

                    var ios = devices[timezone][language].filter(function(r){ return r.devicePlatform == "iOS";});
                    var android = devices[timezone][language].filter(function(r){ return r.devicePlatform == "Android"; });

                    var androidRegistrations = android.map(function(r){ return r.deviceRegistrationId; });
                    var iosRegistrations = ios.map(function(r){ return r.deviceRegistrationId; });

                    var title = util.format(i18n.invite[language].title, group.name);
                    var message = group.type == "activity" ? util.format(i18n.invite[language].message, group.activity, group.level, moment.utc(group.timestamp).utcOffset(parseInt(timezone)).locale(language).format("lll"))
                        : util.format(i18n.invite[language].message, group.name, "", "");

                    if (iosRegistrations.length > 0) {
                        var data = {
                            "title": title,
                            "message": message,
                            "image": group.photo,
                            "category" : "invite",
                            "payload" : {
                                "invite": "true", "groupId": group.id, type: group.type
                            }
                        };

                        push.push(data, iosRegistrations, "iOS");
                    }

                    if (androidRegistrations.length > 0) {
                        var data = {
                            registration_ids: androidRegistrations,
                            data: {
                                "title": title,
                                "message": message,
                                "image": group.photo,
                                "notId": parseInt(group.registrationTimestamp / 1000) + 1000,
                                "invite": "true", "groupId": group.id, type: group.type,
                                "actions": [
                                    {"icon": "ionic", "title": i18n.accept[language].value, "callback": "inviteAccept"},
                                    {"icon": "snooze", "title": i18n.refuse[language].value, "callback": "inviteRefused"}
                                ]
                            }
                        };
                        push.push(data, androidRegistrations, "Android");
                    }
                }
            }
            callback(null, group);
        },
        function deleteConfirmation(group, callback){
            firebase("notifications/groups_participants/invites/" + group.id).remove(callback);
        }
    ], function(error, results){
        if(error)
            console.log(error);
    });
});