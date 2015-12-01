var Firebase = require("firebase");
var firebaseUrl = require('./join.firebase');
var async = require("async");
var moment = require("moment");
var https = require("https");
var apn = require('apn');
var util = require('util');

var i18n = {
    "invite" : {
        "pt-br" : {  title : "Join %s", message : "Convite: %s %s %s"},
        "en" : { title : "Join %s", message : "Invite %s %s %s"}
    },

    "new-activity" : {
        "pt-br" : {  title : "Join %s", message : "Nova atividade: %s %s %s"},
        "en" : { title : "Join %s", message : "New activity %s %s %s"}
    },

    "confirmation" : {
        "pt-br" : {  title : "Join %s", message : "Confirmação: %s %s %s"},
        "en" : { title : "Join %s", message : "Confirmation: %s %s %s"}
    }
};

var androidOptions = {
    host: 'android.googleapis.com',
    path: '/gcm/send',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': 'key=AIzaSyCY4IMIJY0WFseqPrLtqHmCqK5m21VguO8'
    }
};

var iosOptions = {cert : "../cert.pem", key : "../key.pem", "production" : false, "batchFeedback": true};
var apnConnection = new apn.Connection(iosOptions);
apnConnection.on("connected", function() {
    console.log("Connected");
});

apnConnection.on("transmitted", function(notification, device) {
    console.log("Notification transmitted to:" + device.token.toString("hex"));
});

apnConnection.on("transmissionError", function(errCode, notification, device) {
    console.error("Notification caused error: " + errCode + " for device ", device, notification);
    if (errCode === 8) {
        console.log("A error code of 8 indicates that the device token is invalid. This could be for a number of reasons - are you using the correct environment? i.e. Production vs. Sandbox");
    }
});

apnConnection.on("timeout", function () {
    console.log("Connection Timeout");
});

apnConnection.on("disconnected", function() {
    console.log("Disconnected from APNS");
});

apnConnection.on("socketError", console.error);

new Firebase(firebaseUrl + "/groups/activity").orderByChild('registrationTimestamp').startAt(new Date().getTime()).on('child_added', function(snapshot) {
    var group = snapshot.val();
    group.$id = snapshot.key();

    new Firebase(firebaseUrl + "/groups_participants/" + group.parent).once("value", function(snapshot) {
        var users = [];
        snapshot.forEach(function(item){
            if(item.val().id != group.owner)
                users.push(item.val().id);
        });

        async.map(users, function(user, callback){
            // Get registrationId for users
            new Firebase(firebaseUrl + "/users/" + user + "/device").once("value", function(s){
                if(s.exists())
                    return callback(null, s.val());
                return callback(null);
            });
        }, function(error, registrations){
            // Remove undefined users
            async.filter(registrations, function(item, callback){
                callback(item != undefined)
            }, function(registrations){
                // Send push notification
                if(registrations.length > 0){
                    var devices = {  };

                    // PT-BR or EN
                    for (var i = 0; i < registrations.length; i++) {
                        var timezone = registrations[i].utcOffset || 0;
                        var language = registrations[i].language || "en";
                        if(language != "pt-br" && language != "en") language = "en";

                        if(!devices[timezone]) devices[timezone] = {};
                        if(!devices[timezone][language]) devices[timezone][language] = [];
                        devices[timezone][language].push(registrations[i]);
                    }


                    for(var timezone in devices){
                        for(var language in devices[timezone]) {

                            var ios = devices[timezone][language].filter(function (r) {
                                return r.platform == "iOS";
                            });
                            var android = devices[timezone][language].filter(function (r) {
                                return r.platform == "Android";
                            });

                            var androidRegistrations = android.map(function (r) {
                                return r.registrationId;
                            });
                            var iosRegistrations = ios.map(function (r) {
                                return r.registrationId;
                            });

                            var title = util.format(i18n["new-activity"][language].title, group.name);
                            var message = util.format(i18n["new-activity"][language].message, group.activity, group.level, moment.utc(group.timestamp).utcOffset(parseInt(timezone)).locale(language).format("lll"));

                            if (iosRegistrations.length > 0) {
                                var note = new apn.Notification();

                                note.expiry = Math.floor(Date.now() / 1000) + 3600; // Expires 1 hour from now.
                                //note.badge = 1;
                                note.sound = "ping.aiff";
                                note.alert = message,
                                    note.category = "invite";
                                note.payload = {
                                    "invite": "true", "groupId": group.$id, type: "activity"
                                };
                                apnConnection.pushNotification(note, iosRegistrations);
                            }


                            if (androidRegistrations.length > 0) {
                                var data = JSON.stringify({
                                    registration_ids: androidRegistrations,
                                    data: {
                                        "title": title,
                                        "message": message,
                                        "image": group.photo,
                                        "notId": parseInt(group.registrationTimestamp / 1000) + 1000,
                                        "invite": "true", "groupId": group.$id, type: "activity",
                                        "actions": [
                                            {"icon": "ionic", "title": "Aceitar", "callback": "inviteAccept"},
                                            {"icon": "snooze", "title": "Recusar", "callback": "inviteRefused"}
                                        ]
                                    }
                                });
                                var req = https.request(androidOptions, function (res) {
                                    console.log("Google APN sended");
                                });
                                req.write(data);
                                req.end();
                            }
                        }
                    }
                }
            });
        });
    }, null, group);
});

