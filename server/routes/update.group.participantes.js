var Firebase = require("firebase");
var firebaseUrl = require('./join.firebase');

new Firebase(firebaseUrl + "/groups_participants").on("child_added", function(snapshot){

    new Firebase(firebaseUrl + "/groups_participants/" + snapshot.key()).on("child_added", function(value){
        update(this.groupId, value);
    }, {groupId : snapshot.key()});

    new Firebase(firebaseUrl + "/groups_participants/" + snapshot.key()).on("child_removed", function(value){
        update(this.groupId, value, "removed");
    }, {groupId : snapshot.key()});
});

var update = function(groupId, participant, removed){
    var p = participant.val();
    if(!p.version || removed){
        if(!removed) new Firebase(participant.ref().toString()).update({ version : 1});
        p.removed = removed;
        var groups = new Firebase(firebaseUrl + "/groups");

        var public = groups.child("public/"+ groupId);
        var private = groups.child("private/"+ groupId);
        var activity = groups.child("activity/"+ groupId);

        public.once("value", function(snapshot){
            if(snapshot.exists()){
                if(this.removed)
                    decrementParticipant(snapshot, this);
                else
                    incrementParticipant(snapshot, this);
            }
        }, p);

        private.once("value", function(snapshot){
            if(snapshot.exists()){
                if(this.removed)
                    decrementParticipant(snapshot, this);
                else
                    incrementParticipant(snapshot, this);
            }
        }, p);

        activity.once("value", function(snapshot){
            if(snapshot.exists()){
                if(this.removed)
                    decrementParticipant(snapshot, this);
                else
                    incrementParticipant(snapshot, this);
            }
        }, p);
    }
};

var incrementParticipant = function(snapshot, participant){
    var totalParticipants = new Firebase(snapshot.ref().toString() + "/totalParticipants");
    totalParticipants.transaction(function(currentParticipants) {
        return (currentParticipants || 0) + 1;
    }, function(error, committed, snapshot) {

    });

    var with_ = new Firebase(snapshot.ref().toString() + "/with");
    with_.transaction(function(currentWith) {
        currentWith = currentWith || "";
        if(currentWith.indexOf(participant.nickname) == -1){
            return currentWith.trim() + " @"+participant.nickname;
        }
        return currentWith.trim();
    });
};

var decrementParticipant = function(snapshot, participant){
    var totalParticipants = new Firebase(snapshot.ref().toString() + "/totalParticipants");
    totalParticipants.transaction(function(currentParticipants) {
        if(currentParticipants == 0) return currentParticipants;
        return (currentParticipants || 0) - 1;
    }, function(error, committed, snapshot){
        if (!error && committed) {
            if(snapshot.val() == 0){
                removeGroupIfNecessary(snapshot.ref().toString().replace("/totalParticipants", ""));
            }
        }
    });

    var with_ = new Firebase(snapshot.ref().toString() + "/with");
    with_.transaction(function(currentWith) {
        currentWith = currentWith || "";
        if(currentWith.indexOf(participant.nickname) != -1){
            return currentWith.replace("@"+participant.nickname, "");
        }
        return currentWith;
    });
};

var removeGroupIfNecessary = function(url){
    var ref = new Firebase(url).once("value", function(snapshot){
        if(snapshot.exists() && snapshot.val().type != "public"){
            new Firebase(snapshot.ref().toString()).remove();
        }
    });
};