var Firebase = require("firebase");
var firebaseUrl = require('./join.firebase');

var redis = require("redis"),
    client = redis.createClient();


new Firebase(firebaseUrl + "/groups_participants").on("child_added", function(snapshot){

    new Firebase(firebaseUrl + "/groups_participants/" + snapshot.key()).on("child_added", function(value){
        var cacheKey = "groups_participants" + this.groupId;
        client.sadd([cacheKey, value.key()], redis.print);
    }, {groupId : snapshot.key()});

    new Firebase(firebaseUrl + "/groups_participants/" + snapshot.key()).on("child_removed", function(value){
        var cacheKey = "groups_participants" + this.groupId;
        client.srem([cacheKey, value.key()], redis.print);
    }, {groupId : snapshot.key()});
});
