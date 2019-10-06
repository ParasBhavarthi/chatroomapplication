var MySql = require('sync-mysql');

var connection = new MySql({
	host     : 'localhost',
	user     : 'root',
	password : 'paras007',
	database : 'chatroom'
});


module.exports = connection;