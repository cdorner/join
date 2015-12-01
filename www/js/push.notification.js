function onDeviceReady() {
    var push = PushNotification.init({
        "android": {"senderID": "109578584395", "forceShow" : "true", "icon": "icon"},
        "ios": {
            "alert": "true", "badge": "true", "sound": "true", "clearBadge" : "true",
            "categories" : {
                "invite" : {
                    "yes" : {"callback" : "inviteAccept", "title" : "Aceitar", "foreground" : true, "destructive": false},
                    "no" : {"callback" : "inviteRefused", "title" : "Recusar", "foreground" : true, "destructive": false}
                },
                "confirmation" : {
                    "yes" : {"callback" : "confirmParticipation", "title" : "Confirmar", "foreground" : true, "destructive": false},
                    "no" : {"callback" : "dropParticipation", "title" : "Desistir", "foreground" : true, "destructive": false}
                }
            }
        },
        "windows": {} } );

    push.on('registration', function(data) {
        console.log("PushNotification, registration: " +data.registrationId);
        window.localStorage.setItem("registrationId", data.registrationId);
    });

    push.on('notification', function(data) {
        console.log("PushNotification, receive new notification: " + JSON.stringify(data));

        if(data.additionalData.groupId){
            window.localStorage.setItem("chat", JSON.stringify({ groupId : data.additionalData.groupId, type : data.additionalData.type, command : "open" }));
        }
        // data.message,
        // data.title,
        // data.count,
        // data.sound,
        // data.image,
        // data.additionalData
        finish();
    });

    push.on('error', function(e) {
        console.log("PushNotification error " + e);
    });

    var clearBadgeNumber = function(){
        push.setApplicationIconBadgeNumber(function() {
            console.log('success');
        }, function() {
            console.log('error');
        }, 0);
    };

    var finish = function(){
        push.finish(function() {
            clearBadgeNumber();
        });
    };

    // accept or not a invite
    window.inviteAccept = function(data) {
        if(data.additionalData.groupId){
            window.localStorage.setItem("invite", JSON.stringify({ groupId : data.additionalData.groupId, type : data.additionalData.type, command : "accept" }));
        }
        finish();
    };

    window.inviteRefused = function(data) {
        if(data.additionalData.groupId){
            window.localStorage.setItem("invite", JSON.stringify({ groupId : data.additionalData.groupId, type : data.additionalData.type, command : "ignore" }));
        }
        finish();
    };

// confirm or drop a participation
    window.confirmParticipation = function(data) {
        if(data.additionalData.groupId){
            window.localStorage.setItem("invite", JSON.stringify({ groupId : data.additionalData.groupId, type : data.additionalData.type, command : "confirmation" }));
        }
        finish();
    };

    window.dropParticipation = function(data) {
        if(data.additionalData.groupId){
            window.localStorage.setItem("invite", JSON.stringify({ groupId : data.additionalData.groupId, type : data.additionalData.type, command : "drop" }));
        }
        finish();
    };
};



document.addEventListener("deviceready", onDeviceReady, false);