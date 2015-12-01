angular.module('join.groups.options', [])

    .controller('GroupParticipantesController', function($scope, $stateParams, $ionicPopup, $ionicPopover, $ionicModal, $ionicLoading,$logger,
                                                         $ionicScrollDelegate, $state, $notifications, $firebase, $path, $firebaseArray, $join, $helper, $translate) {
        $logger.config("GroupParticipantesController");
        var user = $join.user;

        $scope.participants = [];
        $scope.moreParticipantes = false;
        $scope.lastParticipantsKey = null;

        $scope.groupId = $stateParams.groupId;
        $scope.type = $stateParams.type;

        $scope.$on('$ionicView.beforeEnter', function() {
            $scope.group = user.groups[$scope.type][$scope.groupId];
            $scope.loadParticipants();

            $ionicPopover.fromTemplateUrl('my-popover.html', {
                scope: $scope
            }).then(function(popover) {
                $scope.popover = popover;
            });

            $ionicModal.fromTemplateUrl('friends.html', {
                scope: $scope,
                animation: 'slide-in-up'
            }).then(function(modal) {
                $scope.modal = modal;
            });

        });

        $scope.openPopover = function(participant, $event) {
            if(user.id != participant.id){
                $scope.participant = participant;
                $scope.popover.show($event);
            }
        };

        $scope.$on('popover.hidden', function() {
            $scope.participant = null;
        });

        $scope.showFriends = function() {
            $scope.followings = $firebaseArray($firebase("users", user.$id, "following").orderByChild("nickname"));
            $scope.followers = $firebaseArray($firebase("users_followers", user.$id).orderByChild("nickname"));

            $scope.followings.$loaded().then(function(){
                $scope.modal.show();
            });
        };

        $scope.isMyContact = function(follower){
            return $scope.followings.some(function(following){
                return following.id == follower.id;
            });
        };

        $scope.closeModal = function() {
            $scope.modal.hide();
        };

        $scope.invite = function() {
            var selectionFollowings = $scope.followings.filter(function(f){
                return f.invite;
            });
            var selectionFollowers = $scope.followers.filter(function(f){
                return f.invite;
            });

            var commands = {};
            selectionFollowings.forEach(function(f){
                commands[$path("notifications/groups_participants/invites", $scope.groupId, f.id)] = { id : f.id, nickname : f.nickname, timestamp : Firebase.ServerValue.TIMESTAMP };
            });
            selectionFollowers.forEach(function(f){
                commands[$path("notifications/groups_participants/invites", $scope.groupId, f.id)] = { id : f.id, nickname : f.nickname, timestamp : Firebase.ServerValue.TIMESTAMP };
            });

            $firebase().update(commands, function(error){
                if(!$logger.error(error)){
                    $helper.toast($translate.instant("INVITE_SENT"));
                    $scope.closeModal();
                }
            });
        };

        $scope.loadParticipants = function(){
            var ref = $firebase("groups_participants", $scope.groupId);
            if($scope.type == 'activity'){
                ref = ref.orderByPriority();
            } else {
                ref = ref.orderByKey();
                if($scope.lastParticipantsKey)
                    ref = ref.startAt($scope.lastParticipantsKey + "a");
                ref = ref.limitToFirst(15);
            }
            ref.on("value", function(snapshot){
                $scope.moreParticipantes = $scope.type != 'activity' && snapshot.exists();
                snapshot.forEach(function(snapshot){
                    $scope.lastParticipantsKey = snapshot.key();
                    var participant = snapshot.val();
                    participant.priority = snapshot.getPriority();
                    var find = $scope.participants.find(function(p){ return p.id == participant.id;});
                    if(find){
                        $scope.participants[$scope.participants.indexOf(find)] = participant
                    } else {
                        $scope.participants.push(participant);
                    }
                });
                $scope.loaded = true;
                if(!$scope.$$phase)
                    $scope.$apply();
                $scope.$broadcast('scroll.infiniteScrollComplete');
            });
            ref.on("child_removed", function(snapshot){
                var participant = snapshot.val();
                var find = $scope.participants.find(function(p){ return p.id == participant.id;});
                if(find)
                    $scope.participants.splice($scope.participants.indexOf(find), 1);
            });
        };

        $scope.hasMoreParticipants = function(){
            return $scope.moreParticipantes;
        };

        $scope.reorderItem = function(item, $fromIndex, $toIndex){
            var commands = {};
            commands[$path("notifications/groups_participants/priority/change", $scope.groupId, item.id)] = { oldPriority : $fromIndex + 1, newPriority : ($toIndex + 1)};
            $firebase().update(commands, function(){
                $scope.participants = [];
                $scope.loadParticipants();
                $helper.toast($translate.instant("DONE"), 1000);
            });
        };

        $scope.toggleReorderRoster = function(){
            $scope.enableReorderRoster = !$scope.enableReorderRoster;
        };

        $scope.follow = function(){
            var participant = $scope.participant;
            var commands = {};

            commands[$path("users", user.$id, "following", participant.id)] = { id : participant.id, nickname : participant.nickname, photo : participant.photo, timestamp : Firebase.ServerValue.TIMESTAMP };
            commands[$path("users_followers", participant.id, user.$id)] = { id : user.$id, nickname : user.nickname, photo : user.photo, timestamp : Firebase.ServerValue.TIMESTAMP };

            $firebase().update(commands, function(error){
                if(!$logger.error(error)){
                    $helper.toast($translate.instant("ADDED"), 1500);
                }
            });
        };

        $scope.kickPlayer = function(){
            $ionicPopup.confirm({ title: $translate.instant("WARNING"), template: $translate.instant("BAN") + $scope.participant.nickname + "?"}).then(function(res){
                if(res){
                    var commands = {};
                    commands[$path("groups", $scope.group.id, "banned", $scope.participant.id)] = { enable : true};
                    var notification = $firebase("notifications/groups_participants/banned").push();
                    commands[$path("notifications/groups_participants/banned", notification.key())] = {groupId : $scope.group.id, groupName : $scope.group.name,
                        id : $scope.participant.id, nickname : $scope.participant.nickname, banned : true, type : $scope.group.type, timestamp : Firebase.ServerValue.TIMESTAMP};

                    $firebase().update(commands, function(error){
                        if(!$logger.error(error)){
                            var index = $scope.participants.indexOf($scope.participant);
                            $scope.participants.splice(index, 1);
                            $helper.toast($translate.instant("ADDED"), 1500);
                            $scope.popover.hide();
                        }
                    });
                }
            });
        };

        $scope.requestConfirmation = function(){
            var participants = [];
            if($scope.participant) {
                participants.push($scope.participant);
            } else{
                $scope.participants.forEach(function(p){
                    participants.push(p);
                });
            }
            var commands = {};
            participants.forEach(function(p){
                commands[$path("notifications/confirmations/requests", $scope.groupId, p.id)] = { timestamp : Firebase.ServerValue.TIMESTAMP };
            });
            $firebase().update(commands, function(error){
                if(!$logger.error(error)){
                    participants.forEach(function(p){
                        p.status = "requested";
                    });
                    $helper.toast($translate.instant("CONFIRMATION_SENT"));
                }
            });
        };

        $scope.owner = function(){
            return $scope.group && user.$id == $scope.group.owner;
        };
    })

    .controller('GroupSubordinatesController', function($scope, $stateParams, $ionicPopup, $ionicLoading, $state, $firebase, $path, $helper, $join, $translate) {
        var user = $join.user;

        $scope.groupId = $stateParams.groupId;
        $scope.type = $stateParams.type;

        $scope.activities = {};
        $scope.moreSubordinates = true;
        $scope.subordinatesPriority = null;

        $scope.$on('$ionicView.beforeEnter', function() {
            $firebase("groups", $scope.groupId).once("value", function(snapshot){
                $scope.group = snapshot.val();

                $scope.loadSubordinates();
            });
        });

        // For now just bring firsts 50 and done
        $scope.loadSubordinates = function(){
            if($scope.moreSubordinates){
                var ref = $firebase("groups").orderByChild('parent').equalTo($scope.groupId).limitToFirst(50).once("value", function(snapshot){
                    $scope.moreSubordinates = false;
                    if(snapshot.exists()){
                        $scope.activities.list = [];
                        snapshot.forEach(function(p){
                            var group = p.val();
                            $scope.activities.list.push(group);
                        });
                    }
                    $scope.loaded = true;
                    $scope.$apply();
                });
            }

        };


        $scope.hasMoreSubordinates = function(){
            return $scope.moreSubordinates;
        };

        $scope.join = function(group){
            if(user.groups.activity[group.id]){
                return $helper.toast($translate.instant("ALREAD_MEMBER"));
            }
            var commands = {};
            var platforms = group.platforms.map(function(p){ delete p["$$hashKey"];p.allow = true; return p;});

            commands[$path("users", user.$id, "groups", "activity", group.id)] = { silent : false};
            commands[$path("groups_participants", group.id, user.$id)] = { id : user.$id, nickname : user.nickname, photo : user.photo, status : 'joined'};
            var notification = $firebase("notifications/groups_participants/add").push();
            commands[$path("notifications/groups_participants/add", notification.key())] = {groupId : group.id, groupName : group.name, type : group.type, status : 'joined',
                id : user.$id, nickname : user.nickname, photo : user.photo, platforms : platforms, timestamp : Firebase.ServerValue.TIMESTAMP};

            $firebase().update(commands, function(err){
                if(err){
                    return $helper.toast($translate.instant("CANT_JOIN_GROUP"));
                }
                user = $helper.group.updateLocal(group);
                window.localStorage.setItem("user", JSON.stringify(user));

                $helper.toast($translate.instant("JOIN_ACTIVITY_SUCCESS"));
            });
        };
    })

    .controller('GroupOptionsController', function($scope, $stateParams, $ionicPopup, $ionicLoading, $ionicScrollDelegate, $state, $notifications,
                                                   $firebase, $path, $helper, $join, $translate) {
        var user = $join.user;
        $scope.groupId = $stateParams.groupId;
        $scope.type = $stateParams.type;

        $scope.$on('$ionicView.beforeEnter', function() {
            $scope.group = user.groups[$scope.type][$scope.groupId];

            $firebase("users", user.$id, "groups", $scope.type, $scope.groupId).once("value", function(snapshot){
                var remote = $helper.group.toLocal(snapshot.val());
                $helper.group.updateLocal(remote);
                $scope.group = remote;

                $scope.$apply();
            });
        });

        $scope.toggleSilent = function(){
            $firebase("users", user.id, "groups", $scope.type, $scope.group.id).update({ silent : $scope.group.silent}, function(){
                $helper.group.updateLocal($scope.group);
                $helper.toast($scope.group.silent ? $translate.instant("SILENT_ENABLE") : $translate.instant("SILENT_DISABLE"));
            });
        };
    })

    .controller('EditActivityController', function($scope, $stateParams, $ionicLoading, $state, $firebase, $path, $join, $helper, $translate) {
        var user = $join.user;
        $scope.groupId = $stateParams.groupId;
        $scope.type = $stateParams.type;

        $scope.$on('$ionicView.beforeEnter', function() {
            $firebase("groups", $scope.groupId).once("value", function(snapshot){
                $scope.activity = snapshot.val();
                $scope.activity.time = moment.duration(moment($scope.activity.timestamp).format("HH:mm:ss")).asMinutes();
                $scope.activity.timestamp = moment($scope.activity.timestamp).toDate();
                $scope.timeChange();

                $firebase("groups", $scope.activity.parent).once("value", function(snapshot){
                    if(snapshot.exists()){
                        $scope.group = snapshot.val();

                        $scope.activity.platforms = $scope.group.platforms.filter(function(p){
                            return p.name == $scope.activity.platforms[0].name && p.version == $scope.activity.platforms[0].version;
                        })[0];
                    }
                    $scope.$apply();
                });
            });
        });

        $scope.timeChange = function(){
            $scope.activity.displayTime = moment().startOf("day").add($scope.activity.time, 'm').format("HH:mm");
        };

        $scope.save = function(){
            var timestamp = moment($scope.activity.timestamp).startOf('day').add($scope.activity.time, 'm').utc().toISOString();
            $scope.activity.newTimestamp = timestamp;

            var commands = {};

            var activityName = $scope.activity.activity.name || $scope.activity.activity;
            var level = $scope.activity.level.name || $scope.activity.level;
            $scope.activity.platforms = [angular.copy($scope.activity.platforms)];

            commands[$path("groups", $scope.activity.id, "activity")] = activityName;
            commands[$path("groups", $scope.activity.id, "level")] = level;
            commands[$path("groups", $scope.activity.id, "players")] = $scope.activity.players;
            commands[$path("groups", $scope.activity.id, "timestamp")] = timestamp;
            commands[$path("groups", $scope.activity.id, "platforms")] = $scope.activity.platforms;

            commands[$path("commands/propagate_to_users/activity_change/", $scope.activity.id)] = { id : user.$id, nickname : user.nickname, activity : $scope.activity, timestamp : Firebase.ServerValue.TIMESTAMP };

            $firebase().update(commands, function(error){
                if(error){
                    return $helper.toast($translate.instant("UPDATE_ACTIVITY_ERROR"));
                }
                $helper.toast($translate.instant("DONE"));
                $state.go("group_chat", {'type':$scope.type, 'groupId' : $scope.groupId});
            });
        };

    })

;