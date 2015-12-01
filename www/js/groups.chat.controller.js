'use strict';
angular.module('join.groups.chat', [])
    // https://forum.ionicframework.com/t/keep-the-keyboard-up-and-focus-on-text-field-after-submit/3724/15
    .directive("detectFocus", function () {
        return {
            restrict: "A",
            scope: {
                onFocus: '&onFocus',
                onBlur: '&onBlur',
                focusOnBlur: '=focusOnBlur'
            },
            link: function (scope, elem) {

                elem.on("focus", function () {
                    scope.onFocus();
                    scope.focusOnBlur = true;  //note the reassignment here, reason why I set '=' instead of '@' above.
                    scope.$parent.focusManager.focusOnBlur = true;
                });

                elem.on("blur", function () {
                    scope.onBlur();
                    //if (scope.focusOnBlur)
                    if (scope.$parent.focusManager.focusOnBlur)
                        elem[0].focus();
                });
            }
        }
    })

    .controller('GroupChatController', function($scope, $stateParams, $state, $ionicPopup, $ionicSideMenuDelegate, $ionicConfig, $helper, $messageListener,
                                                $ionicScrollDelegate, $firebase, $logger, $path, $database, $ionicLoading, $ionicModal, $join, $translate) {
        $scope.groupId = $stateParams.groupId;
        $scope.type = $stateParams.type;

        $scope.focusManager = { focusInputOnBlur: true};

        var user = $join.user;

        var limit = 20;

        $scope.shouldNotFocusOnBlur = function() {
            $scope.focusManager.focusOnBlur = false;
        };

        $scope.scrollContentToBottom = function() {
            $ionicScrollDelegate.$getByHandle('main').scrollBottom(true);
        };

        $scope.onTextMessageFocus = function(){
            $ionicScrollDelegate.scrollBottom(true);
        };

        window.addEventListener('native.keyboardshow', $scope.onTextMessageFocus);
        window.addEventListener('native.keyboardhide', $scope.onTextMessageFocus);

        $scope.$on('$ionicView.beforeEnter', function(e, viewData) {
            viewData.enableBack = true;
            $scope.backButtonClass = $ionicConfig.backButton.icon();

            $scope.conversation = { scroll : true, text : null, queue : []};
            user.groups[$scope.type][$scope.groupId].hasUnreadMessage = false;

            $scope.group = user.groups[$scope.type][$scope.groupId];
            $firebase("groups", $scope.groupId, "banned", user.$id).once("value", function(snapshot){
               if(snapshot.exists()){
                   delete user.groups[$scope.type][$scope.groupId];
                   window.localStorage.setItem("user", JSON.stringify(user));
                   $ionicLoading.show({ template: $translate.instant('USER_BANNED'), duration: 1500 });
                   setTimeout(function () { return $state.go("dash"); }, 1500);
               } else{
                   $scope.init();
               }
            });
        });

        $scope.init = function(){
            $firebase("users", user.$id, "groups", $scope.type, $scope.groupId).once("value", function(snapshot){
                if(!snapshot.exists()){
                    $ionicPopup.alert({ title: $translate.instant('WARNING'), template: $translate.instant('USER_NOT_NOT_MEMBER')}).then(function(){
                        var returnTo = $scope.type == "activity" ? "dash" : "groups";
                        return $state.go(returnTo);
                    });
                }
                $scope.group = snapshot.val();
                user = $helper.group.updateLocal($scope.group);
                $scope.isEditable = user.$id == $scope.group.owner;

                $scope.refresh();
            });
        };

        $scope.refresh = function(){
            var self = this;
            var select = "select * from chats where group_id = ? and delivery = 0 order by message_id desc;"
            $database.open().transaction(function(tx) {
                tx.executeSql(select, [$scope.groupId], function(tx, res) {
                    if(res.rows.length == 0){
                        select = "select * from chats where group_id = ? order by message_id desc limit ?;"
                        $database.open().transaction(function(tx) {
                            tx.executeSql(select, [$scope.groupId, limit], function (tx, res) {
                                for(var i = 0;i < res.rows.length; i++){
                                    var message = JSON.parse(res.rows.item(i).message);
                                    message.id = res.rows.item(i).message_id;
                                    $scope.createMessageBox($scope, message);
                                    $scope.remove(message);
                                }
                                $scope.startListingForNewMessages();
                                $scope.loaded = true;
                                $ionicScrollDelegate.scrollBottom();
                                $scope.apply();
                            })
                        });
                    } else {
                        for(var i = 0;i < res.rows.length; i++){
                            var message = JSON.parse(res.rows.item(i).message);
                            message.id = res.rows.item(i).message_id;
                            $scope.createMessageBox($scope, message);
                            $scope.remove(message);
                        }
                        $database.open().transaction(function(tx) {
                            tx.executeSql("update chats set delivery = 1 where group_id = ? ", [$scope.groupId], function (tx, res) { });
                            $scope.startListingForNewMessages();
                            $scope.loaded = true;
                            $scope.apply();
                        });
                    }
                });
            });
        };

        $scope.remove = function(message){
            $firebase("users", user.$id, "chats", $scope.groupId, "unread_messages", message.id).remove();
        };

        $scope.apply = function(){
            if(!$scope.$$phase)
                $scope.$apply();
        };

        $scope.startListingForNewMessages = function(){
            $messageListener.listening = { group : $scope.group, callback : function(message){
                if(message.kick && message.kick.id == user.$id){
                    $firebase("groups", groupId, "banned", user.$id).once("value", function(snapshot){
                        if(snapshot.exists()){
                            delete user.groups[$scope.type][$scope.group.id];
                            window.localStorage.setItem("user", JSON.stringify(user));

                            $ionicPopup.alert({ title: $translate.instant('WARNING'), template: $translate.instant('USER_BANNED')}).then(function(){
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
                $scope.remove(message);
            }};
        };

        $scope.showPriorMessage = function(groupId, callback){
            var select = "select * from chats where group_id = ? and message_id < ? order by message_id desc limit ?;";
            $database.open().transaction(function(tx) {
                tx.executeSql(select, [$scope.groupId, $scope.conversation.firstPriority, limit], function(tx, res) {
                    if(res.rows.length != 0){
                        for(var i = 0;i < res.rows.length; i++){
                            var message = JSON.parse(res.rows.item(i).message);
                            message.id = res.rows.item(i).message_id;
                            $scope.createMessageBox($scope, message);
                        }
                    }
                });
            });
        };

        $scope.dots = '<svg viewBox="0 0 64 64"><g><circle cx="16" cy="32" stroke-width="0" r="5.02133"><animate attributeName="fill-opacity" dur="750ms" values=".5;.6;.8;1;.8;.6;.5;.5" repeatCount="indefinite"></animate><animate attributeName="r" dur="750ms" values="3;3;4;5;6;5;4;3" repeatCount="indefinite"></animate></circle><circle cx="32" cy="32" stroke-width="0" r="5.97867"><animate attributeName="fill-opacity" dur="750ms" values=".5;.5;.6;.8;1;.8;.6;.5" repeatCount="indefinite"></animate><animate attributeName="r" dur="750ms" values="4;3;3;4;5;6;5;4" repeatCount="indefinite"></animate></circle><circle cx="48" cy="32" stroke-width="0" r="4.97867"><animate attributeName="fill-opacity" dur="750ms" values=".6;.5;.5;.6;.8;1;.8;.6" repeatCount="indefinite"></animate><animate attributeName="r" dur="750ms" values="5;4;3;3;4;5;6;5" repeatCount="indefinite"></animate></circle></g></svg>';

        $scope.createMessageBox = function(scope, message, local){
            if(message.sender.i){
                var sendingBox = document.getElementById(message.id);
                if (sendingBox) {
                    setTimeout(function(){
                        sendingBox.classList.remove('message-sending');
                        sendingBox.children[1] && sendingBox.children[1].classList.remove('sending-message-text');
                        sendingBox.firstChild && sendingBox.firstChild.firstChild && sendingBox.firstChild.firstChild.remove();
                    }, 1000)
                    return;
                }
            }

            var html = "";
            html += '<div class="col-95" >';

            var pullright = message.sender.i || "local" == local ? "pull-right" : "";

            html += '<span class="message-wrap '+pullright + ("local" == local ? " message-sending" : "") + '" id="'+ message.id + '">';
            if(local){
                html += '<div class="spinner svg sending-dots" style="height: 10px">'
                    + $scope.dots
                    +' <span class="sender '+pullright+'">' +message.sender.nickname+' - <span style="font-size:12px;">'+moment(message.timestamp).format("LT")+'</span></span><br/>'
                    + '</div>';
            } else {
                html += ' <span class="sender '+pullright+'">' +message.sender.nickname+' - <span style="font-size:12px;">'+moment(message.timestamp).format("LT")+'</span></span><br/>';
            }

            if(message.chat){
                if(message.chat.notification){
                    var messageChat = message.chat.value.replace("$timestamp", moment(message.chat.data.timestamp).format('lll'));
                    html += '<span class="message" style="white-space:pre-wrap;">'+messageChat+'</span>';
                } else{
                    if(local){
                        html += '<span class="message sending-message-text" style="white-space:pre-wrap;">'+message.chat.value+'</span>';
                    } else{
                        html += '<span class="message" style="white-space:pre-wrap;">'+message.chat.value+'</span>';
                    }
                }
            }

            html += '</div>';

            var box = document.getElementById("messagesBox");
            var messageBox = document.createElement("div");
            messageBox.className = "chat row";
            messageBox.innerHTML = html;

            if(box){
                if(scope.conversation.firstPriority && message.priority > scope.conversation.firstPriority || "local" == local){
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

        $scope.sendMessage = function(){
            if(!$scope.conversation.text) return;
            var messageText = $scope.conversation.text;
            $scope.conversation.text = null;

            var inserts = {};
            var ref = $firebase("groups_conversation", $scope.groupId).push();
            var message = {
                id : ref.key(),
                sender : {id : user.id, nickname : user.nickname},
                timestamp : moment.utc().toISOString(),
                chat : {value : messageText}
            };
            inserts["groups_conversation/" + $scope.groupId + "/" + ref.key()] = message;

            $scope.createMessageBox($scope, message, "local");
            $firebase().update(inserts, function(){
                    if(!$scope.$$phase)
                        $scope.$apply();
                }
            );
            if($scope.conversation.scroll)
                $ionicScrollDelegate.scrollBottom(true);
        };

        $scope.sideMenuToggle = function(){
            $ionicSideMenuDelegate.toggleRight();
        };

        $scope.choosePlatforms = function(){
            var group = user.groups[$scope.type][$scope.groupId];
            $scope.platforms = group.platforms || $scope.group.platforms.slice();

            $ionicModal.fromTemplateUrl('choose-platforms.html', {
                scope: $scope,
                animation: 'slide-in-up'
            }).then(function(modal) {
                $scope.modal = modal;
                $scope.modal.show();
            });
        };

        $scope.closeModal = function() {
            $scope.modal.hide();
            $scope.modal.remove();
            $scope.modal = null;
        };

        $scope.onPlatformChange = function(p){
            var command = {};
            var index = $scope.platforms.indexOf(p);
            if(index >= 0){
                var config = angular.copy($scope.platforms[index]);
                user.groups[$scope.type][$scope.groupId].platforms[index] = config;
                command[$path("users", user.$id, "groups", $scope.type, $scope.groupId, "platforms", index)] = config;
                var push = $firebase("notifications/platforms/change/" + user.$id + "/" + $scope.groupId).push();
                var cmd = angular.copy(config);
                cmd.id = user.$id;
                cmd.groupId = $scope.groupId;
                command[$path("notifications/platforms/change/"+ push.key())] = cmd;

                $firebase().update(command, function(error){
                    if(error){
                        $helper.toast($translate.instant('PLATFORM_CHANGE_ERROR'));
                    } else {
                        window.localStorage.setItem("user", JSON.stringify(user));
                        $helper.toast($translate.instant('DONE'), 1000);
                    }
                });
            }

        };
    })


;