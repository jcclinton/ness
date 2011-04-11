
var   _ = require('underscore')
	, util = require('util')
	, ness = require('/home/public_html/65.49.73.225/public/ness/ness.js')
	, options
	;

options = {   "serverMap": '/home/public_html/65.49.73.225/public/ness/map.js'
			, "socketType": 'udp'
			};

ness.socket.init(options);