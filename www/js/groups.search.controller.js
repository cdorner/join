angular.module('join.groups.search', [])

    .controller('GroupAdvancedSearchCtrl', function($scope, $state, $ionicConfig, $ionicPopup, $ionicHistory, $path, $firebase) {
        $scope.$on('$ionicView.beforeEnter', function(e) {
            $scope.backButtonClass = $ionicConfig.backButton.icon();
            $scope.backTitle = $ionicHistory.backTitle();
            $scope.refresh();
        });

        $scope.refresh = function(){
            $scope.groups = [];
            $firebase("groups", "public").on("child_added", function(snapshot){
                var group = snapshot.val();
                group.$id = snapshot.key();
                $scope.groups.push(group);
                $scope.$broadcast('scroll.refreshComplete');
            });
        };

        $scope.new = function(){
            $state.go("create-group");
        };

        $scope.enter  = function(group){
            var user = JSON.parse(window.localStorage.getItem("user"));

            var inserts = {};
            inserts[$path("users", user.$id, "groups", "public", group.$id)] = { silent : false};
            inserts[$path("groups_participants", group.$id, user.$id)] = { id : user.$id, nickname : user.nickname, photo : user.photo, status : 'joined',
                ".priority" : Firebase.ServerValue.TIMESTAMP};
            var notification = $firebase("notifications", "groups_participants", "added").push();
            inserts[$path("notifications", "groups_participants", "added", notification.key())] = {groupId : group.$id, groupName : group.name, userId : user.$id, nickname : user.nickname, timestamp : Firebase.ServerValue.TIMESTAMP};

            $firebase().update(inserts, function(error){
                if(error) {
                    $logger.error(error);
                    return $ionicPopup.alert({ title: 'Ops...', template: 'Aconteceu algum problema, tente novamente.' });
                }

                user.groups.public[group.$id] = { silent : false};
                window.localStorage.setItem("user", JSON.stringify(user));

                $ionicPopup.alert({ title: 'Aviso', template: 'Voce entrou no grupo e agora pode participar do chat, receber e enviar convites de atividades.' })
                    .then(function(res){
                        $state.go("groups");
                    });
            });
        };
    })

    .controller('CreateGroupController', function($scope, $state, $ionicHistory, $ionicPopup, $ionicSlideBoxDelegate, $firebase, $firebaseArray) {
        $scope.$on('$ionicView.beforeEnter', function(e) {
            $ionicSlideBoxDelegate.enableSlide(false);
            $scope.init();
        });

        $scope.init = function(){
            $scope.subjects = [];
            $scope.subjects = $firebaseArray($firebase("group_subjects").orderByChild("name"));
        };

        $scope.select = function(subject){
            $scope.subject = subject;
            $scope.followers = [];
            $scope.group = {};
            $scope.platforms = subject.platforms;

            var user = JSON.parse(window.localStorage.getItem("user"));

            $firebaseArray($firebase("users_followers", user.$id, "following")).$loaded().then(function(list){
                list.forEach(function(snapshot){
                    var follower = snapshot;
                    follower.selected = false;
                    $scope.followers.push(follower);
                });
                $ionicSlideBoxDelegate.next();
            });
        };

        $scope.create = function(){
            if(!$scope.group.name) return $scope.message = "Ops... informe pelo menos um nome para seu grupo.";
            $scope.group.platforms = [];
            for (var i = 0;i < $scope.platforms.length;i++){
                if($scope.platforms[i].selected) {
                    var p = $scope.platforms[i];
                    $scope.group.platforms.push({name : p.name, vendor : p.vendor, version : p.version});
                }
            }
            if($scope.group.platforms.length == 0) return $scope.message = "Ops... informe pelo menos uma plataforma.";

            $scope.group.activities = $scope.subject.activities;
            $scope.group.levels = $scope.subject.levels;
            $scope.group.photo = $scope.subject.photo;
            $scope.group.totalActivities = 0;
            $scope.group.totalParticipants = 0;
            $scope.group.registrationTimestamp = Firebase.ServerValue.TIMESTAMP;
            $scope.group.type = "private";

            var user = JSON.parse(window.localStorage.getItem("user"));

            var ref = $firebase();
            var newGroupRef = ref.child("groups").push();

            var creation = {};
            creation["groups/private/" + newGroupRef.key()] = $scope.group;
            creation["groups_participants/" + newGroupRef.key() + "/" + user.$id] = {id : user.$id, nickname : user.nickname, photo : user.photo, status : "confirmed", ".priority" : Firebase.ServerValue.TIMESTAMP};
            var groupConfiguration = {silent : false};
            creation["users/" + user.$id + "/groups/private/" + newGroupRef.key()] = groupConfiguration;

            for (var i = 0; i < $scope.followers.length; i++) {
                if($scope.followers[i].selected){
                    var follower = $scope.followers[i];
                    creation["groups_participants/" + newGroupRef.key() + "/" + follower.$id] = {id : follower.$id, nickname : follower.nickname, photo : follower.photo, status : "joined", ".priority" : Firebase.ServerValue.TIMESTAMP};
                    creation["users/" + follower.$id + "/groups/private/" + newGroupRef.key()] = {enable : true, silent : false, private : true};
                }
            }

            ref.update(creation, function(error){
                if(error) return $ionicPopup.alert({ title: 'Aviso', template: 'Ocorreu algum problema para criar o grupo.' });

                user.groups.private[newGroupRef.key()] = groupConfiguration;
                window.localStorage.setItem("user", JSON.stringify(user));

                $scope.group = {};

                $scope.showMessageWhenCreateFinish(newGroupRef.key());
            });
        };

        $scope.showMessageWhenCreateFinish = function(groupId){
            $ionicPopup.alert({ title: 'Aviso', template: 'Grupo foi criado, e seus amigos foram adicionados nele.' })
                .then(function(res){
                    $ionicHistory.nextViewOptions({
                        disableBack: true
                    });
                    $state.go("groups");
                });
        };

        $scope.back = function(){
            if($ionicSlideBoxDelegate.currentIndex() == 0)
                return $ionicHistory.goBack();
            $ionicSlideBoxDelegate.previous();
        };
    })

;