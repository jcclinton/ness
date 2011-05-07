(function(){
	var dgram = require('dgram')
		, _ = require('underscore')
		, fs = require('fs')
		, eventEmitter = require('events').EventEmitter
		, objectList // object list stores all ness objects
		, socketController // singleton used to manage this servers sockets
		, nessObj // constructor for ness objects
		;



/**

major TODO

-ip/port algorithm by uid is still kinda janky
-socket message batching still needs to be implemented



*****/



	/**
	* custom logger class to allow for mass suppression of output
	*/
	myConsole = (function(){
		//me = _.extend({}, console);
		var me = {};

		me.suppressLogging = false;

		me.shout = function(msg){
			if( me.suppressLogging === false ){
				console.log(msg);
			}
		};

		return me;
	}());




	/**
	* container class for all clients
	*/
	objectList = (function(){
		var me = {
			"table": {}
		};

		me.add = function(id, obj) {
			return (me.table[id] = obj);
		};

		me.remove = function(id) {
			return delete me.table[id];
		};

		me.get = function(id) {
			return me.table[id]?me.table[id]:false;
		};

		me.getAll = function() {
			return me.table;
		};

		me.getSize = function(){
			return _.size(me.table);
		};

		return me;
	}());











	/**
	*	controller for all socket interaction
	*
	*/
	socketController = (function(){
		var basePort = 8000
			, baseIP = '127.0.0.1'
			, me
			, _socketHandler
			;


		//extend eventEmitter object
		me = new eventEmitter();


		me.socketPath = '';
		me.serverId = 0;
		me.initialized = false;

		// user defined algorithms to determine the port and ip from the uid
		me.ipAlgorithm = false;
		me.portAlgorithm = false;


		// internal socket handler
		// used to abstract away different socket types: udp, tcp, unix
		_socketHandler = {};
		_socketHandler.udp = {
			"init": function(){
				if(me.udpClient !== void 0){
					myConsole.shout('udp client already defined');
					return;
				}
				_socketHandler.udp.isBound = false;
				me.udpClient = dgram.createSocket('udp4');
				return me.udpClient;
			},
			"bind": function(){
				if(_socketHandler.udp.isBound === true){
					me.udpClient.close();
				}
				if( me.getCurrentPort() > 0 ){
					me.udpClient.bind( me.getCurrentPort(), me.getCurrentIp() );
					_socketHandler.udp.isBound = true;
				}else{
					myConsole.shout('unable to bind udp port: port needs to be initialized first');
				}
			}
		};
		_socketHandler.tcp = {
			"init": function(){
				myConsole.shout('tcp does not work yet');
			},
			"bind": function(){
			}
		};
		_socketHandler.unix = {
			"init": function(){
				me.unixClient = dgram.createSocket('unix_dgram');
				return me.unixClient;
			},
			"bind": function(){
				if(me.socketPath !== ''){
					me.unixClient.bind( me.socketPath );
				}else{
					myConsole.shout('trying to bind unix socket without initializing path');
				}
			}
		};




		// TODO figure out which of these functions can be made private
		me.getCurrentServer = function(){
			var ip = me.getCurrentIp()
				, port = me.getCurrentPort()
				;

			return {"ip": ip, "port": port};
		};

		me.getIpFromUid = function(uid){
			return ( me.ipAlgorithm && _.isFunction(me.ipAlgorithm) ) ? me.ipAlgorithm.call(me, uid) : me.getCurrentIp();
		};

		me.getPortFromUid = function(uid){
			return ( me.portAlgorithm && _.isFunction(me.portAlgorithm) ) ? me.portAlgorithm.call(me, uid) : basePort + (uid % 2);
		};

		me.setIpAlgorithm = function(func){
			if( _.isFunction(func) ){
				me.ipAlgorithm = func;
			}else{
				myConsole.shout('invalid function passed into ip algorithm');
			}
		};

		me.setPortAlgorithm = function(func){
			if( _.isFunction(func) ){
				me.portAlgorithm = func;
			}else{
				myConsole.shout('invalid function passed into port algorithm');
			}
		};

		me.getServerFromUid = function(uid) {
			// TODO memoize this data
			var ip = me.getIpFromUid(uid)
				, port = me.getPortFromUid(uid)
				;

			return {"ip": ip, "port": port};
		};

		me.getCurrentIp = function() {
			return (this.currentIp !== void 0) ? this.currentIp : baseIP;
		};

		me.setCurrentIp = function(ip){
			if( _.isString( ip ) && !_.isEmpty( ip ) ){
				this.currentIp = ip;
			}else{
				myConsole.shout('bad ip value passed into server map');
			}
		};

		me.getCurrentPort = function() {
			return (this.currentPort !== void 0) ? this.currentPort : 0;
		};

		me.setCurrentPort = function(port){
			if( _.isNumber(port) && port > 0 ){
				this.currentPort = port;
			}else{
				myConsole.shout('bad port value passed into server map');
			}
		};

		me.getServerId = function(){
			return this.serverId;
		};

		me.setServerId = function(id){
			if( _.isNumber(id) ){
				this.serverId = id;
			}else{
				myConsole.shout('trying to set server id with non-number');
			}
		};

		me.setSocketPath = function(path){
			me.basePath = path;
			me.socketPath = path + ':' + me.getCurrentPort();
		};

		me.getSocketPathFromUid = function(uid){
			return me.basePath + ':' + me.getPortFromUid(uid);
		};

		me.loadServerData = function(serverMap){
			var server
				, serverId = me.getServerId()
				;

			if( serverMap[serverId] !== void 0){
				server = serverMap[serverId];
				me.setCurrentPort( server.port );
				me.setCurrentIp( server.ip );
			}else{
				myConsole.shout('bad data loaded in from server map');
			}
		};

		me.initSocket = function(type){
			var socket;

			if( _.isString(type) && _socketHandler[type] ){
				me.initialized = true;
				socket = _socketHandler[type].init();

				socket.on("message", _onSocketMessage);
				socket.on("listening", _onSocketListening);

				_socketHandler[type].bind();
			}else{
				myConsole.shout('invalid type used when initializing socket: ' + type);
				return;
			}


			function _onSocketListening() {
				var address = socket.address();
				if(address.port){
					myConsole.shout("socket listening " + address.address + ":" + address.port);
				}else{
					myConsole.shout("socket listening " + address.address);
				}
			}
		};

		me.removeSocketPath = function(){
			if(me.socketPath !== ''){
				me.socketPath = '';
			}
			if(me.unixClient !== void 0){
				delete me.unixClient;
			}
		};


		/////////////////////////////////
		// construct object:

		me.on('publish', _pub);
		me.on('subscribe', _sub);

		// todo: set this up tobe initialized via the user, if it is never initialized, simply run as if it were all in a single thread

		return me;




		///////////////////////////////////////////////////////////////////////////
		// PRIVATE FUNCTIONS



		// get the socket controller's attention when you need to publish something:
		function _pub(toUid, fromUid, eventType, args){
			_sendToUid(toUid, fromUid, 'publish', eventType, args);
		}

		// tell the sc you are subscribing to something
		function _sub(publisherUid, fromUid, eventType, args){
			_sendToUid(publisherUid, fromUid, 'subscribe', eventType, args);
		}


		// TODO: if multiple messages are being sent to the same server, batch them into the same message

		// TODO: batch all subscribe messages together and fire them all out every x seconds
		//			this may be possible for publish messages also, but the delay will be shorter
		function _sendToUid(toUid, fromUid, type, eventType, args){
			var toServer = me.getServerFromUid(toUid)
				, currentServer = me.getCurrentServer()
				, msg
				, msg_obj
				;

				eventType = type === 'publish' ? eventType : 'addSubscriber';

			// if the publisherUid is in the same thread (same port and ip), simply emit the event
			// if the init method has not been called, just emit and assume all objects are on this server
			if( _.isEqual(toServer, currentServer) || me.initialized === false ){
				_emitToObject(toUid, fromUid, eventType, args);
			}else{
				msg_obj =   { "type": type
							, "eventType": eventType
							, "args": args
							, "toUid": toUid
							, "fromUid": fromUid
							, "timestamp": +new Date()
							};
				msg = new Buffer( JSON.stringify( msg_obj ) );
				// if they are on the same server, write to a unix socket, otherwise send via socket
				if(toServer.ip === currentServer.ip && me.socketPath !== ''){
					if(me.unixClient !== void 0){
						me.unixClient.send(msg, 0, msg.length, me.getSocketPathFromUid(toUid), _onErr);
					}else{
						myConsole.shout('no unixClient was created');
					}
				}else if(me.udpClient !== void 0){
					me.udpClient.send(msg, 0, msg.length, toServer.port, toServer.ip, _onErr);
				}else{
					myConsole.shout('no udp client was created');
				}
			}

			//callback if socket.send fails
			function _onErr(err, bytes) {
			    if(err){
					myConsole.shout(err);
			    }else{
					myConsole.shout("Wrote " + bytes + " bytes to socket.");
				}
			}
		}

		function _emitToObject(toUid, fromUid, eventType, args){
			// break this bit of processing into smaller chunks
			_.defer(_emit);

			function _emit(){
				var new_args
					, obj
					;

				obj = objectList.get(toUid);
				if(obj){
					new_args = _.isArray(args) && args || [];
					_.defer(function(){
						new_args.unshift(eventType, fromUid);

						_.defer(function(){
							obj.emit.apply(obj, new_args);
						});
					});
				}else{
					myConsole.shout('trying to get a non-object on current server!');
				}
			}
		}


		function _onSocketMessage(buf, rinfo) {
			var msg = buf.toString('utf8')
				, obj
				, eventType
				;

			try{
				obj = JSON.parse(msg);
			}catch(err){
				myConsole.shout("cant parse incoming message: " + err);
				obj = {};
			}

			// since all servers at this ip are listening to this socket,
			// filter out the servers who dont need this message
			if( me.getCurrentPort() !== me.getPortFromUid(obj.toUid) ){
				return;
			}

			if(rinfo.port){
				myConsole.shout("socket got: " + msg + " from " + rinfo.address + ":" + rinfo.port);
			}else{
				myConsole.shout("socket got: " + msg + " from " + rinfo.address);
			}

			if(obj.type !== void 0){
				// TODO: make this more robust to check the validity of the incoming data
				eventType = obj.eventType;
				if(obj.toUid !== void 0){
					_emitToObject(obj.toUid, obj.fromUid, eventType, obj.args);
				}else{
					myConsole.shout('incoming socket message has no toUid specified');
				}
			}
		}

	}());




























	/**
	*	base object.  extends the event emitter class
	*
	*/
	nessObj = (function(){
		var me
			, f
			;

		me = function(uid, subscribedUids, callback){
			var that = this;

			this.uid = uid;
			this.subscribedUids = _.isArray(subscribedUids) && subscribedUids || [];

			if( objectList.get(uid) ){
				myConsole.shout(uid + ' is already taken as a uid...');
			}

			// put this object into the global lookup list
			_.defer(function(){
				objectList.add(uid, that);
			});


			// addSubscriber is fired when a new subscriber message hits the server
			// TODO: make this specific to the event being subscribed to
			this.on('addSubscriber', _addSubscriber);



			// private constructor functions:

			function _addSubscriber(subscriberUid) {
				// defer all computations that may be expensive
				_.defer(checkIndex);


				function checkIndex(){
					//check to ensure its not already in this array (ie indexOf returns -1)
					if( !~_.indexOf(that.subscribedUids, subscriberUid) ){
						_.defer(pushUids);
					}
				}

				function pushUids(){
					that.subscribedUids.push(subscriberUid);

					if( _.isFunction(callback) ){
						callback.call( that, subscriberUid );
					}
				}
			}
		};

		// inherit from the eventEmitter object
		f = function(){};
		f.prototype = eventEmitter.prototype;
		f.prototype.constructor = me;
		me.prototype = new f();

		/**
		*	delete this object
		*
		*/
		me.prototype.destroy = function(callback){
			var that = this;

			_.defer(function(){
				objectList.remove(that.uid);
				if( _.isFunction(callback) ){
					callback.call( that );
				}
			});
		};


		// METHODS CALLED FROM PUBLISHER

		me.prototype.publish = function(eventType) {
			if( _.isEmpty(this.subscribedUids) ){
				return;
			}

			var args = Array.prototype.slice.call(arguments, 1)
				, that = this
				;

			_.each(this.subscribedUids, function(subscribedUid){
				_.defer(function(){
					//this needs to be optimized so it can batch together messages to the same server
					socketController.emit('publish', subscribedUid, that.uid, eventType, args);
				});
			});
		};



		// METHODS CALLED FROM SUBSCRIBER

		me.prototype.subscribe = function(publisherUid, eventType) {
			var args = Array.prototype.slice.call( arguments, 3 );

			// TODO add max number of subscribers and complain if it goes over this amount

			// emit message to sc to send this data off
			socketController.emit('subscribe', publisherUid, this.uid, eventType, args);

		};

		return me;
	}());






















		exports.socket = {
			setIpAlgorithm: function(func){
				socketController.setIpAlgorithm(func);
			},
			setPortAlgorithm: function(func){
				socketController.setPortAlgorithm(func);
			},
			setPath: function(path){

				if(_.isString(path)){
					if(path !== ''){
						socketController.setSocketPath(path);
						socketController.initSocket('unix');
					}else{
						socketController.removeSocketPath();
					}
				}else{
					myConsole.shout('invalid path passed into setSocketPath');
				}
			},
			init: _.once( function(o){
				var defaults
					, serverMap
					, serverId
					;

				defaults = {  "serverMap": ''
							, "socketType": ''
							, "socketPath": ''
							};
				_.defaults(o, defaults);

				//set server id
				if( process.ARGV && process.ARGV[2] ){
					// if a parameter was passed in via command line,
					// convert it from a string to an integer
					serverId = process.ARGV[2] | 0;
					serverId = ( _.isNumber(serverId) && serverId >= 0 ) ? serverId : 0 ;
				}else{
					serverId = 0;
				}
				socketController.setServerId( serverId );

				//load server map from file
				if( _.isString(o.serverMap) && !_.isEmpty(o.serverMap) ){
					try{
						// uses sync file read so that it can guarantee server map has been loaded before stuff starts happening
						serverMap = JSON.parse( fs.readFileSync(o.serverMap).toString('utf8') );
						socketController.loadServerData(serverMap);
					}catch(err){
						myConsole.shout('bad file descriptor passed into init: ' + err);
					}
				}

				//set socket path and init it if
				if( !_.isEmpty( o.socketPath ) && _.isString(o.socketPath) ){
					socketController.setSocketPath( o.socketPath );
					socketController.initSocket('unix');
				}

				//set net socket if the type was passed in
				if( _.isString(o.socketType) && !_.isEmpty(o.socketType) && (o.socketType === 'udp' || o.socketType === 'tcp') ){
					socketController.initSocket(o.socketType);
				}
			})
		};

		exports.createNew = function(uid, subscribedUids, callback){
			return new nessObj(uid, subscribedUids || [], callback);
		};

		exports.extendBaseObject = function(){
			var objs = Array.prototype.slice.call(arguments);

			_.each(objs, function(obj){
				if(obj){
					_.each(obj, function(val, key){
						if( _.isString(key) && _.isFunction(val) ){
							nessObj.prototype[key] = val;
						}else{
							myConsole.shout('invalid object passed into extendBaseObject');
						}
					});
				}else{
					myConsole.shout('empty object passed into extendBaseObject');
				}
			});
		};

		exports.getListSize = function(){
			return objectList.getSize();
		};

		exports.logging = {
			suppress: function(){
				myConsole.suppressLogging = true;
			},
			allow: function(){
				myConsole.suppressLogging = false;
			}
		};


}());