angular.module('join.invite.controllers', [])

    .controller('AccountCtrl', function($scope) {
        $scope.settings = {
            enableFriends: true
        };
    })

    .controller('InviteCtrl', function($scope, $timeout, $ionicConfig, $ionicHistory, $ionicBackdrop, $ionicPopup, $ionicSlideBoxDelegate, $ionicScrollDelegate, $firebase, $ionicLoading, $path) {

        $scope.page = "selection";

        $scope.$on('$ionicView.beforeEnter', function(e) {
            $scope.backButtonClass = $ionicConfig.backButton.icon();
            $scope.backTitle = $ionicHistory.backTitle();

            $timeout(function(){
                $ionicSlideBoxDelegate.enableSlide(false);
                $ionicScrollDelegate.scrollTop();
                $ionicSlideBoxDelegate.update();
            },500);

            var user = JSON.parse(window.localStorage.getItem("user"));

            var loaded = 0;
            var totalGroups = Object.keys(user.groups.public).length + Object.keys(user.groups.private).length;

            $scope.publicGroups = [];
            $scope.privateGroups = [];

            var accumulate = function(array, snapshot){
                loaded += 1;
                if(snapshot.exists()){
                    var group = snapshot.val();
                    group.$id = snapshot.key();
                    array.push(group);
                }
                //$scope.refreshComplete(totalGroups, loaded);
            };

            for(var groupId in user.groups.public){
                $firebase("groups/public", groupId).once("value", function(snapshot){
                    accumulate($scope.publicGroups, snapshot);
                });
            }

            for(var groupId in user.groups.private){
                $firebase("groups/private", groupId).once("value", function(snapshot){
                    accumulate($scope.privateGroups, snapshot);
                });
            }

        });


        $scope.init = function(){
            $scope.game = {};
            $scope.invite = {date : new Date(), time : moment().format("HH:mm")};
            $scope.minimumDate = new Date();
            $scope.invite.rangeTime = moment.duration(moment().format("HH:mm:ss")).asMinutes();
        };

        $scope.back = function(){
            if($scope.page == "selection")
                return $ionicHistory.goBack();
            $scope.backOneSlide();
        };

        $scope.selectGroup = function(group){
            $ionicLoading.show({ template: '<p>Carregando...</p><ion-spinner icon="dots" class="spinner-positive"></ion-spinner>' });
            $scope.page = "config";

            $scope.init();
            $scope.group = group;
            $scope.invite.group = group;

            $ionicSlideBoxDelegate.next();
            $ionicScrollDelegate.scrollTop();

            $timeout(function(){
                $ionicSlideBoxDelegate.update();
                $ionicLoading.hide();
            },1000);
        };

        $scope.backOneSlide  = function(){
            $scope.page = "selection";
            $ionicScrollDelegate.scrollTop();
            $ionicSlideBoxDelegate.previous();
            $timeout(function(){
                $ionicSlideBoxDelegate.update();
            },500);
        };

        $scope.activitySelected  = function(){
            angular.forEach($scope.group.activities, function(value){
                if(value.id == $scope.invite.activity.id){
                    $scope.invite.players = value.players;
                    return false;
                }
            });
        };

        $scope.levelSelected  = function(){

        };

        $scope.playersChange = function(value){

        };

        $scope.timeChange = function(){
            $scope.invite.time = moment().startOf("day").add($scope.invite.rangeTime, 'm').format("HH:mm");
        };

        $scope.sendInvite  = function(){
            $scope.hasError = false;

            if(!$scope.invite.platform) {
                $scope.missingPlatform = true;
                $scope.hasError = true;
            } else{
                $scope.missingPlatform = false;
            }
            if(!$scope.invite.activity) {
                $scope.missingActivity = true;
                $scope.hasError = true;
            } else{
                $scope.missingActivity = false;
            }
            if(!$scope.invite.activity) {
                $scope.missingActivity = true;
                $scope.hasError = true;
            } else{
                $scope.missingActivity = false;
            }
            if(!$scope.invite.level) {
                $scope.missingLevel = true;
                $scope.hasError = true;
            }else{
                $scope.missingLevel = false;
            }
            if(!$scope.invite.players) {
                $scope.missingPlayers = true;
                $scope.hasError = true;
            }else{
                $scope.missingPlayers = false;
            }
            if(!$scope.invite.date || !$scope.invite.time) {
                $scope.missingDatetime = true;
                $scope.hasError = true;
            } else{
                $scope.missingDatetime = false;
            }

            if($scope.hasError){
                var alertPopup = $ionicLoading.show({
                    template: 'Alguma informaçao esta faltando.'
                });
                $timeout(function(){
                    $ionicLoading.hide();
                }, 2000);
                return;
            }

            $ionicLoading.show({
                template: '<p>Enviando convite...</p><ion-spinner icon="dots" class="spinner-positive"></ion-spinner>'
            });

            $scope.invite.activityType = $scope.invite.activity.name || $scope.invite.activity;
            $scope.invite.activityLevel = $scope.invite.level.name || $scope.invite.level;

            var activityDatetimeUTC = moment($scope.invite.date).startOf('day')
                .add($scope.invite.rangeTime, 'm').utc().toDate();

            var user = JSON.parse(window.localStorage.getItem("user"));
            var inserts = {};

            var firebase = $firebase();
            var ref = $firebase("groups/activity").push();

            inserts['groups/activity/' + ref.key()] = {
                activity : $scope.invite.activityType,
                level : $scope.invite.activityLevel,
                language : $scope.group.language || "Portugues",
                name : $scope.group.name,
                type : "activity",
                photo : $scope.group.photo,
                platforms : [$scope.invite.platform],
                text : "Grupo exclusivo para atividade",
                timestamp : activityDatetimeUTC,
                players : $scope.invite.players,
                parent : $scope.group.$id,
                owner : user.$id,
                totalParticipants : 0,
                registrationTimestamp : Firebase.ServerValue.TIMESTAMP
            };

            inserts["users/" + user.$id + "/groups/activity/" + ref.key()] = { silent : false};
            inserts["groups_participants/" + ref.key() + "/" + user.$id] = { id : user.$id, nickname : user.nickname, photo : user.photo, status : 'confirmed', ".priority" : Firebase.ServerValue.TIMESTAMP };
            var notification = $firebase("notifications", "groups_participants", "added").push();
            inserts[$path("notifications", "groups_participants", "added", notification.key())] = {groupId : ref.key(), groupName : $scope.group.name, userId : user.$id, nickname : user.nickname, timestamp : Firebase.ServerValue.TIMESTAMP};

            firebase.update(inserts, function (error) {
                $ionicLoading.hide();
                if(error){
                    $logger.error(error);
                    return $ionicPopup.alert({ title: 'Ops..', template: "Desculpe houve algum erro ao criar a atividade, verifique os dados e tente novamente." });
                }
                user.groups.activity[ref.key()] = { silent : false};
                window.localStorage.setItem("user", JSON.stringify(user));
                $ionicLoading.show({ template: 'Seu convite para essa atividade foi enviado para o grupo do jogo e um grupo especial foi criado somente para essa atividade.' });
                $timeout(function(){
                    $ionicLoading.hide();
                    $ionicSlideBoxDelegate.slide(0);
                    location.href = '#/tab/dash'
                },5000);
            });
        };

    })

;
