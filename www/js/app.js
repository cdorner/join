// Ionic Starter App

// angular.module is a global place for creating, registering and retrieving Angular modules
// 'starter' is the name of this angular module example (also set in a <body> attribute in index.html)
// the 2nd parameter is an array of 'requires'
// 'starter.services' is found in services.js
// 'starter.controllers' is found in controllers.js
angular.module('join', ['ionic', 'firebase', 'pascalprecht.translate',
        'database.services',
        'join.messages',
        'login.controllers',
        'join.groups.active',
        'join.groups.search',
        'join.groups.chat',
        'join.groups.options',
        'join.engaged.groups',
        'join.invite.controllers',
        'join.contacts.controllers'
    ])

    .run(function($ionicPlatform, $state, $pushRegistration, $database, $messageListener, $translate) {
        $ionicPlatform.ready(function() {
            // Hide the accessory bar by default (remove this to show the accessory bar above the keyboard
            // for form inputs)
            if (window.cordova && window.cordova.plugins && window.cordova.plugins.Keyboard) {
                cordova.plugins.Keyboard.hideKeyboardAccessoryBar(true);
                cordova.plugins.Keyboard.disableScroll(true);

                window.plugin.notification.local.registerPermission(function (granted) {
                    // console.log('Permission has been granted: ' + granted);
                });

                window.plugin.notification.local.on("click", function (notification, state) {
                    if(notification.data){
                        var data = JSON.parse(notification.data);
                        if(data.groupId && data.type) $state.go("group_chat", {groupId : data.groupId, type : data.type}, { reload: true });
                     }
                }, this);

                if(navigator.globalization){
                    navigator.globalization.getPreferredLanguage(function(language){
                        // could be en, en-US
                        if(language.value.toLowerCase().indexOf("pt") != -1){
                            window.localStorage.setItem("language", "pt-BR");
                            $translate.use(language.value);
                        } else {
                            window.localStorage.setItem("language", "en");
                            $translate.use(language.value);
                        }
                    }, function(){
                        console.error("Error getting language");
                    });
                }
            }
            if (window.StatusBar) {
                // org.apache.cordova.statusbar required
                StatusBar.styleLightContent();
            }


            $database.flushMessagesPrior(3);

            var onResume = function(){
                var attempts = 0;
                var retries = setInterval(function(){
                    attempts += 1;
                    if(attempts >= 3){
                        clearInterval(retries);
                    }

                    if(window.localStorage.getItem("invite")){
                        clearInterval(retries);
                        $state.go("onPushInvite", {}, { reload: true });
                    } else if(window.localStorage.getItem("chat")){
                        clearInterval(retries);
                        var chat = JSON.parse(window.localStorage.getItem("chat"));
                        window.localStorage.removeItem("chat");
                        switch(chat.command) {
                            case "open":
                                $state.go("group_chat", {groupId : chat.groupId, type : chat.type}, { reload: true });
                                break;
                            default:
                                window.localStorage.removeItem("chat");
                        }
                    }
                }, 2000);

                var user = JSON.parse(window.localStorage.getItem("user"));
                $messageListener.start(user);
                $pushRegistration.update();
            }

            onResume();
            document.addEventListener("resume", onResume, false);

            document.addEventListener("backbutton", onBackKeyDown, false);

            function onBackKeyDown() {
                var location = document.location.hash;
                if(location.indexOf("#/tab/dash") == 0 || location.indexOf("#/tab/groups") == 0){
                    navigator.app.exitApp();
                }
            }

            var user = JSON.parse(window.localStorage.getItem("user"));
            $messageListener.start(user);
        });
    })

    .config(function($stateProvider, $urlRouterProvider, $ionicConfigProvider, $translateProvider) {
        $ionicConfigProvider.tabs.position('bottom');
        // Cache is disable due a problem with chats
        $ionicConfigProvider.views.maxCache(0);

        $translateProvider.useStaticFilesLoader({
            prefix: './languages/',
            suffix: '.json'
        });

        var preferredLanguage = "pt-BR";
        $translateProvider.preferredLanguage(preferredLanguage);
        window.localStorage.setItem("language", preferredLanguage);

        // Ionic uses AngularUI Router which uses the concept of states
        // Learn more here: https://github.com/angular-ui/ui-router
        // Set up the various states which the app can be in.
        // Each state's controller can be found in controllers.js
        $stateProvider

            .state('scaffold', {
                abstract: true,
                templateUrl: "index.html"
            })

            .state('login', {
                url: '/login',
                templateUrl: "templates/login.html",
                controller: 'LoginController'
            })

            .state('register', {
                url: '/register',
                templateUrl: 'templates/register.html',
                controller: 'LoginController'
            })

            .state('onPushInvite', {
                url: '/on-push-invite',
                templateUrl: 'templates/on-push.html',
                controller: 'OnPushNotificationController'
            })


            // setup an abstract state for the tabs directive
            .state('tab', {
                url: '/tab',
                abstract: true,
                parent: "scaffold",
                templateUrl: 'templates/tabs.html'
            })

            // Each tab has its own nav history stack:

            .state('dash', {
                url: '/dash',
                parent: "tab",
                views: {
                    'tab-dash': {
                        templateUrl: 'templates/tab-dash.html',
                        controller: 'ActiveGroupsController'
                    }
                }
            })

            .state('active_group', {
                url: '/:type/:groupId',
                parent: "dash",
                views: {
                    'tab-dash@tab': {
                        templateUrl: 'templates/chat.html',
                        controller: 'GroupChatController'
                    }
                }
            })

            .state('active_group_chat_options', {
                url: '/options',
                parent: "active_group",
                views: {
                    'tab-dash@tab': {
                        templateUrl: 'templates/group-options.html',
                        controller: 'ChatOptionsController'
                    }
                }
            })

            .state('groups', {
                url: '/groups',
                parent: "tab",
                views: {
                    'tab-groups': {
                        templateUrl: 'templates/tab-groups.html',
                        controller: 'GroupsEngagedController'
                    }
                }
            })

            .state('group_chat', {
                url: 'group/:type/:groupId',
                templateUrl: 'templates/chat.html',
                controller: 'GroupChatController'
            })

            .state('group_options', {
                url: 'group/:type/:groupId/options',
                templateUrl: 'templates/group-options.html',
                controller: 'GroupOptionsController'
            })

            .state('group_participantes', {
                url: 'group/:type/:groupId/participantes',
                templateUrl: 'templates/group-participantes.html',
                controller: 'GroupParticipantesController'
            })

            .state('group_subordinates', {
                url: 'group/:type/:groupId/subordinates',
                templateUrl: 'templates/group-subordinates.html',
                controller: 'GroupSubordinatesController'
            })

            .state('edit_activity', {
                url: 'group/:type/:groupId/edit',
                templateUrl: 'templates/edit-activity.html',
                controller: 'EditActivityController'
            })

            .state('contacts', {
                url: '/contacts',
                parent: "tab",
                views: {
                    'tab-contacts': {
                        templateUrl: 'templates/tab-contacts.html',
                        controller: 'ContactsController'
                    }
                }
            })

            .state('group-advanced-search', {
                url: '/groups/search',
                templateUrl: 'templates/advanced-search.html',
                controller: 'GroupAdvancedSearchCtrl'
            })

            .state('create-group', {
                url: '/create',
                templateUrl: 'templates/create-group.html',
                controller: 'CreateGroupController'
            })

            .state('group-invite', {
                url: '/invite',
                templateUrl: 'templates/invite-group.html',
                controller: 'InviteCtrl'
            })

            .state('change-password', {
                url: '/change-password',
                templateUrl: 'templates/change-password.html',
                controller: 'ChangePasswordController'
            })

            .state('exclude-credential', {
                url: '/exclude-credential',
                templateUrl: 'templates/exclude-credential.html',
                controller: 'ExcludeCredentialController'
            })
        ;

        // if none of the above states are matched, use this as the fallback
        $urlRouterProvider.otherwise('/login');

    });
