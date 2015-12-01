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
        var payload = null;
        if(!data.data){
            payload = JSON.stringify({
                "registration_ids" : devices,
                "data" : data
            });
        } else {
            payload = JSON.stringify(data);
        }

        var req = https.request(androidOptions, function(res) {
            res.setEncoding('utf8');
            res.on('data', function(e) {
                console.log(new Date() + " Google GCM Response: " + res.statusCode + " Body: " + e);
            });
        });
        req.on('error', function(e) {
            console.log(new Date() + ":" + e);
        });

        req.write(payload);
        req.end();
    }
};


module.exports = push;