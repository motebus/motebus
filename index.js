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
    self.MMA = {};
    self.jrpc = JRPC2.create()
    .on('connect',()=>{
      //console.log('MoteBus.connected.');
      self.emit('ready');
    })
    .on('disconnect',()=>{
      //console.log('MoteBus.disconnected.');
    })
    .expose('XMsg.RecvMessage', function(idCode,msg){
      //console.log('XMsg.RecvMessage( %s, %s )', idCode, util.inspect(msg,false,null));
      var mma = self.MMA[idCode];
      if ((mma != null) && typeof mma === 'object') {
        setImmediate(function(){
          mma.recvMessage(msg);  
        });
      }
      return "OK";
    })
    .expose('XMsg.RecvTKInfo', function(idCode,info){
      //console.log('XMsg.RecvTKInfo( %s, %s )', idCode, util.inspect(info,false,null));
      var mma = self.MMA[idCode];
      if ((mma != null) && typeof mma === 'object') {
        setImmediate(function(){
          mma.recvTKInfo(info);
        });
      }
      return "OK";
    });
  }

  regMMA(idCode,obj) {
    this.MMA[idCode] = obj;
  }

  unregMMA(idCode) {
    delete this.MMA[idCode];
  }

  xMsg() {
    return new XMSG(this);
  }

  xRPC() {
    return new XRPC(this);
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
    self.owner.jrpc.call('XMsg.Open', alias, password, unque )
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


  send(target, body, files, prio, timeout, callback) {
    var self = this;
    /*
    console.log("XMSG.send(%s, %s, %s, %d, %d)",target,
      util.inspect(body,false,null),
      util.inspect(files,false,null),prio,timeout);
    */
    self.owner.jrpc.call('XMsg.Send', self.idCode, target, body, files, prio, timeout )
    .then((result)=>{
      //console.log('XMsg.send result=', result);
      self.trackCB[result] = callback;
    })
    .catch((err)=>{
      //console.log('XMsg.send error=', err);
      callback(err)
    });
  }


  reply(head, body, files, prio, timeout, callback) {
    var self = this;
    /*
    console.log("XMSG.reply(%s, %s, %s, %d, %d)", 
      util.inspect(head,false,null),
      util.inspect(body,false,null),
      util.inspect(files,false,null),prio,timeout);
    */
    self.owner.jrpc.call('XMsg.Reply', self.idCode, head, body, files, prio, timeout )
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

    self.owner.jrpc.call('XMsg.Extract', self.idCode, msgid, path )
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
    self.data = {};
  }

  publish(appname, module) {
    //console.log("XRPC.publish()");
  }

  call(host, appname, funname, args, timeout, callback) {
    //console.log("XRPC.call()");
  }

}




module.exports = new MoteBus();



