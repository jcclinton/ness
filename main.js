
var _ = require('underscore')
	, util = require('util')
	, http = require('http')
	, url = require('url')
	, ness = require('./ness.js')
	, options
	, uid = process.ARGV[2] | 0
	, user
	, user2
	, subscribedUids
	, port
	, ip = ''
	;

options = {   "serverMap": './map.js'
			, "socketType": 'udp'
			, "socketPath": '/var/local/tmp'
			};

ness.socket.init(options);

// set port algorith used by sockets
ness.socket.setPortAlgorithm(portAlgo);
ness.socket.setIpAlgorithm(ipAlgo);

// put users 0 and 2 on 8000, user 1 on port 8001
function portAlgo(uid){
	return 8000 + (uid % 2);
}
function ipAlgo(uid){
	return '127.0.0.1';
}


/**

this is meant to be a test between server 0 and server 1
to run this example, run these two commands:
sudo node main.js 0
sudo node main.js 1

this example creates users with uids of 0 and 2 on server 0
it creates a user with uid 1 on server 1

It then adds an event listener to the 'call' event for each user object

finally, hitting localhost:80 in your browser will subscribe user 2 to user 0 (same server subscription)
hitting localhost:443 in your browser will subscribe user 1 to user 0 (different server subscription)

after that point, if you hit localhost:80, it will publish a 'call' event which will be heard by both servers

this example uses the unix domain socket to communicate since both servers are on localhost, to use udp simply pass in an empty options.socketPath


**/


if(uid === 0){
	//subscribedUids = [1];
	port = 80;

	user2 = ness.eventObject.createNew(2, [], function(subUid){ console.log('added ' + subUid + ' to ' + this.uid); } );
	user2.on('call', function(){
		console.log('user: ' + user2.uid + ' received call event');
	});

	/*
	// change publish prototype:
	ness.eventObject.extend({
		"publish": function(ev){
			console.log('publishing ' + ev);
		}
	});*/

}else{
	//subscribedUids = [0];
	port = 443;
}


if(uid !== 2){
	user = ness.eventObject.createNew(uid, [], function(subUid){ console.log('added ' + subUid + ' to ' + this.uid); } );
	user.on('call', function(){
		console.log('user: ' + user.uid + ' received call event');
	});
}




	http.createServer(function (req, response) {
		response.writeHead(200, {'Content-Type': 'text/html'});
		response.end('<h3>You are on server: '+ uid +'</h3>');

		if(req.url !== '/favicon.ico'){
			if(uid === 0){
				console.log('user: ' + user.uid + ' triggered call event');
				user.publish('call', 'a', 'b', 'c');
				user2.publish('call', 'a', 'b', 'c');
				user2.subscribe(0, 'call');
			}else{
				console.log('user: ' + user.uid + ' subscribing to call event');
				user.subscribe(0, 'call');
			}
		}
	}).listen(port, ip);
