var firebase = require('../firebase.connection');

firebase("notifications/users/login/done").on("child_added", function(snapshot){

    firebase("commands/cache/user/info/"+snapshot.key()).set({ id : snapshot.key()} );

    firebase("notifications/users/login/done/"+snapshot.key()).remove();

});
