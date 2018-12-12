
var net = require('net');
const EventEmitter = require('events');

const JRPCConnectTimeout = 3000;
const JRPCReconnectTime = 2000;

var jRPCInst;
var jRPCip = '127.0.0.1';
var jRPCport = 6060;
var jRPCConn;
var jRPCActive = false;
var jRPCLineBuffer = '';


var indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

var abstract = function(code, message) {
		if (code == null) {
			code = -32099;  
		}
		return {
			'code': code,
			'message': message
		};
	};

var	systemError = function() {
    	return abstract( -32010, 'SystemError' );
	};

var	methodNotFound = function() {
		return abstract( -32601, 'MethodNotFound' );
	};

class JRPC2 extends EventEmitter {
	constructor() {
		super();
		var self = this;
		self.methods = 'methods';
		self.methodArgs = {};
		self.modules = {};
		self.context = {};
		jRPCInst = self;
	}

	doConnected() {
		//console.log('doConnected()');
		var self = this;
		self.currid = 1;
		self.callbacks = {};
		self.emit('connect');
	}

	doDisconneced() {
		//console.log('doDisconneced()')
		this.emit('disconnect');
	}

	doDispatch(msg) {
		//console.log('====> ' + msg);
		var self = this;
        var obj = JSON.parse(msg);
		if (obj.method) {
			self.dispatchRequest(obj);
		} else {
			self.dispatchResult(obj);
		}
	}

	
	splitMethod(methodName) {
		var method, res;
		if (indexOf.call(methodName, ".") >= 0) {
			res = methodName.split('.');
			method = res.pop();
			return [res.join('.'), method];
		} else {
			return [this.methods, methodName];
		}
	}

	getMethod(methodName) {
		var moduleName, ref;
		ref = this.splitMethod(methodName), moduleName = ref[0], methodName = ref[1];
		return this.modules[moduleName][methodName];
	}

	
	dispatchResult(obj) {
		//console.log('got response: ', obj);
		var self = this;
		//console.log('obj.id=',obj.id);
		var func = self.callbacks[obj.id];
		if (typeof func === 'function')
			func(obj.error, obj.result);
		delete self.callbacks[obj.id];
	}
	
	dispatchRequest(obj) {
		//console.log('incoming request: ', obj);
		var self = this;
		function responder(error, result) {
			var data;
			if (error) {
				data = {
					'jsonrpc': '2.0',
					'error': error,
					'id': obj.id
				};
			} else {
				data = {
					'jsonrpc': '2.0',
					'result': result,
					'id': obj.id
				};
			}
			var resp = JSON.stringify(data);

			if (jRPCActive) {
				//console.log('<==== ', resp);
				jRPCConn.write(resp+'\n');
			}
		}


		var len, j, name, args;
		var argNames = self.methodArgs[obj.method];
    	if (!argNames) {
			responder( methodNotFound(), null );
        	return;
      	}

		var func = self.getMethod(obj.method);
      	var result = null;

		var params = obj.params;
		if (params == null) {
			params = [];
		}

		try {
	      	if (params instanceof Array) {
	      		//console.log('params array');
	        	result = func.apply(self, params);
	      	} else {
	      		//console.log('params object');
	        	args = [];
	        	for (j = 0, len = argNames.length; j < len; j++) {
	          		name = argNames[j];
	          		args.push(params[name]);
	        	}
	        	result = func.apply(self, args); ////
	      	}

			if ((result != null) && typeof result.then === 'function') {
				result.then((res)=>{
					responder( null, res );
				}).catch((error)=>{
					if (error instanceof Error) {
						responder( abstract( null, error.message ), null );	
					} if ((error.code)&&(error.message)) {
						responder( error, null );
					} else {
						responder( abstract( null, error ), null );	
					}
				});
			} else {
				if (result instanceof Error) {
					//console.log('result normal error');
					responder( result, null );
				} else {
					//console.log('result normal ok');
					responder( null, result );
				}
			}
		} 
		catch(e) {
			console.log("Result Type - Error");

			var msg;
			if (e instanceof Error)
				msg = e.message
			else
				msg = e;
			responder( abstract( -32100, msg ), null );
		}
	}

	expose(fullName, func) {
		var args, methodName, moduleName, ref;

		args = func.toString().match(/function[^(]*\(([^)]*)\)/)[1];

		this.methodArgs[fullName] = args ? args.split(/,\s*/) : [];
		ref = this.splitMethod(fullName), moduleName = ref[0], methodName = ref[1];
		if (!this.modules[moduleName]) {
			this.modules[moduleName] = {};
		}
		//return this.modules[moduleName][methodName] = func;
		this.modules[moduleName][methodName] = func;
		return this;
	}


	call(method /*, params */) {
		var self = this;
		var id = self.currid;

		self.currid = self.currid + 1;
		if (self.currid > 16383) {self.currid = 1};

		var params = Array.prototype.slice.call(arguments);
		params.shift(); // drop `method`
		var req = JSON.stringify({
			'jsonrpc': '2.0',
			'method': method,
			'params': params,
			'id': id
		});

		return new Promise(function(resolve,reject){
			if (jRPCActive) {
				var cb = function(err,result) {
					if (err)
						reject(err);
					else
						resolve(result);
				};
				self.callbacks[id] = cb;
				//console.log('<==== ', req);
        		setImmediate(function(){
          			jRPCConn.write(req+'\n');
        		});
			} else {
				reject(systemError());
			}
		});
	}

	get isConnected() {
		return jRPCActive;
	}

	connectTo( ip, port ) {
		jRPCip = ip;
		jRPCport = port;
		setImmediate(SocketHandle);
	}
}


function SocketHandle() {
		var waitTimer;
		var self = this;

		jRPCConn = new net.Socket(); 
		//console.log('connecting...', jRPCip, ":", jRPCport);
		jRPCConn.setEncoding('utf8');
		jRPCConn.connect(jRPCport, jRPCip, ()=>{
			clearTimeout(waitTimer);
			//console.log('connected');
			jRPCActive = true;
			jRPCLineBuffer = '';
			jRPCInst.doConnected();
		})
		.on('data', function(data) {
			jRPCLineBuffer += data.toString();
			//console.log( 'jRPCLineBuffer = ', jRPCLineBuffer );
			if (jRPCLineBuffer.indexOf('\n') != -1) {
				var lines = jRPCLineBuffer.split('\n');
				jRPCLineBuffer = lines.pop();
				lines.forEach(function(line){
					jRPCInst.doDispatch(line);
				},this)
			}
		})
		.on('error', function(err) {
			clearTimeout(waitTimer);
			if ((err.code == "ECONNREFUSED") || (err.code == "ECONNRESET")) {
				console.log( "!!! Please check that the MoteBus program is running.");	
			}
			else
				console.log('error: ',err.code);
		})
		.on('close', function() {
			if (jRPCActive) {
				jRPCActive = false;
				//console.log('disconnected');	
				jRPCInst.doDisconneced();
			}
			setTimeout( SocketHandle, JRPCReconnectTime);
		});

		waitTimer = setTimeout(function(){
			//console.log('connect timeout');
			jRPCConn.destroy();			
			jRPCConn = null;

		}, JRPCConnectTimeout);
}


module.exports.create = function() {
	return new JRPC2();	
}

module.exports.systemError = systemError;
