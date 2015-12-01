angular.module('join.invite.controllers', [])

    .controller('InviteCtrl', function($scope, $timeout, $ionicConfig, $ionicHistory, $ionicBackdrop, $ionicPopup, $ionicSlideBoxDelegate, $helper,
                                       $ionicScrollDelegate, $firebase, $ionicLoading, $path, $logger, $join, $translate) {
        var user = $join.user;
        var possibleMinutes = [0, 10, 20, 30, 40, 50];

        $scope.page = "selection";

        $scope.$on('$ionicView.beforeEnter', function(e) {
            $scope.backButtonClass = $ionicConfig.backButton.icon();
            $scope.backTitle = $ionicHistory.backTitle();

            $timeout(function(){
                $ionicSlideBoxDelegate.enableSlide(false);
                $ionicScrollDelegate.scrollTop();
                $ionicSlideBoxDelegate.update();
            },500);

            $scope.load();
        });

        $scope.load = function(){
            var totalGroups = Object.keys(user.groups.public).length + Object.keys(user.groups.private).length;

            $scope.publicGroups = [];
            $scope.privateGroups = [];

            var accumulate = function(array, group){
                array.push(group);
            };

            async.forEachOf(user.groups.public, function(value, groupId, callback){
                $scope.publicGroups.push(value);
                callback();
            }, function(){
                async.forEachOf(user.groups.private, function(value, groupId, callback){
                    $scope.privateGroups.push(value);
                    callback();
                }, function(){
                    $scope.pageLoaded = true;
                    $scope.$broadcast('scroll.refreshComplete');
                });
            });
        };

        $scope.refresh = function(){
            async.series([
                function refreshPrivate(callback){
                    $firebase("users", user.$id, "groups/private").once("value", function(snapshot){
                        snapshot.forEach(function(value){
                            user.groups.private[value.key()] = $helper.group.toLocal(value.val());
                        });
                        callback();
                    });
                },

                function refreshPublic(callback){
                    $firebase("users", user.$id, "groups/public").once("value", function(snapshot){
                        snapshot.forEach(function(value){
                            user.groups.public[value.key()] = $helper.group.toLocal(value.val());
                        });
                        callback();
                    });
                },
            ], function(){
                window.localStorage.setItem("user", JSON.stringify(user));
                $scope.load();
            });
        };

        $scope.init = function(){
            $scope.game = {};
            $scope.invite = {date : new Date()};
            $scope.minimumDate = new Date();

            var minutes = Math.round(moment.duration(moment().format("HH:mm:ss")).asMinutes());
            while(possibleMinutes.indexOf(minutes % 60) == -1){
                minutes++;
            }
            $scope.invite.rangeTime = minutes;
            $scope.invite.time = moment().startOf('day').add(minutes, 'm').format("HH:mm");
        };

        $scope.back = function(){
            if($scope.page == "selection")
                return $ionicHistory.goBack();
            $scope.backOneSlide();
        };

        $scope.selectGroup = function(group){
            $ionicLoading.show({ template: '<p>'+ $translate.instant('LOADING') +'...</p><ion-spinner icon="dots" class="spinner-positive"></ion-spinner>' });
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
                    $scope.invite.players = parseInt(value.players);
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
                var alertPopup = $ionicLoading.show({ template: $translate.instant('SOME_INFO_IS_MISSING') });
                $timeout(function(){
                    $ionicLoading.hide();
                }, 2000);
                return;
            }

            $ionicLoading.show({
                template: '<p>' + $translate.instant('SENDING_INVITE') + '...</p><ion-spinner icon="dots" class="spinner-positive"></ion-spinner>'
            });

            $scope.invite.activityType = $scope.invite.activity.name || $scope.invite.activity;
            $scope.invite.activityLevel = $scope.invite.level.name || $scope.invite.level;

            var activityDatetimeUTC = moment($scope.invite.date).startOf('day')
                .add($scope.invite.rangeTime, 'm').utc().toDate();

            var user = JSON.parse(window.localStorage.getItem("user"));

            var inserts = {};

            var ref = $firebase("groups").push();

            var activity = {
                id : ref.key(),
                activity : $scope.invite.activityType,
                level : $scope.invite.activityLevel,
                language : $scope.group.language || "Portugues",
                name : $scope.group.name,
                type : "activity",
                photo : $scope.group.photo,
                platforms : [$scope.invite.platform],
                text : $translate.instant('ACTIVITY_EXCLUSIVE_GROUP'),
                timestamp : activityDatetimeUTC,
                players : $scope.invite.players,
                parent : $scope.group.id,
                owner : user.$id,
                totalParticipants : 0,
                registrationTimestamp : Firebase.ServerValue.TIMESTAMP
            };
            inserts[$path('groups', ref.key())] = activity;
            inserts[$path("users", user.$id, "groups/activity", ref.key())] = activity;

            $firebase().update(inserts, function (error) {
                if(error){
                    $ionicLoading.hide();
                    $logger.error(error);
                    return $ionicPopup.alert({ title: $translate.instant('OPS'), template: $translate.instant('ERROR_CREATING_ACTIVITY') });
                }
                var notification = {};
                var key = $firebase("notifications/groups_participants/add").push();
                notification[$path("notifications/groups_participants/add", key.key())] = {groupId : activity.id, type : "activity", id : user.$id, nickname : user.nickname,
                    photo : user.photo, status : "confirmed", timestamp : Firebase.ServerValue.TIMESTAMP};

                $firebase().update(notification, function (error) {
                    $ionicLoading.hide();

                    $helper.group.updateLocal(activity);
                    $ionicLoading.show({ template: $translate.instant('ACTIVITY_CREATED_MESSAGE') });
                    $timeout(function(){
                        $ionicLoading.hide();
                        $ionicSlideBoxDelegate.slide(0);
                        location.href = '#/tab/dash'
                    },5000);
                });
            });
        };

    })

;
