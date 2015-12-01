var https = require("https");
var apn = require('apn');

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

var push = {};

push.gcm = function(){

};

push.push = function(data, registrationId, platform){
    if(platform == "iOS"){
        var note = new apn.Notification();

        note.expiry = Math.floor(Date.now() / 1000) + 3600; // Expires 1 hour from now.
        note.badge = data.badge || 1;
        note.sound = data.sound || "ping.aiff";
        note.alert= data.message;
        if(data.category)
            note.category = data.category;
        if(data.payload)
            note.payload = data.payload;
        apnConnection.pushNotification(note, registrationId);
    } else if (platform == "Android"){
        var devices = registrationId;
        if (!Array.isArray(registrationId)) {
            devices = [registrationId];
        }
        var payload = JSON.stringify({
            registration_ids : devices,
            data : {
                "title": data.title,
                "message": data.message,
                "image" : data.image,
                "notId": data.notId,
                "invite" : data.invite,
                "groupId" : data.groupId,
                "type" : data.type
            }
        });

        var req = https.request(androidOptions, function(res) {
            if(res.statusCode == 200)
                console.log("Google APN Ok");
            if(res.statusCode != 200)
                console.log("Google APN status: " + res.statusCode);
        });
        req.on('error', function(e) {
            console.error(e);
        });
        req.write(payload);
        req.end();
    }
};


module.exports = push;