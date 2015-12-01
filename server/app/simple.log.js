function log(){
    ifError = function(error){
        if(error){
            console.error(error);
        }
    }

    return {
        ifError : ifError
    };
};

module.exports = log;
