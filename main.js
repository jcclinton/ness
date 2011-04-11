
var   PORT = 80
	, IP = "127.0.0.1"
	, http = require('http')
	, fs = require('fs')
	, _ = require('underscore')
	, ness = require('/home/public_html/65.49.73.225/public/ness/ness.js')
	, options = {"serverId": 1, "socketType": "udp"}
	, SERVERID = 1
	;



http.createServer(function (req, res) {
	res.writeHead(200, {'Content-Type': 'text/html'});
	res.end('<h1>Hello World</h1>');
}).listen(PORT, IP);
console.log('Server running');


ness.socket.init(SERVERID);