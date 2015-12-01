var firebase = require('./app/firebase.connection');

firebase().authWithCustomToken(process.env.SECRET, function(error, data){
    console.log("starting application..");

    require("./app/push");

    require("./app/commands/notifications.groups_participants.add");
    require("./app/commands/notifications.groups_participants.banned");
    require("./app/commands/cache.user.info.and.groups");
    require("./app/commands/update.device_registration_id.on.firebase");
    require("./app/commands/cache.device_registration_id");
    require("./app/commands/unfollow.user");
    require("./app/commands/propagate_to_users.activity_change");

    require("./app/commands/cache.user_remove");
    require("./app/commands/users_searches.remove");
    require("./app/commands/groups_participants.remove");

    require("./app/events/notifications.confirmations.requests.added");
    require("./app/events/notifications.groups_participants.confirmed.added");
    require("./app/events/notifications.groups_participants.invites.added");
    require("./app/events/notifications.groups_participants.removed");
    require("./app/events/notifications.groups_participants.roster.priority.changed");
    require("./app/events/notifications.platforms.changed");
    require("./app/events/notifications.users.login.done");
    require("./app/events/notifications.users.device.change");

    require('./app/listeners/delivery.incoming.messages.to.participants');
    require('./app/listeners/flush.groups.unused.info.after.removed');
    require('./app/listeners/send.push.notification.when.activity.created');
    require('./app/listeners/send.push.notification.when.user.has.unread.messages');
    require('./app/listeners/set.invite.for.users.when.activity.created');
    require('./app/listeners/update.group.participants.counters');
    require('./app/listeners/update.groups.activities.counters');
    require('./app/listeners/update.groups.and.user.caches');
    require('./app/listeners/update.priority.of.participants');
    require('./app/listeners/users.searching.modification');

    require('./app/listeners/users.child_removed');

    console.log("all services started.");
});