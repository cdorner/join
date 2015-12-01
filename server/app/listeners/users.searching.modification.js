var firebase = require('../firebase.connection');

/*
    Create a tree used for search a user by his nickname
 */
firebase("users").on("child_added", function(snapshot){
    var user = snapshot.val().info;
    if(user){
        var nickname = user.nickname;
        firebase("users_searches/" + user.id).update({ id : user.id, searchNickname : nickname.toLowerCase(), nickname : nickname, photo : user .photo });
    }
});