angular.module('join.messages', [])

    .factory("$messageListener", function($firebase, $database, $join, $translate) {
        return  {
            started : false,
            listening : null,
            callback : null,
            user : null,
            activeChats : [],

            saveMessage : function(groupId, snapshot, delivery, callback){
                var message = snapshot.val();
                message.id = snapshot.key();
                message.priority = snapshot.key();
                message.sender.i = message.sender.id == this.user.$id;

                $database.open().transaction(function(tx) {
                    var cmd = "INSERT OR IGNORE INTO chats (group_id, message_id, datetime, message, delivery) VALUES (?, ?, ?, ?, ?)";
                    tx.executeSql(cmd, [groupId, snapshot.key(), moment(message.timestamp).toDate(), JSON.stringify(message), delivery ? 1 : 0],
                        function(tx, results){
                            callback && callback(message);
                        }, function(tx, err){
                            console.log(err);
                        }
                    );
                });
                return message;
            },

            getTextFromUnreadMessages : function(groupId, callback){
                $database.open().transaction(function(tx) {
                    var cmd = "select * from chats where group_id = ? and delivery = 0 order by message_id limit 3";
                    tx.executeSql(cmd, [groupId], function(tx, results){
                            var text = results.rows.length > 0 ? "" : null;
                            for(var i = 0;i < results.rows.length; i++){
                                var message = JSON.parse(results.rows.item(i).message);
                                text += "@"+message.sender.nickname + " " +message.chat.value + " \r\n";
                            }
                            callback(text);
                        }, function(tx, err){
                            callback(null);
                        }
                    );
                });
            },

            getCountUnreadMessages : function(groupId, callback){
                $database.open().transaction(function(tx) {
                    var cmd = "select count(*) total from chats where group_id = ? and delivery = 0";
                    tx.executeSql(cmd, [groupId], function(tx, results){
                            callback(results.rows.item(0).total);
                        }, function(tx, err){
                            callback(null);
                        }
                    );
                });
            },

            start : function(user){
                if(!user || this.started) return;
                this.user = user;
                this.started = true;
                var self = this;
                var id = 0;

                $firebase("users", self.user.$id, "chats").on("child_added", function(snapshot) {
                    // prevent double multiple attach when chat/$groupId consume all messages

                    if(self.activeChats[snapshot.key()]) return;
                    $firebase("groups", snapshot.key()).once("value", function(snapshot){
                        if(!snapshot.exists()) return;
                        var group = snapshot.val();
                        var groupName = group.type == 'activity' ? group.activity :  group.name;

                        self.activeChats[snapshot.key()] = true;
                        // it's a problemn because if the user has several unread messsages and he ignores thous messages when using the app, every time the app resume the same messages will be downloaded againg
                        $firebase("users", self.user.$id, "chats", snapshot.key(), "unread_messages").on("child_added", function(snapshot) {
                            var context = this;
                            var delivery = self.listening && context.groupId == self.listening.group.id && document.location.hash.indexOf(self.listening.group.id) != -1;
                            self.saveMessage(context.groupId, snapshot, delivery, function(message){
                                console.info("Receive message from group " + context.groupId + " " + message.id + " at page " + location + " listening group " + self.listening);
                                if(delivery){
                                    console.info("Calling callback for group " + self.listening.group.id);
                                    self.listening.callback(message);
                                } else {
                                    if($join.user.groups[context.type][context.groupId]) {$join.user.groups[context.type][context.groupId].hasUnreadMessage = true;}


                                    if (window.cordova && window.cordova.plugins && cordova.plugins.notification) {
                                        var android = device.platform == "Android";
                                        if(android){
                                            window.plugin.notification.local.isPresent(context.id, function (present) {
                                                self.getCountUnreadMessages(context.groupId, function(total){
                                                    var cmd = {
                                                        id: context.id,
                                                        text : total > 1 ? total + $translate.instant('UNREAD_MESSAGES') : "@" + message.sender.nickname + " " + message.chat.value,
                                                        title: context.groupName,
                                                        icon : context.groupPhoto,
                                                        smallIcon : "res://icon",
                                                        data : { total : total, groupId : context.groupId, type : group.type }
                                                    };

                                                    if(present){
                                                        window.plugin.notification.local.update(cmd);
                                                    } else {
                                                        window.plugin.notification.local.schedule(cmd);
                                                    }
                                                });
                                            });
                                            return;
                                        }

                                        self.getTextFromUnreadMessages(context.groupId, function(messages){
                                            if(message){
                                                var text = context.groupName + " \r\n";
                                                text += messages;
                                                window.plugin.notification.local.schedule({
                                                    id: context.id,
                                                    text: text,
                                                    sound : "file://beep.caf",
                                                    data : { groupId : context.groupId, type : group.type }
                                                });
                                            }
                                        });


                                    }
                                }
                            });

                        }, {id : ++id, groupId : group.id, type : group.type, groupName : groupName, groupPhoto : group.photo});
                    });
                });
            }
        }


    })
;