(function(){
	var   dgram = require('dgram')
		, _ = require('underscore')
		, eventEmitter = require('events').EventEmitter
		, SERVERID = 1
		, objectList 			// object list stores all ness objects
		, socketController 		// singleton used to manage this servers sockets
		, ness_obj 				// constructor for ness objects
		, f 					// empty function to use for inheritance in ness object
		;







	/*
	container class for all clients
	*/
	objectList = (function(){
		var me = {
			"table": {}
		};

		me.add = function(id, obj) {
			return me.table[id] = obj;
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
			//TODO: will this work:?
			return me.table.length;
			//otherwise us:
			//return _.values(me.table).length;
		}

		return me;
	})();












	socketController = (function(){
		var   basePort = 8000
			, baseIP = '127.0.0.1'
			, numServers = 2
			, serverId = SERVERID
			, me
			, _socketHandler
			;


		me = {};

		//extend eventEmitter object
		_.extend(me, eventEmitter);

		me.socketPath = '';


		// internal socket handler
		// used to abstract away different socket types: udp, tcp, unix
		_socketHandler = {};
		_socketHandler.udp = {
			"init": function(){
				if(me.udpClient !== void 0){
					console.log('udp client already defined');
					return;
				}
				_socketHandler.udp.isBound = false;
				me.udpClient = dgram.createSocket('udp4');
				return me.udpClient;
			},
			"bind": function(){
				if(_socketHandler.udp.isBound === true){
					socket.close();
				}
				socket.bind( me.getCurrentPort(), me.getCurrentIp() );
				_socketHandler.udp.isBound = true;
			}
		};
		_socketHandler.tcp = {
			"init": function(){
				console.log('tcp does not work yet');
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
					socket.bind( me.socketPath );
				}else{
					console.log('trying to bind unix socket without initializing path');
				}
			}
		};




		// TODO figure out which of these functions can be made private
		me.getCurrentServer = function(){
			var   ip = me.getCurrentIp()
				, port = me.getCurrentPort()
				;

			return {"ip": ip, "port": port};
		}

		me.getServer = function(uid) {
			// TODO memoize this data
			var   ip = me.getIp(uid)
				, port = me.getPort(uid)
				;

			return {"ip": ip, "port": port};
		};

		me.getCurrentIp = function() {
			return '127.0.0.1';
		};

		me.getCurrentPort = function() {
			return basePort;
		};

		me.getIp = function() {
			return '127.0.0.1';
		};

		me.getPort = function(uid) {
			var offset = uid % numServers;
			return basePort + offset;
		};

		me.initSocket = function(type){
			var socket;

			if( _.isString(type) && _socketHandler[type] ){
				socket = _socketHandler[type].init();

				socket.on("message", _onSocketMessage);
				socket.on("listening", _onSocketListening);

				_socketHandler[type].bind();
			}else{
				console.log('invalid type used when initializing socket: ' + type);
			}
		}

		me.removeSocketPath = function(){
			if(me.socketPath !== ''){
				me.socketPath = '';
			}
			if(me.unixClient !== void 0){
				delete me.unixClient;
			}
		}


		/////////////////////////////////
		// construct object:

		me.on('pub', _pub);
		me.on('sub', _sub);

		// todo: set this up to be initialized via the user, if it is never initialized, simply run as if it were all in a single thread
		me.initSocket('udp');
		me.initSocket('unix');

		return me;




		///////////////////////////////////////////////////////////////////////////
		// PRIVATE FUNCTIONS



		// get the socket controller's attention when you need to publish something:
		function _pub(subUids, event){
			var args = slice.call(arguments, 2);

			_.each(subUids, pubToUid);

			function pubToUid(pubUid){
				_sendToUid(subUid, 'publish', event, args);
			}
		}

		// tell the sc you are subscribing to something
		function _sub(pubUid, event){
			var args = slice.call(arguments, 2);
			_sendToUid(pubUid, 'subscribe', event, args);
		}


		// TODO: if multiple messages are being sent to the same server, batch them into the same message

		// TODO: batch all subscribe messages together and fire them all out every x seconds
		//			this may be possible for publish messages also, but the delay will be shorter
		function _sendToUid(toUid, type, event, args){
			var   toServer = me.getServer(toUid)
				, currentServer = me.getCurrentServer()
				, obj
				, msg
				, msg_obj
				, new_args
				;

			// if the pubUid is in the same thread (same port and ip), simply emit the event
			if( _.isEqual(toServer, currentServer) ){
				_emitToObject(toUid, event, args);
			}else{
				msg_obj =   { "type": type
							, "event": event
							, "args": args
							};
				msg = new Buffer( JSON.stringify( msg_obj ) );
				// if they are on the same server, write to a unix socket, otherwise send via socket
				if(toServer.ip === currentServer.ip && me.socketPath !== ''){
					if(me.unixClient !== void 0){
						me.unixClient.send(msg, 0, msg.length, me.socketPath, onErr);
					}else{
						console.log('no unixClient was created');
					}
				}else if(me.udpClient !== void 0){
					me.udpClient.send(msg, 0, msg.length, toServer.port, toServer.ip, onErr);
				}else{
					console.log('no udp client was created');
				}
			}

			//callback if socket.send fails
			function onErr(err, bytes) {
			    if (err) {
			      throw err;
			    }
			}
		}

		function _emitToObject(toUid, event, args){
			obj = objectList.get(toUid);
			if(_.isObject(obj)){
				new_args = _.isArray(args) && !_.isEmpty(args) && args.unshift(event) || [event];
				obj.emit.apply(obj, new_args);
				//obj.emit(event, args);
			}else{
				console.log('trying to get a non-object on current server!');
			}
		}

		function _onSocketListening() {
			var address = socket.address();
			console.log("socket listening " + address.address + ":" + address.port);
		}

		function _onSocketMessage(buf, rinfo) {
			var   msg = buf.toString('utf8')
				, obj
				, event
				;

			try{
				obj = JSON.parse(msg);
			}catch(err){
				console.log("cant parse incoming message");
				obj = {};
			}

			console.log("socket got: " + msg + " from " + rinfo.address + ":" + rinfo.port);

			if(obj.type !== void 0){
				// TODO: make this more robust to check the validity of the incoming data
				event = obj.type === 'publish'?obj.event:'addSubscriber';
				_emitToObject(obj.toUid, event, obj.args);
			}
		}

	})();





























	// extend eventEmitter class
	ness_obj = function(uid, subUids){
		this.uid = uid;
		this.subUids = _.isArray(subUids) && subUids || [];

		objectList.add(uid, this);


		// addSubscriber is fired when a new subscriber message hits the server
		// TODO: make this specific to the event being subscribed to

		// TODO: will this work here in the xtor?
		obj.on('addSubscriber',  function(subUid) {
			obj.subUids.push(subUid);
		});
	}

	// inherit from the eventEmitter object
	f = function(){};
	f.prototype = eventEmitter.prototype;
	f.protoype.constructor = ness_obj;
	ness_obj.prototype = new f;


	// METHODS CALLED FROM PUBLISHER

	ness_obj.prototype.publish = function(event) {
		if _.isEmpty(this.subUids){
			return;
		}

		var   currentServerId = socketController.getServerId(this.uid)
			, servers = []
			, args = slice.call(arguments, 1);
			;

		_.each(this.subUids, function(uid){
			var   serverId = socketController.getServerId(uid)
				, server = socketController.emit('pub', serverId, uid, event, args) //this needs to be optimized
				;
		});
	};



	// METHODS CALLED FROM SUBSCRIBER

	ness_obj.prototype.subscribe = function(pubUid, event, callback) {
		var args = slice.call( arguments, 3 );

		// message event is emitted when the message hits this server
		// this occurs when the publisher has published a message to their subscribers
		this.on('message', callback);

		// emit message to sc to send this data off
		socketController.emit('sub', pubUid, event, args);

	};




















	exports.ness ={
		"socket": {
			"setPath": function(path){
				if(_.isString(path)){
					if(path !== ''){
						socketController.socketPath = path;
						socketController.initSocket('unix');
					}else{
						socketController.removeSocketPath();
					}
				}else{
					console.log('invalid path passed into setSocketPath');
				}
			}
		},
		"create": function(uid, subUids){
			return new ness_obj(uid, subUids);
		},
		"getBaseObject": function(){
			// TODO: will the ness.create method automatically return the updated objects if the user calls: ness.getBaseObject().prototype.newFunc ?
			return ness_obj;
		},
		"getListSize": function(){
			return objectList.getSize();
		}
	}

})();