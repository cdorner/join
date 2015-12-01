var async = require("async");
var moment = require("moment");
var util = require('util');
var redis = require("redis"),
    client = redis.createClient();

var firebase = require("../firebase.connection");
var i18n = require('../i18n');
var push = require('../push');


/*
    Send a push notification to user, asking a confirmation if he will do the activity or not.
 */

firebase("notifications/confirmations/requests").on("child_added", function(snapshot){
    async.waterfall([
        async.apply(
            function buildGroup(groupId, callback){
                client.hgetall("group" + groupId, function(error, group){
                    group.$id = snapshot.key();
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
        function updateNotificationStatus(group, users, callback) {
            var commands = {};
            users.forEach(function(user){
                commands["groups_participants/" + group.$id + "/" + user.id + "/status"] = "requested";
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

                    var title = util.format(i18n.confirmation[language].title, group.name);
                    var message = util.format(i18n.confirmation[language].message, group.activity, group.level, moment.utc(group.timestamp).utcOffset(parseInt(timezone)).locale(language).format("lll") );

                    if(iosRegistrations.length > 0){
                        var payload = {
                            "title" : title,
                            "message" : message,
                            "image" : group.photo,
                            "notId" : parseInt(group.registrationTimestamp / 2000),
                            "invite" : "true",
                            "groupId" : group.$id,
                            "type" : group.type,
                            "category" : "confirmation",
                            "payload" : {
                                "invite" : "true", "groupId" : group.$id, type : "activity"
                            }
                        };
                        push.push(payload, iosRegistrations, 'iOS');
                    }

                    if(androidRegistrations.length > 0){
                        var payload = {
                            registration_ids : androidRegistrations,
                            data : {
                                "title": title,
                                "message": message,
                                "image" : group.photo,
                                "notId": parseInt(group.registrationTimestamp / 1000) + 1000,
                                "invite" : "true", "groupId" : group.$id, type : "activity",
                                "actions": [
                                    { "icon": "ionic", "title": "Confirmar", "callback": "confirmParticipation"},
                                    { "icon": "snooze", "title": "Desistir", "callback": "dropParticipation"}
                                ]
                            }
                        };
                        push.push(payload, androidRegistrations, 'Android');
                    }
                }
            }
            callback(null, group);
        },
        function deleteConfirmation(group, callback){
            firebase("/notifications/confirmations/requests/" + group.$id).remove(callback);
        }
    ], function(error, results){

    });
});