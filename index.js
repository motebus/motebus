"use strict";

var util = require('util')
var JRPC2 = require('./jrpc2');

const EventEmitter = require('events');

var TKState = { 
  None: 'None', 
  Timout: 'Timeout', 
  SysError: 'SysError', 
  SvrNotFound: 'SvrNotFound', 
  AddrNotFound: 'AddrNotFound', 
  Sent: 'Sent', 
  Read: 'Read', 
  Proceed: 'Proceed', 
  Reply: 'Reply',
  End: 'End'
}


class MoteBus extends EventEmitter {

  constructor() {
    super();
    var self = this;
    self._Connected = false;
    self.MMA = {};
    self.modules = {};
    self.jrpc = JRPC2.create()
    .on('connect',()=>{
      //console.log('MoteBus.connected.');
      self.MMA = {};
      self.modules = {};
      self._Connected = true;
      self.emit('ready');
    })
    .on('disconnect',()=>{
      self._Connected = false;
      self.emit('off');
      //console.log('MoteBus.disconnected.');
    })
    .expose('XMSG.RecvMessage', function(idCode,msg){
      //console.log('XMsg.RecvMessage( %s, %s )', idCode, util.inspect(msg,false,null));
      var mma = self.MMA[idCode];
      if ((mma != null) && typeof mma === 'object') {
        setImmediate(function(){
          mma.recvMessage(msg);  
        });
      }
      return "OK";
    })
    .expose('XMSG.RecvTKInfo', function(idCode,info){
      //console.log('XMsg.RecvTKInfo( %s, %s )', idCode, util.inspect(info,false,null));
      var mma = self.MMA[idCode];
      if ((mma != null) && typeof mma === 'object') {
        setImmediate(function(){
          mma.recvTKInfo(info);
        });
      }
      return "OK";
    })    
    .expose('XRPC.RecvCall', function(head,appName,rpc){
      /*
      console.log('XRPC.RecvCall( %s, %s, %s )', 
        util.inspect(head,false,null),
        appName,
        util.inspect(rpc,false,null));
      */
      var func = self.modules[appName][rpc.method];

      var params = rpc.params;
      if (params == null) {
        params = [];
      }
      params.splice(0, 0, head);

      return func.apply(self, params);
    })
    .expose('CORE.RecvHostState', function(udid,online){
      /*
      console.log('CORE.RecvConnEvent( %s, %s )', udid, online);
      */
      self.emit('hostState',udid,online);
      return "OK";
    });
  }

  regMMA(idCode,obj) {
    //console.log('regMMA( %s )', idCode);
    this.MMA[idCode] = obj;
  }

  unregMMA(idCode) {
    //console.log('unregMMA( %s )', idCode);
    delete this.MMA[idCode];
  }

  xMsg() {
    return new XMSG(this);
  }

  xRPC() {
    return new XRPC(this);
  }

  getInfo() {
    var self = this;
    return new Promise(function(resolve, reject){
      self.jrpc.call('CORE.GetInfo')
      .then((result)=>{
        resolve(result);
      })
      .catch((err)=>{
        reject(err);
      });
    });
  }

  isReady() {
    return _Connected;
  }

  getHostInfo(keyword) {
    var self = this;
    return new Promise(function(resolve, reject){
      self.jrpc.call('CORE.HostInfo',keyword)
      .then((result)=>{
        resolve(result);
      })
      .catch((err)=>{
        reject(err);
      });
    });
  }

  getHostList() {
    var self = this;
    return new Promise(function(resolve, reject){
      self.jrpc.call('CORE.HostList','')
      .then((result)=>{
        resolve(result);
      })
      .catch((err)=>{
        reject(err);
      });
    });
  }

  hostLink(target, conCount, retries) {
    var self = this;
    return new Promise(function(resolve, reject){
      self.jrpc.call('CORE.HostLink',target, conCount, retries)
      .then((result)=>{
        resolve(result);
      })
      .catch((err)=>{
        reject(err);
      });
    });
  }

  hostUnlink(target) {
    var self = this;
    return new Promise(function(resolve, reject){
      self.jrpc.call('CORE.HostUnlink',target)
      .then((result)=>{
        resolve(result);
      })
      .catch((err)=>{
        reject(err);
      });
    });
  }

  hostCluster(target, serverlist, smode) {
    var self = this;
    return new Promise(function(resolve, reject){
      self.jrpc.call('CORE.HostCluster',target, serverlist, smode)
      .then((result)=>{
        resolve(result);
      })
      .catch((err)=>{
        reject(err);
      });
    });
  }

  startUp(apiIp, apiPort) {
    var self = this;
    var host, port;
    if (apiIp) {
      host = apiIp;
      if (apiPort)
        port = apiPort;
      else 
        port = 6060;
    } else {
      host = "127.0.0.1";
      port = 6060;
    }
    self.jrpc.connectTo( host, port );
  }
}

//=========================================
class XMSG extends EventEmitter {

  constructor(owner) {
    super();
    var self = this;
    //console.log("XMSG.create()");
    self.owner = owner;
    self.idCode = '';
    self.trackCB = {};
  }

