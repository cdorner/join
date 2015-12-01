var Firebase = require("firebase");

var firebaseUrl = process.env.FIREBASE;
if(!firebaseUrl.endsWith("/")){
    firebaseUrl = firebaseUrl.concat("/");
}

function firebase(){
    var path = firebaseUrl + "app/";
    if(arguments){
        for (var i = 0; i < arguments.length; i++) {
            path += arguments[i];
            if(i + 1 != arguments.length)
                path += "/";
        };
    }
    //Firebase.enableLogging(true);
    return new Firebase(path);
};

module.exports = firebase;
