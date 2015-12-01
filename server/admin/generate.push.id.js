var async = require("async");
var moment = require("moment");
var util = require('util');
var Firebase = require('firebase');
var redis = require("redis"),
    client = redis.createClient();

var prompt = require('prompt');

prompt.start();

var schema = {
    properties: {
        Firebase: {
            type: 'string',
            required: false,
            default : 'https://jointhegame1.firebaseio.com/'
        },
        FirebaseKey: {
            hidden: false,
            default : 'X76Q4gjNQ2gGvk0djcBbaEi4fDOsUkYjsbiMbZlT'
        },
        "Tree" : {
            required: true
        }

    }
};

prompt.get(schema, function (err, result) {
    if (err) { return onErr(err); }

    process.env.FIREBASE = result.Firebase;
    process.env.SECRET = result.FirebaseKey;

    var firebase = require("../app/firebase.connection");

    console.log(result.FirebaseKey);
    firebase().auth(result.FirebaseKey, function(error, data){
        if(error){
            return console.error("Couldn't log into firebase: " + JSON.stringify(error));
            process.exit(0);
        }

        console.log("Starting application..");

        var ref = firebase(result.Tree);
        var key = ref.push().key();
        ref.child(key).set({timestamp : Firebase.ServerValue.TIMESTAMP}, function(){
            console.log("Your generated key is " + key);
            process.exit(0);
        });

    });
});


function onErr(err) {
    console.log(err);
    return 1;
}