  recvMessage(msg) {
    var self = this;
    //console.log('XMsg.recvMessage( %s )', util.inspect(msg,false,null));
    self.emit("message",msg);
  }

  recvTKInfo(info) {
    var self = this;
    //console.log('XMsg.recvTKInfo( %s )', util.inspect(info,false,null));
    var cb = self.trackCB[info.id];
    if ((cb!=null) && typeof cb === 'function') {
      cb(null,info);
      if (info.state == TKState.End) {
        delete self.trackCB[info.id];
      }
    }
  }


  open(alias, password, unque, callback) {
    var self = this;
    //console.log("XMSG.open(%s,%s,%s)", alias, password, unque);
    self.owner.jrpc.call('XMSG.Open', alias, password, unque )
    .then((result)=>{
        if (self.idCode != '')
          self.owner.unregMMA(self.idCode);
        self.idCode = result; 
        self.trackCB = {};
        self.owner.regMMA(self.idCode, self);
        //console.log('XMsg.open result=', result);
        callback(null,result);
    })
    .catch((err)=>{
        //console.log('XMsg.open error=', err);
        callback(err);
    });
  }


  send(target, body, files, prio, timeout1, timeout2, callback) {
    var self = this;
    /*
    console.log("XMSG.send(%s, %s, %s, %s, %d, %d, %d)", 
      self.idCode, target, util.inspect(body,false,null),
      util.inspect(files,false,null), prio, timeout1, timeout2);
    */
    self.owner.jrpc.call('XMSG.Send', self.idCode, target, body, files, prio, timeout1, timeout2 )
    .then((result)=>{
      //console.log('XMsg.send result=', result);
      self.trackCB[result] = callback;
    })
    .catch((err)=>{
      //console.log('XMsg.send error=', err);
      callback(err)
    });
  }


  reply(head, body, files, prio, timeout1, timeout2, callback) {
    var self = this;
    /*
    console.log("XMSG.reply(%s, %s, %s, %d, %d)", 
      util.inspect(head,false,null),
      util.inspect(body,false,null),
      util.inspect(files,false,null),prio,timeout1,timeout2);
    */
    self.owner.jrpc.call('XMSG.Reply', self.idCode, head, body, files, prio, timeout1, timeout2 )
    .then((result)=>{
      //console.log('XMsg.reply result=', result);
      self.trackCB[result] = callback;
    })
    .catch((err)=>{
      //console.log('XMsg.reply error=', err);
      callback(err)
    });
  }

  extract(msgid, path, callback) {
    var self = this;
    //console.log("XMSG.extract(%s, %s)", msgid, path); 

    self.owner.jrpc.call('XMSG.Extract', self.idCode, msgid, path )
    .then((result)=>{
      callback(null,result);
    })
    .catch((err)=>{
      callback(err)
    });
  }


}


//=========================================
class XRPC extends EventEmitter {

  constructor(owner) {
    super();
    //console.log("XRPC.create()");
    var self = this;
    self.owner = owner;
  }

  publish(appname, module) {
    //console.log("XRPC.publish()");
    var self = this;
    var methodName;
    for (methodName in module) {
      if ((typeof module[methodName] == "function") && (methodName !== "constructor")) {
        if (!self.owner.modules[appname]) {
            self.owner.modules[appname] = {};
        }
        self.owner.modules[appname][methodName] = module[methodName];
      }
    }

    var names = Object.keys(self.owner.modules[appname]);
    return new Promise(function(resolve, reject){
      self.owner.jrpc.call("XRPC.Publish", appname, names).then((result)=>{
        resolve(result);
      }).catch((err)=>{
        reject(err);
      });
    });
  }

  unpublish(appname) {
    //console.log("XRPC.unpublish()");
    var self = this;
    return new Promise(function(resolve, reject){
      self.owner.jrpc.call("XRPC.Unpublish", appname).then((result)=>{
        resolve(result);
      }).catch((err)=>{
        reject(err);
      });
    });
  }


  isolated(module) {
    //console.log("XRPC.publish()");
    var self = this;
    var names = Object.keys(module);
    return new Promise(function(resolve, reject){
      self.owner.jrpc.call("XRPC.Isolated", names).then((userId)=>{
        if (userId && userId.length>0) {
          var methodName;
          for (methodName in module) {
            if ((typeof module[methodName] == "function") && (methodName !== "constructor")) {
              if (!self.owner.modules[userId]) {
                  self.owner.modules[userId] = {};
              }
              self.owner.modules[userId][methodName] = module[methodName];
            }
          }
          resolve("OK");
        } else {
          reject(systemError());
        }
      }).catch((err)=>{
        reject(err);
      });
    });
  }


  call(target, funname, args, prio, timeout1, timeout2) {
    //console.log("XRPC.call()");
    var self = this;
    var rpc = {'method': funname,
               'params': args};
    return new Promise(function(resolve, reject){
      self.owner.jrpc.call("XRPC.SendCall", target, rpc, prio, timeout1, timeout2).then((res)=>{
        if (res.error)
          reject(res.error);  
        else
          resolve(res.result);
      }).catch((err)=>{
        reject(err);
      });
    });
  }

}




module.exports = new MoteBus();



