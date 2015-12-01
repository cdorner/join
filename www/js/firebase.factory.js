angular.module('database.services', [])

    .factory("$firebase", function() {
        return function(){
            //var path = "https://jointhegame1.firebaseio.com/";
            var path = "https://join-poc.firebaseio.com/";
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
                    var detail = JSON.stringify(message);
                } catch (e) {
                    var detail = message;
                }
                if(loggerLocation)
                    console.error("Some error occured on: " + loggerLocation + " detail: " + detail);
                else
                    console.error(detail);
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
                if(window.sqlitePlugin){
                    this.reference().executeSql('CREATE TABLE IF NOT EXISTS chats (groups VARCHAR(50) NOT NULL, priority VARCHAR, message VARCHAR, PRIMARY KEY (groups, priority) )');
                } else {
                    this.reference().transaction(function(tx){
                        tx.executeSql('CREATE TABLE IF NOT EXISTS chats (groups VARCHAR(50) NOT NULL, priority VARCHAR, message VARCHAR, PRIMARY KEY (groups, priority) )');
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
        };
    })
;