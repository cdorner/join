angular.module('join.groups.options', [])

    .controller('GroupParticipantesController', function($scope, $stateParams, $ionicPopup, $ionicPopover, $ionicModal, $ionicLoading,
                                                         $ionicScrollDelegate, $state, $notifications, $firebase, $path, $firebaseArray) {
        $scope.participantes = [];
        $scope.moreParticipantes = false;
        $scope.participantesPriority = new Date(1000).getTime();

        $scope.groupId = $stateParams.groupId;
        $scope.type = $stateParams.type;

        var user = JSON.parse(window.localStorage.getItem("user"));

        $scope.$on('$ionicView.beforeEnter', function() {
            var user = JSON.parse(window.localStorage.getItem("user"));

            $firebase($path("groups", $scope.type, $scope.groupId)).once("value", function(snapshot){
                $scope.group = snapshot.val();
                $scope.group.$id = snapshot.key();

                $scope.loadParticipantes();
            });

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

        $scope.openPopover = function(participante, $event) {
            $scope.participante = participante;
            $scope.popover.show($event);
        };

        $scope.$on('popover.hidden', function() {
            $scope.participante = null;
        });

        $scope.showFriends = function() {
            var user = JSON.parse(window.localStorage.getItem("user"));
            $scope.followings = $firebaseArray($firebase("users_followers", user.$id, "following").orderByChild("nickname"));
            $scope.followers = $firebaseArray($firebase("users_followers", user.$id, "followers").orderByChild("nickname"));

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
            var selectionfollowers = $scope.followers.filter(function(f){
                return f.invite;
            });

            var commands = {};
            selectionFollowings.forEach(function(f){
                commands[$path("users", f.id, "groups", "invite", $scope.groupId)] = {type : $scope.type, silent : false};
                commands[$path("groups", $scope.type, $scope.groupId, "banned", f.id)] = null;
                commands[$path("notifications/groups/invites", $scope.groupId, f.id)] = { id : f.id, nickname : f.nickname, timestamp : Firebase.ServerValue.TIMESTAMP };
            });
            selectionfollowers.forEach(function(f){
                commands[$path("users", f.id, "groups", "invite", $scope.groupId)] = {type : $scope.type, silent : false};
                commands[$path("groups", $scope.type, $scope.groupId, "banned", f.id)] = null;
                commands[$path("notifications/groups/invites", $scope.groupId, f.id)] = { id : f.id, nickname : f.nickname, timestamp : Firebase.ServerValue.TIMESTAMP };
            });

            $firebase().update(commands, function(error){
                $ionicLoading.show({ template: "Convite enviado.", noBackdrop: true, duration: 1500 });
                $scope.closeModal();
            });
        };

        $scope.loadParticipantes = function(){
            $firebase("groups_participants", $scope.groupId).startAt($scope.participantesPriority + 10000).limitToFirst(15).once("value", function(snapshot){
                $scope.moreParticipantes = snapshot.exists();
                snapshot.forEach(function(p){
                    $scope.participantes.push(p.val());
                    $scope.participantesPriority = p.getPriority();

                });
                $scope.loaded = true;
                $scope.$apply();
                $scope.$broadcast('scroll.infiniteScrollComplete');
            });
        };

        $scope.hasMoreParticipantes = function(){
            return $scope.moreParticipantes;
        };

        $scope.follow = function(){
            var participant = $scope.participante;
            var user = JSON.parse(window.localStorage.getItem("user"));
            var commands = {};

            commands[$path("users_followers", user.$id, "following", participant.id)] = { id : participant.id, nickname : participant.nickname, photo : participant.photo, timestamp : Firebase.ServerValue.TIMESTAMP };
            commands[$path("users_followers", participant.id, "followers", user.$id)] = { id : user.$id, nickname : user.nickname, photo : user.photo, timestamp : Firebase.ServerValue.TIMESTAMP };

            $firebase().update(commands, function(error){
                $ionicLoading.show({ template: "Adicionado.", noBackdrop: true, duration: 1500 });
            });
        };

        $scope.kickPlayer = function(){
            $ionicPopup.confirm({ title: 'Aviso', template: "Excluir "+ $scope.participante.nickname + "?"}).then(function(res){
                if(res){
                    var user = JSON.parse(window.localStorage.getItem("user"));

                    var commands = {};
                    commands[$path("users", $scope.participante.id, "groups", $scope.type, $scope.group.$id)] = null;
                    commands[$path("users", $scope.participante.id, "groups", "invite", $scope.group.$id)] = null;
                    commands[$path("groups", $scope.group.type, $scope.group.$id, "banned", $scope.participante.id)] = { enable : true};
                    commands[$path("groups_participants", $scope.group.$id, $scope.participante.id)] = null;
                    var message = $firebase("groups_conversation", $scope.group.$id).push();
                    commands[$path("groups_conversation", $scope.group.$id, message.key())] = {
                        sender : {id : user.id, nickname : user.nickname},
                        timestamp : moment.utc().toISOString(),
                        kick : { id : $scope.participante.id},
                        chat : {value : $scope.participante.nickname + " removido."}
                    };
                    var notification = $firebase("notifications", "groups_participants", "removed").push();
                    commands[$path("notifications", "groups_participants", "removed", notification.key())] = {groupId : $scope.group.$id, groupName : $scope.group.name,
                        userId : $scope.participante.id, nickname : $scope.participante.nickname, timestamp : Firebase.ServerValue.TIMESTAMP};
                    $firebase().update(commands, function(){
                        var index = $scope.participantes.indexOf($scope.participante);
                        $scope.participantes.splice(index, 1);
                        $ionicLoading.show({ template: "Feito.", noBackdrop: true, duration: 1500 });
                        $scope.popover.hide();
                    });
                }
            });
        };

        $scope.requestConfirmation = function(){
            var participants = [];
            if($scope.participante) {
                participants.push($scope.participante);
            } else{
                $scope.participantes.forEach(function(p){
                    participants.push(p);
                });
            }
            var commands = {};
            participants.forEach(function(p){
                commands[$path("notifications/confirmations/requests", $scope.groupId, p.id)] = { timestamp : Firebase.ServerValue.TIMESTAMP };
                commands[$path("groups_participants", $scope.groupId, p.id, "confirmation")] = "requested";
            });
            $firebase().update(commands, function(error){
                participants.forEach(function(p){
                    p.confirmation = "requested";
                });
                $ionicLoading.show({ template: "Confirmação enviada.", noBackdrop: true, duration: 1500 });
            });
        };

        $scope.out = function(){
            $ionicPopup.confirm({ title: 'Aviso', template: 'Deseja sair do grupo?'}).then(function(res){
                if(res){
                    var user = JSON.parse(window.localStorage.getItem("user"));
                    var commands = {};
                    commands[$path("users", user.$id, "groups", $scope.type, $scope.group.$id)] = null;
                    commands[$path("groups_participants", $scope.group.$id, user.$id)] = null;
                    var notification = $firebase("notifications", "groups_participants", "removed").push();
                    commands[$path("notifications", "groups_participants", "removed", notification.key())] = {groupId : $scope.group.$id, groupName : $scope.group.name, userId : user.$id, nickname : user.nickname, timestamp : Firebase.ServerValue.TIMESTAMP};
                    $firebase().update(commands, function(){
                        delete user.groups[$scope.type][$scope.group.$id];
                        window.localStorage.setItem("user", JSON.stringify(user));

                        $ionicPopup.alert({ title: 'Aviso', template: 'Voce nao faz mais parte desse grupo.'}).then(function(){
                            if($scope.type == "activity") $state.go("dash")
                            else $state.go("groups")
                        });
                    });
                }
            });
        };

        $scope.owner = function(){
            return $scope.group && user.$id == $scope.group.owner;
        };
    })

    .controller('GroupSubordinatesController', function($scope, $stateParams, $ionicPopup, $ionicLoading, $state, $firebase, $path) {
        $scope.groupId = $stateParams.groupId;
        $scope.type = $stateParams.type;

        $scope.subordinates = [];
        $scope.moreSubordinates = false;
        $scope.subordinatesPriority = null;

        $scope.$on('$ionicView.beforeEnter', function(e) {

            var user = JSON.parse(window.localStorage.getItem("user"));

            $firebase("groups", $scope.type, $scope.groupId).once("value", function(snapshot){
                $scope.group = snapshot.val();
                $scope.group.$id = snapshot.key();

                $scope.loadSubordinates();
            });

        });

        $scope.loadSubordinates = function(){
            var ref = $firebase("groups_activities", $scope.groupId).orderByKey();
            if($scope.subordinatesPriority)
                ref = ref.startAt($scope.subordinatesPriority);
            ref.limitToFirst(10).once("value", function(snapshot){
                $scope.moreSubordinates = snapshot.exists();
                snapshot.forEach(function(p){
                    if($scope.subordinatesPriority != p.key()){
                        $scope.subordinatesPriority = p.key();

                        $firebase("groups", "activity", p.key()).once("value", function(g){
                            var group = g.val();
                            group.$id = g.key();
                            $scope.subordinates.push(group);

                            $scope.$apply();
                        });
                    }
                });
            });
        };

        $scope.hasMoreSubordinates = function(){
            return $scope.moreSubordinates;
        };

        $scope.join = function(group){
            var user = JSON.parse(window.localStorage.getItem("user"));
            var commands = {};
            commands[$path("users", user.$id, "groups", "activity", group.$id)] = null;
            commands[$path("groups_participants", group.$id, user.$id)] = null;
            var notification = $firebase("notifications", "groups_participants", "added").push();
            commands[$path("notifications", "groups_participants", "added", notification.key())] = {groupId : group.$id, groupName : group.name, userId : user.$id, nickname : user.nickname, timestamp : Firebase.ServerValue.TIMESTAMP};

            $firebase().update(commands, function(err){
                if(err){
                    $ionicLoading.show({ template: "Desculpe, nao foi possivel dar join nesse grupo", noBackdrop: true, duration: 1500 });
                }
                $ionicLoading.show({ template: "Voce agora participa desse grupo", noBackdrop: true, duration: 1500 });
            });
        };

        $scope.out = function(){
            $ionicPopup.confirm({ title: 'Aviso', template: 'Deseja sair do grupo?'}).then(function(res){
                if(res){
                    var user = JSON.parse(window.localStorage.getItem("user"));
                    var commands = {};
                    commands[$path("users", user.$id, "groups", $scope.type, $scope.group.$id)] = null;
                    commands[$path("groups_participants", $scope.group.$id, user.$id)] = null;
                    var notification = $firebase("notifications", "groups_participants", "removed").push();
                    commands[$path("notifications", "groups_participants", "removed", notification.key())] = {groupId : $scope.group.$id, groupName : $scope.group.name, userId : user.$id, nickname : user.nickname, timestamp : Firebase.ServerValue.TIMESTAMP};

                    $firebase().update(commands, function(){
                        delete user.groups[$scope.type][$scope.group.$id];
                        window.localStorage.setItem("user", JSON.stringify(user));

                        $ionicPopup.alert({ title: 'Aviso', template: 'Voce nao faz mais parte desse grupo.'}).then(function(){
                            if($scope.type == "activity") $state.go("dash")
                            else $state.go("groups")
                        });
                    });
                }
            });
        };
    })

    .controller('GroupOptionsController', function($scope, $stateParams, $ionicPopup, $ionicLoading, $ionicScrollDelegate, $state, $notifications, $firebase, $path) {
        $scope.groupId = $stateParams.groupId;
        $scope.type = $stateParams.type;

        $scope.$on('$ionicView.beforeEnter', function(e) {
            var user = JSON.parse(window.localStorage.getItem("user"));

            $firebase($path("groups", $scope.type, $scope.groupId)).once("value", function(snapshot){
                $scope.group = snapshot.val();
                $scope.group.$id = snapshot.key();
                if(user.groups[$scope.type][snapshot.key()])
                    $scope.group.silent = user.groups[$scope.type][snapshot.key()].silent;
                $scope.$apply();
            });
        });

        $scope.toogleSilent = function(){
            var user = JSON.parse(window.localStorage.getItem("user"));

            $firebase("users", user.id, "groups", $scope.type, $scope.group.$id).update({ silent : $scope.group.silent}, function(){
                user.groups[$scope.type][$scope.group.$id].silent = $scope.group.silent;
                window.localStorage.setItem("user", JSON.stringify(user));

                $ionicLoading.show({ template: $scope.group.silent ? "Grupo Silenciado." : "Grupo habilitado para notificaçao", noBackdrop: true, duration: 1500 });
            });
        };

        $scope.out = function(){
            $ionicPopup.confirm({ title: 'Aviso', template: 'Deseja sair do grupo?'}).then(function(res){
                if(res){
                    var user = JSON.parse(window.localStorage.getItem("user"));
                    var commands = {};
                    commands[$path("users", user.$id, "groups", $scope.type, $scope.group.$id)] = null;
                    commands[$path("groups_participants", $scope.group.$id, user.$id)] = null;
                    var notification = $firebase("notifications", "groups_participants", "removed").push();
                    commands[$path("notifications", "groups_participants", "removed", notification.key())] = {groupId : $scope.group.$id, groupName : $scope.group.name, userId : user.$id, nickname : user.nickname, timestamp : Firebase.ServerValue.TIMESTAMP};

                    $firebase().update(commands, function(){
                        delete user.groups[$scope.type][$scope.group.$id];
                        window.localStorage.setItem("user", JSON.stringify(user));

                        $ionicPopup.alert({ title: 'Aviso', template: 'Voce nao faz mais parte desse grupo.'}).then(function(){
                            if($scope.type == "activity") $state.go("dash")
                            else $state.go("groups")
                        });
                    });
                }
            });
        };

    })

    .controller('EditActivityController', function($scope, $stateParams, $ionicLoading, $state, $firebase, $path) {
        $scope.groupId = $stateParams.groupId;
        $scope.type = $stateParams.type;

        $scope.$on('$ionicView.beforeEnter', function(e) {
            var user = JSON.parse(window.localStorage.getItem("user"));

            $firebase("groups", $scope.type, $scope.groupId).once("value", function(snapshot){
                $scope.activity = snapshot.val();
                $scope.activity.$id = snapshot.key();
                $scope.activity.time = moment.duration(moment($scope.activity.timestamp).format("HH:mm:ss")).asMinutes();
                $scope.activity.timestamp = moment($scope.activity.timestamp).toDate();
                $scope.timeChange();

                async.waterfall([
                        function tryPrivate(callback){
                            $firebase("groups", "private", $scope.activity.parent).once("value", function(snapshot){
                                if(snapshot.exists()){
                                    $scope.group = snapshot.val();
                                    $scope.group.$id = snapshot.key();
                                }
                                callback(null, $scope.group);
                            });
                        },
                        function tryPublic(group, callback){
                            if(group) return callback(null);
                            $firebase("groups", "public", $scope.activity.parent).once("value", function(snapshot){
                                if(snapshot.exists()){
                                    $scope.group = snapshot.val();
                                    $scope.group.$id = snapshot.key();
                                }
                                callback(404);
                            });
                        }
                ], function(err){
                    if (err == 404){

                    }
                    $scope.$apply();
                });


            });
        });

        $scope.timeChange = function(){
            $scope.activity.displayTime = moment().startOf("day").add($scope.activity.time, 'm').format("HH:mm");
        };

        $scope.save = function(){
            var user = JSON.parse(window.localStorage.getItem("user"));

            var timestamp = moment($scope.activity.timestamp).startOf('day').add($scope.activity.time, 'm').utc().toISOString();
            var commands = {};

            var activityName = $scope.activity.activity.name || $scope.activity.activity;
            var level = $scope.activity.level.name || $scope.activity.level;

            commands[$path("groups", $scope.type, $scope.activity.$id, "activity")] = activityName;
            commands[$path("groups", $scope.type, $scope.activity.$id, "level")] = level;
            commands[$path("groups", $scope.type, $scope.activity.$id, "players")] = $scope.activity.players;
            commands[$path("groups", $scope.type, $scope.activity.$id, "timestamp")] = timestamp;
            commands[$path("groups", $scope.type, $scope.activity.$id, "platforms/0")] = $scope.activity.platform;
            var chatMessage = $firebase("groups_conversation", $scope.activity.$id).push();
            commands[$path("groups_conversation", $scope.activity.$id, chatMessage.key())] = {
                chat : {value : "Pessoal, alterei a atividade agora ela é uma "
                            + activityName +" level "+ level + " e vai ocorrer em " + moment($scope.activity.timestamp).format("lll")
                    + " no "+ $scope.activity.platform.name + " " + $scope.activity.platform.version},
                sender : {id : user.$id, nickname : user.nickname},
                timestamp : Firebase.ServerValue.TIMESTAMP
            };

            $firebase().update(commands, function(error){
                if(error){
                    return $ionicLoading.show({ template: "Desculpe, nao foi possivel atualizar a atividade", noBackdrop: true, duration: 1500 });
                }
                $ionicLoading.show({ template: "Feito", noBackdrop: true, duration: 1500 });
                $state.go("group_chat", {'type':$scope.type, 'groupId' : $scope.groupId});
            });
        };

    })

;