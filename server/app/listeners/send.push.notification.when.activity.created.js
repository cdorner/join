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
    Send push notification to users when some activity for a group that they follow is created, considering platforms that they choose.
 */
client.get("last_activity_pushed", function(error, id){
    firebase("groups").orderByKey().startAt(id || "").on('child_added', function(snapshot) {
        if(id != snapshot.key())
            processPush(snapshot);
    });
});

var processPush = function(snapshot){
    async.waterfall([
        async.apply(
            function cache(snapshot, callback){
                client.set("last_activity_pushed", snapshot.key(), function(error){
                    if(snapshot.val().type != 'activity')
                        return callback("Only activity send push notification here", snapshot);
                    callback(null, snapshot);
                });
            }, snapshot)
        ,

        function buildGroup(snapshot, callback){
            var group = snapshot.val();
            group.$id = snapshot.key();
            callback(null, group);
        },

        function buildUserByPlatform(group, callback){
            client.smembers(util.format("groups%s-platforms-%s-%s", group.parent, group.platforms[0].name, group.platforms[0].version), function(error, users){
                users.splice(users.indexOf(group.owner), 1);
                async.map(users, function(user, callback){
                    client.hgetall("users-" + user, function(error, user){
                        if(user){
                            return callback(null, user);
                        }
                    });
                }, function(error, users){
                    callback(null, group, users);
                });
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

                    var title = util.format(i18n["new-activity"][language].title, group.name);
                    var message = util.format(i18n["new-activity"][language].message, group.activity, group.level, moment.utc(group.timestamp).utcOffset(parseInt(timezone)).locale(language).format("lll"));

                    if (iosRegistrations.length > 0) {
                        var data = {
                            "title": title,
                            "message": message,
                            "image": group.photo,
                            "category" : "invite",
                            "payload" : {
                                "invite": "true", "groupId": group.$id, type: "activity"
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
                                "invite": "true", "groupId": group.$id, type: "activity",
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
    ], function(error, result){

    });
};