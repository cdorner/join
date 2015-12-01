process.env.FIREBASE = process.argv[0];
var SECRET = process.argv[1];

process.argv.forEach(function (val, index, array) {
    if(val.indexOf("-FIREBASE") != -1){
        process.env.FIREBASE = val.substr(10);
    } else if(val.indexOf("-SECRET") != -1){
        SECRET = val.substr(8);
    }
});

var firebase = require('../app/firebase.connection');

process.on('uncaughtException', function(err){
    debug('Whoops! ' + err.message + " \r\n" + err.stack);
    debug("Don't worry the server still up");
});

firebase().authWithCustomToken(SECRET, function(error, data){
    if(error) return console.error(JSON.stringify(error));

    console.log("starting messages delivery..");

    require('../app/listeners/delivery.incoming.messages.to.participants');

    console.log("message delivery started.");
});