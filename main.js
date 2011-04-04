
var PORT = 80;
IP = "127.0.0.1";
http = require 'http'
fs = require 'fs'
url = require 'url'
_ = require 'underscore'

ex = require '/home/public_html/65.49.73.225/public/server/ness.js'
ghost = ex.getGhost
instanceList = ghost.getInstanceList()
instanceList.add 1


http.createServer(function (req, res) {
	res.writeHead(200, {'Content-Type': 'text/html'});
	res.end('<h1>Hello World</h1>');
}).listen(PORT, IP);
console.log('Server running at http://127.0.0.1:8124/');