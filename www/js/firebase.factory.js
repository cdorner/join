angular.module('database.services', [])

    .factory("$firebase", function() {
        return function(){
            //var path = "https://jointhegame1.firebaseio.com/app/";
            var path = "https://join-development.firebaseio.com/app/";
            //var path = "https://join-poc.firebaseio.com/";
            if(arguments){
                for (var i = 0; i < arguments.length; i++) {
                    path += arguments[i];
                    if(i + 1 != arguments.length)
                        path += "/";
                };
            }
            return new Firebase(path);
        }
    })

    .factory("$path", function() {
        return function(){
            var path = "";
            if(arguments){
                for (var i = 0; i < arguments.length; i++) {
                    path += arguments[i];
                    if(i + 1 != arguments.length)
                        path += "/";
                };
            }
            return path;
        }
    })

    .factory("auth", function($firebaseAuth, $firebase) {
        return $firebaseAuth($firebase());
    })

    // logger should reply to server
    .factory("$logger", function() {
        var loggerLocation = "";
        return {

            log : function(object){
                console.log(object);
            },

            config : function(location){
                loggerLocation = location;
            },

            error : function(message){
                try {
                    if(!message) return false;
                    var detail = JSON.stringify(message);
                } catch (e) {
                    var detail = message;
                }
                if(loggerLocation)
                    console.error("Some error occured on: " + loggerLocation + " detail: " + detail);
                else
                    console.error(detail);
                return true;
            }
        };
    })

    .factory("$notifications", function($firebase){

        return {

            requestConfirmation : function(groupId, userId, callback){
                if(userId instanceof Array ){
                    return $firebase("notifications", groupId).push({ requestConfirmation : { groupId : groupId, userId : userId } }, function(){
                        for (var i = 0; i < userId.length; i++) {
                            $firebase("groups_participants", groupId, userId[i]).update({ confirmation : "requested" });
                        };
                        callback();
                    });
                }
                return $firebase("notifications", groupId).push({ requestConfirmation : { groupId : groupId, userId : userId } }, function(){
                    $firebase("groups_participants", groupId, userId).update({ confirmation : "requested" }, callback);
                });
            }
        };
    })

    .factory('$database', function(){

        return {
            create : function(){
                var command = 'CREATE TABLE IF NOT EXISTS chats (group_id VARCHAR(50) NOT NULL, message_id VARCHAR, datetime timestamp, message VARCHAR, delivery integer, PRIMARY KEY (group_id, message_id) )';
                if(window.sqlitePlugin){
                    this.reference().executeSql(command);
                } else {
                    // browser
                    this.reference().transaction(function(tx){
                        tx.executeSql(command, [], function(tx, results){

                        }, function(tx, err){
                            console.log(err);
                        });
                    });
                }
            },

            reference : function(){
                if(window.sqlitePlugin){
                    return window.sqlitePlugin.openDatabase({name : "join.db", location : 2});
                } else {
                    return window.openDatabase("join.db", "1.0.0", "Demo", -1);
                }
            },

            open : function() {
                this.create();
                return this.reference();
            }
            ,

            flushGroup : function(groupId, callback){
                this.open().transaction(function(tx) {
                    tx.executeSql("delete from chats where group_id = ?", [groupId], function(tx, res) {
                        if(callback) callback(res);
                    });
                });
            },

            flushMessagesPrior : function(days, callback){
                this.open().transaction(function(tx) {
                    tx.executeSql("delete from chats where datetime <= ?", [moment().subtract(days, 'days').toDate()], function(tx, res) {
                        if(callback) callback(res);
                    });
                });
            }
        };
    })

    .factory('$pushRegistration', function($firebase, $path){

        return {
            update : function(){
                var registrationId = window.localStorage.getItem("update-registrationId");
                if(registrationId){
                    var user = JSON.parse(window.localStorage.getItem("user"));
                    if(user){
                        var commands = {};
                        commands[$path("notifications/users/device/change/"+ user.$id)] = {id: user.$id, registrationId : registrationId, timestamp : Firebase.ServerValue.TIMESTAMP};
                        $firebase().update(commands, function(error){
                            if(!error){
                                window.localStorage.removeItem("update-registrationId");
                            }
                        });
                    }
                }
            }
        };
    })

    .factory('$helper', function($ionicLoading){
        return {
            group : {
                toLocal : function(group) {
                    return { id : group.id, name : group.name, text : group.text, language : group.language, photo : group.photo, timetamp : group.timestamp,
                        platforms : group.platforms, type : group.type, activities : group.activities, levels : group.levels, owner : group.owner,
                        totalParticipants : group.totalParticipants, totalActivities : group.totalActivities, silent : group.silent};
                },
                updateLocal : function(group){
                    var user = JSON.parse(window.localStorage.getItem("user"));
                    user.groups[group.type][group.id] = group
                    window.localStorage.setItem("user", JSON.stringify(user));
                    return user;
                },
                remove : function(user, group){
                    if(!group) return user;
                    delete user.groups[group.type][group.id];
                    window.localStorage.setItem("user", JSON.stringify(user));
                    return user;
                }
            },
            orNull : function(obj){
                return Object.keys(obj).length == 0 ? null : obj;
            },
            user : {
                update : function(user){
                    window.localStorage.setItem("user", JSON.stringify(user));
                    return user;
                }
            },

            errors : {
                _403 : function(error){
                    return error && error.code == 'PERMISSION_DENIED';
                }
            },

            toast : function(message, duration){
                $ionicLoading.show({ template: message, noBackdrop: true, duration: duration || 1500 });
            }
        };
    })

    .factory('$join', function($firebase, $path, $database, $helper, $logger, $translate){

        return {
            user : JSON.parse(window.localStorage.getItem("user")),

            start : function(user){
                this.user = user;
            },

            join : function(user, group, success, error){
                var commands = {};
                var group = angular.copy(group);
                group.silent = false;
                commands[$path("users", user.$id, "groups", group.type, group.id)] = group;
                commands[$path("users", user.$id, "groups", "invite", group.id)] = null;
                var notification = $firebase("notifications/groups_participants/add").push();
                commands[$path("notifications/groups_participants/add", notification.key())] = {groupId : group.id, type : group.type, id : user.$id, nickname : user.nickname, photo : user.photo, status : "joined", timestamp : Firebase.ServerValue.TIMESTAMP};

                $firebase().update(commands, function(error){
                    if($logger.error(error)) {
                        return error && error($translate.instant('UNKNOWN_ERROR'));
                    }

                    user = $helper.group.updateLocal(group);
                    success && success(user, group, $translate.instant('JOIN_GROUP_SUCCESS'));
                });
            },

            ignore : function(user, group, success, error) {
                var commands = {};
                commands[$path("groups_participants", group.id, user.id)] = null;
                commands[$path("users", user.$id, "groups/invite/", group.id)] = null;
                $firebase().update(commands, function(error){
                    if($logger.error(error)) {
                        return error && error($translate.instant('UNKNOWN_ERROR'));
                    }
                    success && success(user, group, $translate.instant('INVITE_IGNORED'));
                });
            },

            confirm : function(user, group, success, error) {
                var commands = {};
                var notification = $firebase("notifications/groups_participants/confirmed").push();
                commands[$path("groups_participants", group.id, user.$id, "status")] = "confirmed";
                commands[$path("notifications/groups_participants/confirmed", notification.key())] = {groupId : group.id, type : group.type,
                    id : user.$id, nickname : user.nickname, timestamp : Firebase.ServerValue.TIMESTAMP};

                $firebase().update(commands, function(err){
                    if($helper.errors._403(err)){
                        return error && error($translate.instant('UNKNOWN_ERROR'));
                    }
                    success && success(user, group, $translate.instant('PRESENCE_CONFIRMED'));
                });
            },

            drop : function(user, group, success, error) {
                var r = $firebase();
                var updates = {};
                updates[$path("users", user.$id, "groups", group.type, group.id)] = null;
                updates[$path("groups_participants", group.id, user.$id)] = null;
                var notification = $firebase("notifications/groups_participants/removed").push();
                updates[$path("notifications/groups_participants/removed", notification.key())] = {groupId : group.id, groupName : group.name, type : group.type,
                    id : user.$id, nickname : user.nickname, timestamp : Firebase.ServerValue.TIMESTAMP};

                r.update(updates, function(error){
                    if($logger.error(error)) {
                        return error && error($translate.instant('UNKNOWN_ERROR'));
                    }
                    $database.flushGroup(group.id);
                    delete user.groups[group.type][group.id];
                    window.localStorage.setItem("user", JSON.stringify(user));
                    success && success(user, group, $translate.instant('STEP_OUT_GROUP'));
                });
            }
        };
    })
;