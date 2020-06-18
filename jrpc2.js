
var net = require('net');
const EventEmitter = require('events');

const JRPCConnectTimeout = 3000;
const JRPCReconnectTime = 2000;
const JRPCTTLTimeout1 = 20000;
const JRPCTTLTimeout2 = 5000;


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
		self.connected = false;
		self.buffer = '';
		self.socket = null;
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

        if (Array.isArray(obj)) {
        	obj.forEach(function(item, index){
				if (item.method) {
					self.dispatchRequest(item);
				} else {
					self.dispatchResult(item);
				}
        	});
        } else {
			if (obj.method) {
				self.dispatchRequest(obj);
			} else {
				self.dispatchResult(obj);
			}
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

			if (self.connected) {
				//console.log('<==== ', resp);
				self.socket.write(resp+'\n');
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
			if (self.connected) {
				var cb = function(err,result) {
					//console.log('cb err=',err,' ,result=', result);
					if (err)
						reject(err);
					else
						resolve(result);
				};
				self.callbacks[id] = cb;
				//console.log('<==== ', req);
        		setImmediate(function(){
          			self.socket.write(req+'\n');
        		});
			} else {
				reject(systemError());
			}
		});
	}

	get isConnected() {
		return self.connected;
	}

	_socketHandle() {
		var self = this;
		var waitTimer;
		var ttlTimer1;
		var ttlTimer2;

		function clearAllTimer() {
			clearTimeout(waitTimer);
			clearTimeout(ttlTimer1);
			clearTimeout(ttlTimer2);
		}

		function startTTLTimer() {
			ttlTimer1 = setTimeout(function(){
				//console.log('sendTTL');
				self.socket.write('\t\n');
				ttlTimer2 = setTimeout(function(){
					//console.log('TTL Timeout!!!');
					self.socket.end();
				}, JRPCTTLTimeout2);
			}, JRPCTTLTimeout1);
		}

		function resetTTLTimer() {
			clearTimeout(ttlTimer1);
			clearTimeout(ttlTimer2);
			startTTLTimer();
		}

		self.socket = new net.Socket(); 
		//console.log('connecting...', self.hostIP, ":", self.hostPort);
		self.socket.setEncoding('utf8');
		self.socket.connect(self.hostPort, self.hostIP, ()=>{
			clearTimeout(waitTimer);
			//console.log('connected');
			self.connected = true;
			self.buffer = '';
			startTTLTimer();
			self.doConnected();
		})
		.on('data', function(data) {
			resetTTLTimer();
			self.buffer += data.toString();
			//console.log( 'self.buffer = ', self.buffer );
			if (self.buffer.indexOf('\n') != -1) {
				var lines = self.buffer.split('\n');
				self.buffer = lines.pop();
				lines.forEach(function(line){
					if (line != "") {
						if (line == "\t") {
							//console.log('recvTTL');
							//console.log('sendACK');
							self.socket.write('\b\n');
						} else if (line == "\b") {	
							//console.log('recvACK');
						} else
							self.doDispatch(line);
					}
				},this)
			}
		})
		.on('error', function(err) {
			clearTimeout(waitTimer);
			if ((err.code == "ECONNREFUSED") || (err.code == "ECONNRESET")) {
				console.log( "!!! Please check that the %s program is running.", self.svrName);	
			}
			else
				console.log('error: ',err.code);
		})
		.on('close', function() {
			if (self.connected) {
				self.connected = false;
				//console.log('disconnected');
				clearAllTimer();
				self.doDisconneced();
			}
			setTimeout( ()=>{self._socketHandle()}, JRPCReconnectTime);
		});

		waitTimer = setTimeout(function(){
			//console.log('connect timeout');
			self.socket.destroy();			
			self.socket = null;

		}, JRPCConnectTimeout);
	}

	connectTo( ip, port, svr ) {
		//console.log('connectTo(%s:%d)', ip, port);
		var self = this;
		self.hostIP = ip;
		self.hostPort = port;
		self.svrName = svr;
		setImmediate( ()=>{self._socketHandle()} );
	}

	disconnect() {
		var self = this;
		if (self.connected && self.socket)
			self.socket.end();
	}

}




module.exports.create = function() {
	return new JRPC2();	
}

module.exports.systemError = systemError;
