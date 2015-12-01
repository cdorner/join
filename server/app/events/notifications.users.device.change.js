var firebase = require('../firebase.connection');

firebase("notifications/users/device/change").on("child_added", function(snapshot){
    var cmd = snapshot.val();
    firebase("commands/update_device_registration/user/"+snapshot.key()).set({ id : cmd.id, registrationId : cmd.registrationId} );
    firebase("commands/update_device_registration_cache/user/"+snapshot.key()).set({ id : cmd.id, registrationId : cmd.registrationId} );
});
