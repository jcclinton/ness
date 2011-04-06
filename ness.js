var   dgram = require('dgram')
	, _ = require('underscore')
	, eventEmitter = require('events').EventEmitter
	;















var socketController = function(serverId){
	this.basePort = 8000;
	this.baseIP = '127.0.0.1';
	this.numServers = 2;
	this.serverId = serverId;
}

socketController.prototype.getServer = function(uid) {
	var   ip = this.getIp(uid)
		, port = this.getPort(uid)
		;

	return {"ip": ip, "port": port};
};

socketController.prototype.getIp = function() {
	return '127.0.0.1';
};

socketController.prototype.getPort = function(uid) {
	var offset = uid % this.numServers;
	return this.basePort + offset;
};

socketController.prototype.getBindingPort = function() {
	return this.basePort + this.serverId;
};

socketController.prototype.getBindingIp = function() {
	return '127.0.0.1';
};
















var old_ness = (function(){
	function old_ness(uid, options){
		// variables
		var   maxListeners = args.maxListeners || 10
			, that = this
			;

		this.uid = uid;

		// listeners are the callbacks attached to this object that will be called when listeners.uid.event is fired from the user with "uid": uid
		this.listeners = {};
		// listening is a list of uid's listening to events on the current object
		this.listening = {};

		// will on be defined at this point?
		this.on('delete', deleteMe);

		function deleteMe(){
			objectList.remove(uid);
			// will this work:
			// or if i get the object from the list, will it make it work?
			delete that;
		};

	}

	// use underscore for inheritance
	_.extend(old_ness, eventEmitter);

	old_ness.prototype.listenTo = function(toUid, event, listener, listeningFailed){
		var server = this.getServer(toUid);
		var ro = new remoteObject(toUid, server);

		//inform remote object it has a listener
		ro.attachEvent(event);

		if(this.listeners.toUid === undefined){
			this.listeners.toUid = {};
		}

		//store the listener callback function
		this.listeners.toUid.event = listener;
	};

	old_ness.prototype.getServer = function(uid){
		var sc = new socketController();
		return sc.getServer();
	};

	old_ness.prototype.attachListener = function(fromUid, event) {

		if(this.listening.event === undefined){
			this.listening.event = [];
		}
		this.listening.event.push(fromUid);
	};




	old_ness.prototype.emit = function(event){
		var   toUids = this.listening.event
			;

		_.each(toUids, function (toUid) {
			var server = this.getServer(toUid);
			ro = new remoteObject(toUid, server);
			ro.emit(event);
		});
	};

	old_ness.prototype.incomingListen = function(event, args) {
		this.emit('incomingListen', event, args);
	};

	old_ness.prototype.incomingEmit = function(event, args) {
		this.emit('incomingListen', event, args);
	};

	return old_ness;
})();














var remoteObject = function(uid, server){
	this.uid = uid;
	this.server = server;
}

remoteObject.prototype.send = function(obj) {
	var   msg = new Buffer( JSON.stringify( obj ) )
		, port = this.server.port
		, ip = this.server.ip
		;

	//socket is a global variable instatiated at startup
	socket.send(msg, 0, msg.length, port, ip);
};

remoteObject.prototype.attachEvent = function(event) {
	this.send( {"toUid": this.uid, "event": event, "type": "incomingListen"} );
};

remoteObject.prototype.emit = function(event) {
	this.send( {"toUid": this.uid, "event": event, "type": "incomingEmit"} );
};
































var ness = {}
ness.create = function(uid, subUids){
	// extend eventEmitter class
	function o(){
		this.uid = uid;
		this.subUids = _.isArray(subUids) && subUids || [];
	}
	var f = function(){};
	f.prototype = eventEmitter.prototype;
	f.protoype.constructor = o;
	o.prototype = new f;


	// METHODS CALLED FROM PUBLISHER

	o.prototype.publish = function(event) {
		if _.isEmpty(this.subUids){
			return;
		}

		var   currentServerId = sc.getServerId(this.uid)
			, servers = []
			, args = slice.call(arguments, 1);
			;

		_.each(this.subUids, function(uid){
			var   serverId = sc.getServerId(uid)
				, server = sc.emit('send', serverId, uid, event, args) //this needs to be optimized
				;
		});
	};



	// METHODS CALLED FROM SUBSCRIBER

	o.prototype.subscribe = function(pubUid, event, callback) {
		var args = slice.call( arguments, 3 );

		// message event is emitted when the message hits this server
		// this occurs when the publisher has published a message to their subscribers
		this.on('message', callback);

		// emit message to sc to send this data off
		sc.emit('sub', pubUid, event, args);

	};

	obj = new o;


	// addSubscriber is fired when a new subscriber message hits the server
	obj.on('addSubscriber',  function(subUid) {
		obj.subUids.push(subUid);
	});

	return obj;
}


























/*
container class for all clients
*/
objectList = function() {
	function List() {
		this.table = {};
	}

	List.prototype.add = function(id, obj) {
		return this.table[id] = obj;
	};

	List.prototype.remove = function(id) {
		return delete this.table[id];
	};

	List.prototype.get = function(id) {
		return this.table[id]?this.table[id]:false;
	};

	List.prototype.getAll = function() {
		return this.table;
	};

	return new List();
}();













exports.old_ness ={
	"init": function(args){


		var   sc = new socketController(args.serverId)
			, socket = dgram.createSocket('udp4')
			;

		socket.on("message", function (buf, rinfo) {
			var   msg = buf.toString('utf8')
				, obj
				, fn
				, args
				;

			try{
				obj = JSON.parse(msg);
			}catch(err){
				console.warn("cant parse incoming message");
				obj = {};
			}

			console.log("socket got: " + msg + " from " + rinfo.address + ":" + rinfo.port);

			if(obj.type !== undefined){
				fn = obj.type;
				args = obj.args || {};
				// CHANGE THIS TO .EMIT(event)
				objectList.get(obj.uid).fn(obj.event, args);
			}
		});

		socket.on("listening", function () {
			var address = socket.address();
			console.log("socket listening " + address.address + ":" + address.port);
		});

		socket.bind( sc.getBindingPort(), sc.getBindingIp() );

	}
	,"emitter": old_ness
}