new Firebase(firebaseUrl + "/notifications/confirmations/requests").on("child_added", function(snapshot){
    var groupId = snapshot.key();

    new Firebase(firebaseUrl + "/groups/activity/" + groupId).once("value", function(groupSnapshot){
        if(!groupSnapshot.exists()) {
            return new Firebase(firebaseUrl + "/notifications/confirmations/requests/" + groupId).remove();
        }
        var group = groupSnapshot.val();
        group.$id = groupSnapshot.key();

        var users = [];
        snapshot.forEach(function(item){
            users.push(item.key());
        });
        async.map(users, function(user, callback){
            // Get registrationId for users
            new Firebase(firebaseUrl + "/users/" + user + "/device").once("value", function(s){
                if(s.exists())
                    return callback(null, s.val());
                return callback(null);
            });
        }, function(error, registrations){
            // Remove undefined users
            async.filter(registrations, function(item, callback){
                callback(item != undefined)
            }, function(registrations){
                // Send push notification
                if(registrations.length > 0){

                    var devices = {  };

                    for (var i = 0; i < registrations.length; i++) {
                        var timezone = registrations[i].utcOffset || 0;
                        var language = registrations[i].language || "en";
                        if(language != "pt-br" && language != "en") language = "en";

                        if(!devices[timezone]) devices[timezone] = {};
                        if(!devices[timezone][language]) devices[timezone][language] = [];
                        devices[timezone][language].push(registrations[i]);
                    }


                    for(var timezone in devices){
                        for(var language in devices[timezone]){

                            var ios = devices[timezone][language].filter(function(r){ return r.platform == "iOS";});
                            var android = devices[timezone][language].filter(function(r){ return r.platform == "Android"; });

                            var androidRegistrations = android.map(function(r){ return r.registrationId; });
                            var iosRegistrations = ios.map(function(r){ return r.registrationId; });

                            var title = util.format(i18n.confirmation[language].title, group.name);
                            var message = util.format(i18n.confirmation[language].message, group.activity, group.level, moment.utc(group.timestamp).utcOffset(parseInt(timezone)).locale(language).format("lll") );

                            if(iosRegistrations.length > 0){
                                var note = new apn.Notification();

                                note.expiry = Math.floor(Date.now() / 1000) + 3600; // Expires 1 hour from now.
                                note.badge = 1;
                                note.sound = "ping.aiff";
                                note.alert= message;
                                note.category = "confirmation";
                                note.payload = {
                                    "invite" : "true", "groupId" : group.$id, type : "activity"
                                };
                                apnConnection.pushNotification(note, iosRegistrations);
                            }


                            if(androidRegistrations.length > 0){
                                var data = JSON.stringify({
                                    registration_ids : androidRegistrations,
                                    // TODO Resolve timezone problem
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
                                });
                                var req = https.request(androidOptions, function(res) {
                                    console.log("Google APN sended");
                                });
                                req.write(data);
                                req.end();
                            }

                        }
                    }
                }
                return new Firebase(firebaseUrl + "/notifications/confirmations/requests/" + group.$id).remove();
            });
        });
    });
});

