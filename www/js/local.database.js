function database(){

	return {
	    execute: function(command, callback){
	      var db = this.init();
	      console.log("Executing " + command);
	      if(callback)
	      	db.transaction(function(tx){tx.executeSql(command, [], callback, this.onError)}, this.onError, this.onSuccess);
	      db.transaction(function(tx){tx.executeSql(command, [], this.onSuccess, this.onError)}, this.onError, this.onSuccess);
	    },

	    init: function(){
	      var db = window.openDatabase("join", "1.0.0", "Join Database", 1000000);
	      return db;
	    },

	    onSuccess:function(){
	      console.log("LocalDatabase command execute succefully");
	    },
	    onError: function(error){
	      console.log("LocalDatabase command execute with error: " + error.message);
	    }
  };
};