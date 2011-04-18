
var   _ = require('underscore')
	, util = require('util')
	, http = require('http')
	, url = require('url')
	, ness = require('/home/public_html/65.49.73.225/public/ness/ness.js')
	, options
	, uid
	, user
	, user2
	, subuids
	, port
	;

options = {   "serverMap": '/home/public_html/65.49.73.225/public/ness/map.js'
			, "socketType": 'udp'
			, "socketPath": ''
			};

ness.socket.init(options);

uid = process.ARGV[2] | 0;
if(uid === 0){
	subuids = [1];
	port = 80;

	user2 = ness.create(2, [], function(subUid){ console.log('added ' + subUid + ' to ' + this.uid); } );
	user2.on('call', function(){
		console.log('user: ' + user2.uid + ' received call event');
	});

	//user2.constructor.prototype.publish = function(ev){ console.log('publishing' + ev); };
	/*ness.extendBaseObject({
		"publish": function(ev){
			console.log('publishing' + ev);
		}
	});*/

}else{
	subuids = [0];
	port = 443;
}


user = ness.create(uid, [], function(subUid){ console.log('added ' + subUid + ' to ' + this.uid); } );
user.on('call', function(){
	console.log('user: ' + user.uid + ' received call event');
});




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
	}).listen(port, '65.49.73.225');


/**

major TODO

-ip/port algorithm by uid is still kinda janky
-socket message batching still needs to be implemented



*****/