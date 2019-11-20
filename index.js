"use strict";

var util = require('util')
var JRPC2 = require('./jrpc2');
var path = require('path');

const EventEmitter = require('events');
const Def_StackPort = 6262;

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
    let self = this;
    self._stackConnOK = false;
    self._appName = "";
    self._multiInst = false;
    self.MMA = {};
    self.modules = {};
    self.stackConn = JRPC2.create()
    .on('connect',()=>{
      //console.log('MoteBus.connected.');
      self.MMA = {};
      self.modules = {};

      self.stackConn.call('CORE.Startup', self._appName, self._multiInst)
      .then((result)=>{
        self._stackConnOK = true;
        self.emit('ready');
      })
      .catch((err)=>{
        console.log("Error: Unable to connect MoteBus. ", err);
      });
    })
    .on('disconnect',()=>{
      self._stackConnOK = false;
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
    .expose('XSHARE.RecvConfigChanged', function(catlog, keypath){
      if (self._xshare) 
        self._xshare.emit('configChanged', catlog, keypath);
      return "OK";
    })
    .expose('XSHARE.RecvSecretChanged', function(catlog, keypath){
      if (self._xshare) 
        self._xshare.emit('secretChanged', catlog, keypath);
      return "OK";
    })
    .expose('XSHARE.RecvBucketChanged', function(catlog, storename){
      if (self._xshare) 
        self._xshare.emit('bucketChanged', catlog, storename);
      return "OK";
    })
    .expose('CORE.RecvHostState', function(udid,online,reason){
      /*
      console.log('CORE.RecvConnEvent( %s, %s )', udid, online);
      */
      self.emit('hostState', udid, online, reason);
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

  xSHARE() {
    let self = this;
    if (!self._xshare)
      self._xshare = new XSHARE(this);
    return self._xshare;
  }

  getInfo() {
    let self = this;
    return self.stackConn.call('CORE.GetInfo');
  }

  isReady() {
    return _stackConnOK;
  }

  getHostInfo(keyword) {
    let self = this;
    return self.stackConn.call('CORE.HostInfo',keyword);
  }

  getHostList() {
    let self = this;
    return self.stackConn.call('CORE.HostList','');
  }

  hostLink(target, conCount, retries) {
    let self = this;
    return self.stackConn.call('CORE.HostLink',target, conCount, retries);
  }

  hostUnlink(target) {
    let self = this;
    return self.stackConn.call('CORE.HostUnlink',target);
  }

  hostCluster(target, serverlist, smode) {
    let self = this;
    return self.stackConn.call('CORE.HostCluster',target, serverlist, smode);
  }

  startUp(stackIp, stackPort, appName, multiInst) {
    let self = this;
    var bsHost, bsPort, apName;

    if (stackIp)
      bsHost = stackIp;
    else
      bsHost = "127.0.0.1";

    if (stackPort)
      bsPort = stackPort;
    else 
      bsPort = Def_StackPort;

    if (appName) {
      self._appName = appName;  
    } else {
      self._appName = path.basename(require.main.filename, ".js");
    }
    
    if (multiInst) {
      self._multiInst = multiInst;  
    }

    //console.log(bsHost, bsPort);

    if ((bsHost!="") && (bsPort!=0))
      self.stackConn.connectTo( bsHost, bsPort, "mbStack" );
  }
}

//=========================================
class XMSG extends EventEmitter {

  constructor(owner) {
    super();
    let self = this;
    //console.log("XMSG.create()");
    self.owner = owner;
    self.idCode = '';
    self.trackCB = {};
  }

  recvMessage(msg) {
    let self = this;
    //console.log('XMsg.recvMessage( %s )', util.inspect(msg,false,null));
    self.emit("message",msg);
  }

  recvTKInfo(info) {
    let self = this;
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
    let self = this;
    //console.log("XMSG.open(%s,%s,%s)", alias, password, unque);
    self.owner.stackConn.call('XMSG.Open', alias, password, unque )
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
    let self = this;
    /*
    console.log("XMSG.send(%s, %s, %s, %s, %d, %d, %d)", 
      self.idCode, target, util.inspect(body,false,null),
      util.inspect(files,false,null), prio, timeout1, timeout2);
    */
    self.owner.stackConn.call('XMSG.Send', self.idCode, target, body, files, prio, timeout1, timeout2 )
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
    let self = this;
    /*
    console.log("XMSG.reply(%s, %s, %s, %d, %d)", 
      util.inspect(head,false,null),
      util.inspect(body,false,null),
      util.inspect(files,false,null),prio,timeout1,timeout2);
    */
    self.owner.stackConn.call('XMSG.Reply', self.idCode, head, body, files, prio, timeout1, timeout2 )
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
    let self = this;
    //console.log("XMSG.extract(%s, %s)", msgid, path); 

    self.owner.stackConn.call('XMSG.Extract', self.idCode, msgid, path )
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
    let self = this;
    self.owner = owner;
  }

  publish(appname, module) {
    //console.log("XRPC.publish()");
    let self = this;
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
    return self.owner.stackConn.call("XRPC.Publish", appname, names);
  }

  unpublish(appname) {
    //console.log("XRPC.unpublish()");
    let self = this;
    return self.owner.stackConn.call("XRPC.Unpublish", appname);
  }


  isolated(module) {
    //console.log("XRPC.publish()");
    let self = this;
    var names = Object.keys(module);
    return new Promise(function(resolve, reject){
      self.owner.stackConn.call("XRPC.Isolated", names).then((userId)=>{
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
    let self = this;
    var rpc = {'method': funname,
               'params': args};
    return new Promise(function(resolve, reject){
      self.owner.stackConn.call("XRPC.SendCall", target, rpc, prio, timeout1, timeout2).then((res)=>{
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


class XSHARE extends EventEmitter {
  constructor(owner) {
    super();
    let self = this;
    self.owner = owner;
  }

  //var xshare = motebus.xSHARE();
  getConfig(catlog, keypath) {
    let self = this;
    //console.log("XSHARE.getConfig(%s, %s)", catlog, keypath); 
    return self.owner.stackConn.call("XSHARE.GetConfig", catlog, keypath);
  }

  setConfig(catlog, keypath, value) {
    let self = this;
    //console.log("XSHARE.setConfig(%s, %s, %s)", catlog, keypath, value); 
    return self.owner.stackConn.call("XSHARE.SetConfig", catlog, keypath, value);
  }
  //xshare.on('configChanged', (catlog, keypath)=>{});

  getSecret(catlog, keypath, password) {
    let self = this;
    //console.log("XSHARE.getSecret(%s, %s, %s)", catlog, keypath, password); 
    return self.owner.stackConn.call("XSHARE.GetSecret", catlog, keypath, password);
  }

  setSecret(catlog, keypath, value, password) {
    let self = this;
    //console.log("XSHARE.setSecret(%s, %s, %s, %s)", catlog, keypath, value, password); 
    return self.owner.stackConn.call("XSHARE.SetSecret", catlog, keypath, value, password);
  }
  //xshare.on('secretChanged', (catlog, keypath)=>{});


  getCached(catlog, idname) {
    let self = this;
    //console.log("XSHARE.getCached(%s, %s)", catlog, idname); 
    return self.owner.stackConn.call("XSHARE.GetCached", catlog, idname);
  }

  setCached(catlog, idname, value) {
    let self = this;
    //console.log("XSHARE.setCached(%s, %s, %s)", catlog, idname, value); 
    return self.owner.stackConn.call("XSHARE.SetCached", catlog, idname, value);
  }

  removeCached(catlog, idname) {
    let self = this;
    //console.log("XSHARE.removeCached(%s, %s)", catlog, idname); 
    return self.owner.stackConn.call("XSHARE.RemoveCached", catlog, idname);
  }

  clearCached(catlog) {
    let self = this;
    //console.log("XSHARE.clearCached(%s)", catlog); 
    return self.owner.stackConn.call("XSHARE.ClearCached", catlog);
  }



  getBucket(catlog, storeName) {
    let self = this;
    //console.log("XSHARE.getBucket(%s, %s)", catlog, storeName); 
    return new Promise(function(resolve, reject){
      self.owner.stackConn.call("XSHARE.GetBucket", catlog, storeName).then((result)=>{
        if (result.mode == 0) {
          resolve(new Buffer(result.value,'base64'));
        } else {
          resolve(result.value);
        }
      }).catch((error)=>{
        reject(error);
      });
    });
  }

  setBucket(catlog, storeName, rawData) {
    let self = this;
    var x, mode;
    //console.log("XSHARE.setBucket(%s, %s)", catlog, storeName); 
    if (Buffer.isBuffer(rawData)) {
      x = rawData.toString('base64');
      mode = 0;
    } else {
      x = "" + rawData;
      mode = 1;
    }
    return self.owner.stackConn.call("XSHARE.SetBucket", catlog, storeName, x, mode);
  }

  removeBucket(catlog, storeName) {
    let self = this;
    //console.log("XSHARE.removeBucket(%s, %s)", catlog, storeName); 
    return self.owner.stackConn.call("XSHARE.RemoveBucket", catlog, storeName);
  }

  listBucket(catlog) {
    let self = this;
    //console.log("XSHARE.listBucket(%s)", catlog); 
    return self.owner.stackConn.call("XSHARE.ListBucket", catlog);
  }
  //xshare.on('bucketChanged', (catlog, storeName)=>{});


}


module.exports = new MoteBus();



