var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var path = require('path');
var connection = require('./dbconnector');
var server = app.listen(3000);
var io = require('socket.io').listen(server);
var dateFormat = require('dateformat');
const bcrypt = require('bcrypt');
const saltRounds = 5;

app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');

app.use(bodyParser.urlencoded({extended : true}));
app.use(bodyParser.json());
app.use('/static', express.static('static'))

//on load 
app.get('/', function(request, response) {
	response.sendFile(path.join(__dirname + '/login.html'), { isAuthenticationUnsuccessful: "false" });
});

// signup form 
app.get('/signup', function(request, response) {
	response.sendFile(path.join(__dirname + '/signup.html'));
});

// chatwindow
app.get('/chatwindow', function(request, response) {
	response.sendFile(path.join(__dirname + '/chatwindow.html'));
});


//Authenticate user by username and password on login
app.post('/authenticate', function(request, response) {

	var username = request.body.username;
	var password = request.body.password;
	var hashpassword;
	var accountResults;
	accountResults = connection.query('SELECT * FROM accounts WHERE username = ?', [username]);
	
	// Compare hash value of plain text entered in password with password hash value from DB
	bcrypt.compare(password, accountResults[0].password, function(err, res) {
		
		if(res===true){
			console.log("match found "+accountResults);
			response.render('../chatwindow', { name: username });
		}
		else{
			response.render('../login', { isAuthenticationUnsuccessful: "true" });
				response.end();
		}
	});
	
});

// new user signup 
app.post('/register', function(request, response){

	var username = request.body.username;
	//check if there is user with similar username 
	var accountResults = connection.query('SELECT * FROM accounts where username=?', [username]);
	if(accountResults.length>0){
		response.render('../signup', { isUsernameExist: "true" });
		response.end();
	}
	else{
		var hashpassword;
		var password;
		var username = request.body.username;				
		var name=request.body.name;
		var is_online = "false";
		bcrypt.hash(request.body.password, saltRounds, function(err, hash) {
			var result = connection.query('INSERT INTO accounts ( `username`, `password`,  `name`, `is_online`) VALUES ( ? , ?, ?, ?)',[username,hash,name,is_online], function (error, results, fields) {
				
			  });
		});
	
		response.render('../login', { isAuthenticationUnsuccessful: "NO" });
		
	}
	
});

io.sockets.on('connection', function(socket){
	
	//retrieve older messagess when user logins
	const messageResults = connection.query('SELECT * FROM message');
		
		if(messageResults.length > 0 ){
			
			var messageText;
			var messageDate;
			var senderID;
			var senderName;
			var time;
			var senderUsername;
			
			for(var i=0; i<messageResults.length; i++){	

					messageText = messageResults[i].message_text;
					messageDate = messageResults[i].message_datetime;

					senderID = parseInt(messageResults[i].message_sender_id);
					
					// for each message retrieve account information
					const accountResult = connection.getRecord('accounts',senderID);
						senderUsername = accountResult.username;
						senderName = accountResult.name;

					//emit to connected user only				
					socket.emit('load_older_message', {msg: messageText, realName: senderName, time: messageDate, user : senderUsername}, senderUsername);
								
				};
		}

	// Retrieve other online users for when user logins 
	const onlineUsersResult = connection.query('SELECT * FROM accounts WHERE is_online ="true"');
	
		if(onlineUsersResult.length>0){
			var onlineUsersName;
			var onlineUserRealName;
			for(var i=0; i<onlineUsersResult.length; i++){
				
				onlineUsersName = onlineUsersResult[i].username;
				onlineUserRealName= onlineUsersResult[i].name;
				
				io.emit('load_online_users',{name:onlineUsersName, realName:onlineUserRealName})
			}
		}
	
	// when user sends message 
    socket.on('send_message', function(data, username) {
		var senderName;
		var currentDateTime = new Date();
		var now = dateFormat(currentDateTime, " dd/mm/yyyy, h:MM TT");
		var senderID ;
		//retrive users information from database
		var accountResults = connection.query('SELECT * FROM accounts WHERE username = ?', [username]) 
        	if (accountResults.length > 0) {

				senderName = accountResults[0].name;
				senderID = accountResults[0].id;
			}
			//send message to all connections
			io.emit('send_message', {msg: data, realName: senderName, time: now, user : username}, username);
			
			var message ={

				"message_text" : data,
				"message_datetime": currentDateTime,
				"c": senderID,

			}
			//store message information in table
			connection.query('INSERT INTO message (message_text,message_datetime,message_sender_id) values (?,?,?)' , [data,now,senderID]);
        
	});

	socket.on('i_m_joining', function(name){

		connection.query('UPDATE accounts SET is_online = "true" WHERE username = ?',[name]);
		var accountResult = connection.query('SELECT * FROM accounts WHERE username =?',[name]);
		io.emit('someone_joined', {name : name, realName : accountResult[0].name});
		
		
	});

	socket.on('i_m_disconnecting', function(name){

		connection.query('UPDATE accounts SET is_online = "false" WHERE username = ?',[name]);

		io.emit('someone_disconnected', {name : name})
		
	});


});






