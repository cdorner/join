var Firebase = require("firebase");
var firebaseUrl = require('./join.firebase');

new Firebase(firebaseUrl + "/users").on("child_added", function(snapshot){
    var nickname = snapshot.val().nickname;
    new Firebase(firebaseUrl + "/users/" + snapshot.key()).update({ searchNickname : nickname.toLowerCase() });
});