var util = require("util");
var async = require("async");
var redis = require("redis"),
    client = redis.createClient();

var firebase = require('../firebase.connection');
var log = require("../simple.log")();


firebase("commands/cache/user/info").on("child_added", function(snapshot){
    var userId = snapshot.key();
    firebase("users/" + userId + "/info").once("value", function(snapshot){
        var info = snapshot.val();
        firebase("users/" + info.id + "/groups").once("value", function(snapshot){
            updateUser(this, snapshot.val());
        }, info);
    });

});

firebase("users").orderByChild("info/registration").startAt(new Date().getTime()).on("child_added", function(snapshot){
    firebase("commands/cache/user/info/"+snapshot.key()).set({ id : snapshot.key()} );
});

var updateUser = function(user, groups){
    async.waterfall([
        async.apply(function cacheUser(info, groups, callback){
            var cmd = { id : info.id, nickname : info.nickname, photo : info.photo };
            if(info.device) {
                cmd.deviceRegistrationId = info.device.registrationId;
                cmd.devicePlatform = info.device.platform;
                cmd.utcOffset = info.device.utcOffset;
                cmd.language = info.device.language;
            }
            client.hmset("users-" + info.id, cmd, function(error, obj){
                if(error){
                    console.log(error);
                    return callback(error);
                }
                callback(null, user, groups)
            });
        }, user, groups),

        function updateGroupsSelectedPlatforms(user, groups, callback){
            for(t in groups){
                if("invite" == t) continue;
                for(g in groups[t]){
                    var platforms = groups[t][g].platforms;
                    if(platforms){
                        for (var i = 0; i < platforms.length; i++) {
                            var p = platforms[i];
                            var cacheKey = util.format("groups%s-platforms-%s-%s", g, p.name, p.version);
                            if(p.allow) client.sadd([cacheKey, user.id], log.ifError);
                            else client.srem([cacheKey, user.id], log.ifError);
                        }
                    }
                }
            }
            callback(null, user);
        }
    ], function(error, user){
        if(!error){
            firebase("commands/cache/user/info/"+user.id).remove();
        }
    });
};