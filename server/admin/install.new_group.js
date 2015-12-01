var async = require("async");
var moment = require("moment");
var util = require('util');
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
        console.log("All set, inform group data.");

        prompt.get(['Subject', 'Name', 'Description', 'Language'], function (err, result) {
            if (err) { return onErr(err); }

            console.log("Locating subject...");
            firebase("group_subjects/"+result.Subject.trim()).on("value", function(snapshot){
                if(!snapshot.exists()) {
                    console.eror("Sorry the subject couldn't be found.");
                }
                console.log("Building group...");
                var ref = firebase("groups");
                var key = ref.push();

                var group = snapshot.val();
                group.name = result.Name;
                group.text = result.Description;
                group.language = result.Language;
                group.type = 'public';
                group.id = key.key();
                group.totalParticipants = 0;
                group.totalActivities = 0;

                console.log("New group build. Inserting...");

                firebase("groups/"+key.key()).set(group, function(error){
                    if(error){
                        return console.error("Some error occur: " + JSON.stringify(error));
                    }
                    console.log("New group saved.. good game!");
                    process.exit(0);
                });
            });
        });
    });
});


function onErr(err) {
    console.log(err);
    return 1;
}