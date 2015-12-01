function onDeviceReady() {
    setInterval(function(){
        init();
    }, 60000 * 60);

    init();
    function init(){
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

        var onRegistration = function(data){
            console.log("PushNotification, registration: " +data.registrationId);
            var lastRegistrationId = window.localStorage.getItem("registrationId");
            if(data.registrationId != lastRegistrationId){
                window.localStorage.setItem("registrationId", data.registrationId);
                window.localStorage.setItem("update-registrationId", data.registrationId);
            }
        };

        push.off('registration', onRegistration);
        push.on('registration', onRegistration);

        var onNotification = function(data){
            console.log("PushNotification, receive new notification: " + JSON.stringify(data));

            if(data.additionalData.groupId){
                window.localStorage.setItem("chat", JSON.stringify({ groupId : data.additionalData.groupId, type : data.additionalData.type, command : "open" }));
            }
            finish();
        };

        push.off('notification', onNotification);
        push.on('notification', onNotification);

        var onError = function(e){
            console.log("PushNotification error " + e);
        }

        push.off('error', onError);
        push.on('error', onError);

        var clearBadgeNumber = function(){
            if("iOS" == device.platform){
                push.setApplicationIconBadgeNumber(function() {
                    console.log('success');
                }, function() {
                    console.log('error');
                }, 0);
            }
        };

        var finish = function(){
            push.finish(function() {
                clearBadgeNumber();
            });
        };

        window.finishProcessMessage = finish;
    }


    window.inviteAccept = function(data) {
        if(data.additionalData.groupId){
            window.localStorage.setItem("invite", JSON.stringify({ groupId : data.additionalData.groupId, type : data.additionalData.type, command : "accept" }));
        }
        window.finishProcessMessage();
    };

    window.inviteRefused = function(data) {
        if(data.additionalData.groupId){
            window.localStorage.setItem("invite", JSON.stringify({ groupId : data.additionalData.groupId, type : data.additionalData.type, command : "ignore" }));
        }
        window.finishProcessMessage();
    };

    window.confirmParticipation = function(data) {
        if(data.additionalData.groupId){
            window.localStorage.setItem("invite", JSON.stringify({ groupId : data.additionalData.groupId, type : data.additionalData.type, command : "confirmation" }));
        }
        window.finishProcessMessage();
    };

    window.dropParticipation = function(data) {
        if(data.additionalData.groupId){
            window.localStorage.setItem("invite", JSON.stringify({ groupId : data.additionalData.groupId, type : data.additionalData.type, command : "drop" }));
        }
        window.finishProcessMessage();
    };
};



document.addEventListener("deviceready", onDeviceReady, false);