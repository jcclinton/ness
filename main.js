
var   _ = require('underscore')
	, util = require('util')
	, http = require('http')
	, ness = require('/home/public_html/65.49.73.225/public/ness/ness.js')
	, options
	, uid
	, user
	, subuids
	;

options = {   "serverMap": '/home/public_html/65.49.73.225/public/ness/map.js'
			, "socketType": 'udp'
			};

ness.socket.init(options);

uid = process.ARGV[2] | 0;
if(uid === 0){
	subuids = [1];
	port = 80;

}else{
	subuids = [0];
	port = 443;
}


user = ness.create(uid, subuids);
user.on('call', function(){
	console.log('user: ' + user.uid + ' received call event');
	console.log(arguments);
});




	http.createServer(function (request, response) {
		response.writeHead(200, {'Content-Type': 'text/html'});
		response.end('<h3>You are on server: '+ uid +'</h3>');
		console.log('user: ' + user.uid + ' triggered call event');
		user.publish('call', 'a', 'b', 'c');
	}).listen(port, '65.49.73.225');