angular.module('join.groups.chat', [])

    .controller('GroupChatController', function($scope, $stateParams, $state, $ionicPopup, $ionicSideMenuDelegate, $ionicConfig,
                                                $ionicScrollDelegate, $firebase, $logger, $path, $database, $ionicLoading) {
        $scope.groupId = $stateParams.groupId;
        $scope.type = $stateParams.type;

        var user = JSON.parse(window.localStorage.getItem("user"));

        var newMessageIncommingCallback = null;
        var newMessageIncommingRef = null;
        var limit = 30;

        $scope.$on('$ionicView.beforeEnter', function(e, viewData) {
            viewData.enableBack = true;
            $scope.backButtonClass = $ionicConfig.backButton.icon();

            $scope.conversation = { scroll : true, text : null};

            $firebase("groups", $scope.type, $scope.groupId, "banned", user.$id).once("value", function(snapshot){
               if(snapshot.exists()){
                   $ionicLoading.show({ template: "Você não faz parte desse grupo.", duration: 1500 });
                   setTimeout(function () { return $state.go("dash"); }, 1500);
               } else{
                   $scope.init();
               }
            });
        });

        $scope.$on('$destroy', function() {
            if(newMessageIncommingRef && newMessageIncommingCallback){
                newMessageIncommingRef.off("child_added", newMessageIncommingCallback);
            }
        });

        $scope.init = function(){
            $firebase($path("groups", $scope.type, $scope.groupId)).once("value", function(snapshot){
                if(!snapshot.exists()){
                    $ionicPopup.alert({ title: 'Aviso', template: 'Voce nao faz parte desse grupo, primeiro de join para interagir com ele.'}).then(function(){
                        if($scope.type == "activity") $state.go("dash");
                        else $state.go("groups");
                    });
                }
                $scope.group = snapshot.val();
                $scope.group.$id = snapshot.key();
                $scope.isEditable = user.$id == $scope.group.owner;
                $scope.acceptInviteFromNotification();

                $scope.refresh();
            });
        };

        $scope.refresh = function(){
            $scope.getConversation($stateParams.groupId, function(){
                if(!$scope.$$phase)
                    $scope.$apply();
                if($scope.conversation.scroll)
                    $ionicScrollDelegate.scrollBottom(true);
            });
        };

        $scope.getConversation = function(groupId, callback){
            var self = this;
            async.waterfall([
                function loadChatLocalDatabase(callback){
                    var select = null;
                    var selectArguments = [groupId];
                    if($scope.conversation.firstPriority){
                        select = "select * from chats where groups = ? and priority < ? order by priority desc limit ?;"
                        selectArguments.push($scope.conversation.firstPriority);
                    } else{
                        select = "select * from chats where groups = ? order by priority desc limit ?;"
                    }
                    selectArguments.push(limit);

                    $database.open().transaction(function(tx) {
                        tx.executeSql(select, selectArguments, function(tx, res) {
                            // not in local database
                            if(res.rows.length == 0){
                                var priority= $scope.conversation.firstPriority ? $scope.conversation.firstPriority : "a";
                                $firebase("groups_conversation", groupId).orderByKey().endAt(priority).limitToLast(limit + 1).once("value", function (snapshot) {
                                    var messages = [];
                                    snapshot.forEach(function(value){
                                        if(value.key() == priority) return;
                                        var message = $scope.saveMessage(groupId, value);
                                        messages.push(message);
                                    });
                                    messages.reverse();
                                    messages.forEach(function(message){
                                        $scope.createMessageBox($scope, message);
                                    })
                                    callback();
                                });
                                return;
                            }

                            for(var i = 0;i < res.rows.length; i++){
                                var message = JSON.parse(res.rows.item(i).message);
                                message.priority = res.rows.item(i).priority;
                                $scope.createMessageBox($scope, message);
                            }
                            callback();
                        });
                    });
                },

                function startListingForNewMessages(callback){
                    if(newMessageIncommingRef) return callback(null);
                    newMessageIncommingRef = $firebase("groups_messages_unread", groupId, user.$id);
                    newMessageIncommingCallback = newMessageIncommingRef.on("child_added", function (snapshot) {
                        var message = $scope.saveMessage(groupId, snapshot);
                        if(message.kick && message.kick.id == user.$id){
                            $firebase("groups", $scope.type, groupId, "banned", user.$id).once("value", function(snapshot){
                                if(snapshot.exists()){
                                    delete user.groups[$scope.type][$scope.group.$id];
                                    window.localStorage.setItem("user", JSON.stringify(user));

                                    $ionicPopup.alert({ title: 'Aviso', template: 'Desculpe, mas você não faz mais parte desse grupo.'}).then(function(){
                                        if($scope.type == "activity") $state.go("dash")
                                        else $state.go("groups")
                                    });
                                }
                            });
                        } else {
                            $scope.createMessageBox($scope, message);
                            if($scope.conversation.scroll)
                                $ionicScrollDelegate.scrollBottom(true);
                        }
                        $firebase("groups_messages_unread", groupId, user.$id, message.$id).remove();
                    });
                    callback();
                }
            ], function(error, result){
                callback();
            });
        };

        $scope.saveMessage = function(groupId, snapshot){
            var message = snapshot.val();
            message.$id = snapshot.key();
            message.priority = snapshot.key();
            message.sender.i = message.sender.id == user.$id;
            if (message.invite) {
                if (user.groups.private[message.invite.groupId]) message.invite.belongsGroup = true;
                if (user.groups.public[message.invite.groupId]) message.invite.belongsGroup = true;
                if (user.groups.activity[message.invite.groupId]) message.invite.belongsGroup = true;
            }

            $database.open().transaction(function(tx) {
                var cmd = "INSERT OR REPLACE INTO chats (groups, priority, message) VALUES (?, ?, ?)";
                tx.executeSql(cmd, [groupId, snapshot.key(), JSON.stringify(message)],
                    function(tx, results){

                    }, function(err){
                        console.log(err);
                    }
                );
            });
            return message;
        };

        $scope.createMessageBox = function(scope, message){
            var html = "";
            html += '<div class="col-95">';

            var pullright = message.sender.i ? "pull-right" : "";

            html += '<span class="message-wrap '+pullright+'">';

            html += '<span class="sender '+pullright+'">'+message.sender.nickname+' - <span style="font-size:12px;">'+moment(message.timestamp).format("LT")+'</span></span><br/>';
            if(message.chat){
                html += '<span class="message" style="white-space:pre-wrap;">'+message.chat.value+'</span>';
            }

            //html += '<span ng-show="c.invite">';
            //html += '<i class="icon ion-ios-game-controller-b"></i> Convite';
            //html += '<span class="activity">';
            //html += '{{c.invite.activity}} {{c.invite.level}} {{c.invite.date | date : \'short\'}}';
            //html += '</span>';
            //html += '</span>';

            //html += '<span ng-show="c.invite">';
            //html += '<ion-toggle ng-hide="c.sender.i" ng-model="c.invite.belongsGroup" ng-disabled="c.invite.belongsGroup"';
            //html += 'ng-change="acceptInvite(c)" toggle-class="toggle-calm" class="chat-toogle">';
            //html += 'Join?';
            //html += '</ion-toggle>';
            //html += '</span>';
            //html += '<span ng-show="c.accept">';
            //html += '<i class="icon ion-ios-game-controller-b"></i> Aceitou convite de {{c.accept.from}} <br/>';
            //html += '<span ng-show="c.accept">{{c.accept.peopleConnected}} pessoas conectadas nesse jogo</span>';
            //html += '</span>';
            //html += '</span>';

            html += '</div>';

            var box = document.getElementById("messagesBox");
            var messageBox = document.createElement("div");
            messageBox.id = message.priority;
            messageBox.className = "chat row";
            messageBox.innerHTML = html;

            if(box){
                if(scope.conversation.firstPriority && message.priority > scope.conversation.firstPriority){
                    box.appendChild(messageBox);
                } else{
                    box.insertBefore(messageBox, box.firstChild);
                }
            }

            scope.conversation.firstPriority = scope.conversation.firstPriority && scope.conversation.firstPriority < message.priority ? scope.conversation.firstPriority : message.priority;
        }

        $scope.toogleDisableScroll = function(){
            $scope.disableScroll = !$scope.conversation.scroll;
            $scope.conversation.scroll = !$scope.conversation.scroll;
        };

        $scope.loadMoreMessages = function(){
            $scope.refresh();
        };

        $scope.sendMessage = function(){
            if(!$scope.conversation.text) return;
            var inserts = {};
            var ref = $firebase("groups_conversation", $scope.groupId).push();
            inserts["groups_conversation/" + $scope.groupId + "/" + ref.key()] = {
                sender : {id : user.id, nickname : user.nickname},
                timestamp : moment.utc().toISOString(),
                chat : {value : $scope.conversation.text}
            };

            $firebase().update(inserts, function(){
                    $scope.conversation.text = null;
                    if(!$scope.$$phase)
                        $scope.$apply();
                }
            );
        };

        $scope.acceptInviteFromNotification = function(){
            if (window.localStorage.getItem("invite")) {
                var invite = JSON.parse(window.localStorage.getItem("invite"));
                if($scope.groupId == invite.groupId){
                    var inserts = {};
                    if(invite.command == "accept"){
                        inserts[$path("users", user.$id, "groups", invite.type, invite.groupId)] = { silent : false };
                        inserts[$path("groups_participants", $scope.group.$id, user.$id)] = { id : user.$id, nickname : user.nickname, photo : user.photo,
                            status : 'joined', ".priority" : Firebase.ServerValue.TIMESTAMP};
                        var notification = $firebase("notifications", "groups_participants", "added").push();
                        inserts[$path("notifications", "groups_participants", "added", notification.key())] = {groupId : $scope.group.$id, groupName : $scope.group.name, userId : user.$id, nickname : user.nickname, timestamp : Firebase.ServerValue.TIMESTAMP};
                    } else if (invite.command == "confirmation"){
                        if(!user.groups[invite.type][$scope.groupId]){
                            window.localStorage.removeItem("invite");
                            return $state.go("dash");
                        }

                        inserts[$path("groups_participants", $scope.group.$id, user.$id, "status")] = "confirmed";
                        var notification = $firebase("notifications", "groups_participants", "confirmed").push();
                        inserts[$path("notifications", "groups_participants", "confirmed", notification.key())] = {groupId : $scope.group.$id, groupName : $scope.group.name, userId : user.$id, nickname : user.nickname, timestamp : Firebase.ServerValue.TIMESTAMP};
                    }
                    $firebase().update(inserts, function(error){
                        user.groups[invite.type][$scope.group.$id] = { silent : false};
                        window.localStorage.setItem("user", JSON.stringify(user));
                        window.localStorage.removeItem("invite");
                    });

                }
            }
        };

        $scope.acceptInvite = function(conversation){
            var groupId = conversation.invite.groupId;
            var type = conversation.invite.type;

            var inserts = {};
            inserts[$path("users", user.$id, "groups", type, groupId)] = { silent : false};
            inserts[$path("groups_participants", group.$id, user.$id)] = { id : user.$id, nickname : user.nickname, photo : user.photo, status : 'joined',
                ".priority" : Firebase.ServerValue.TIMESTAMP};

            $firebase().update(inserts, function(error){

            });
        };

        $scope.sideMenuToggle = function(){
            $ionicSideMenuDelegate.toggleRight();
        };

        $scope.onTextMessageFocus = function(){
            $ionicScrollDelegate.scrollBottom(true);
        };

        window.addEventListener('native.keyboardshow', $scope.onTextMessageFocus);
        window.addEventListener('native.keyboardhide', $scope.onTextMessageFocus);
    })


;