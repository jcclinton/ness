
var   PORT = 80
	, IP = "127.0.0.1"
	, http = require('http')
	, fs = require('fs')
	, _ = require('underscore')
	, ness = require('/home/public_html/65.49.73.225/public/ness/ness.js')
	, options
	, SERVERID = 2
	, serverMap
	;

options = {   "serverId": SERVERID
			, "serverMap": '/home/public_html/65.49.73.225/public/ness/map.js'
			, "socketType": 'udp'
			};

ness.socket.init(options);