new Firebase(firebaseUrl + "/notifications/groups/invites").on("child_added", function(snapshot){
    var groupId = snapshot.key();

    new Firebase(firebaseUrl + "/groups/activity/" + groupId).once("value", function(groupSnapshot){
        if(!groupSnapshot.exists()) {
            return new Firebase(firebaseUrl + "/notifications/groups/invites/" + groupId).remove();
        }
        var group = groupSnapshot.val();
        group.$id = groupSnapshot.key();

        var users = [];
        snapshot.forEach(function(item){
            users.push(item.key());
        });
        async.map(users, function(user, callback){
            // Get registrationId for users
            new Firebase(firebaseUrl + "/users/" + user + "/device").once("value", function(s){
                if(s.exists())
                    return callback(null, s.val());
                return callback(null);
            });
        }, function(error, registrations){
            // Remove undefined users
            async.filter(registrations, function(item, callback){
                callback(item != undefined)
            }, function(registrations){
                // Send push notification
                if(registrations.length > 0){

                    var devices = {  };

                    for (var i = 0; i < registrations.length; i++) {
                        var timezone = registrations[i].utcOffset || 0;
                        var language = registrations[i].language || "en";
                        if(language != "pt-br" && language != "en") language = "en";

                        if(!devices[timezone]) devices[timezone] = {};
                        if(!devices[timezone][language]) devices[timezone][language] = [];
                        devices[timezone][language].push(registrations[i]);
                    }


                    for(var timezone in devices) {
                        for (var language in devices[timezone]) {

                            var ios = devices[timezone][language].filter(function (r) {
                                return r.platform == "iOS";
                            });
                            var android = devices[timezone][language].filter(function (r) {
                                return r.platform == "Android";
                            });

                            var androidRegistrations = android.map(function (r) {
                                return r.registrationId;
                            });
                            var iosRegistrations = ios.map(function (r) {
                                return r.registrationId;
                            });

                            var title = util.format(i18n.invite[language].title, group.name);
                            var message = util.format(i18n.invite[language].message, group.activity, group.level, moment.utc(group.timestamp).utcOffset(parseInt(timezone)).locale(language).format("lll"));

                            if (iosRegistrations.length > 0) {
                                var note = new apn.Notification();

                                note.expiry = Math.floor(Date.now() / 1000) + 3600; // Expires 1 hour from now.
                                note.badge = 1;
                                note.sound = "ping.aiff";
                                note.alert = message;
                                note.category = "invite";
                                note.payload = {
                                    "invite": "true", "groupId": group.$id, type: "activity"
                                };
                                apnConnection.pushNotification(note, iosRegistrations);
                            }


                            if (androidRegistrations.length > 0) {
                                var data = JSON.stringify({
                                    registration_ids: androidRegistrations,
                                    // TODO Resolve timezone problem
                                    data: {
                                        "title": title,
                                        "message": message,
                                        "image": group.photo,
                                        "notId": parseInt(group.registrationTimestamp / 1000) + 1000,
                                        "invite": "true", "groupId": group.$id, type: "activity",
                                        "actions": [
                                            {"icon": "ionic", "title": "Aceitar", "callback": "inviteAccept"},
                                            {"icon": "snooze", "title": "Recusar", "callback": "inviteRefused"}
                                        ]
                                    }
                                });
                                var req = https.request(androidOptions, function (res) {
                                    console.log("Google APN sended");
                                });
                                req.write(data);
                                req.end();
                            }
                        }
                    }
                }
                return new Firebase(firebaseUrl + "/notifications/groups/invites/" + group.$id).remove();
            });
        });
    });
});