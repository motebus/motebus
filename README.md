# motebus

MoteBus is a message transport bus for peer-to-peer communication. It supports xMsg, xRPC, xOBJ and xSync protocols.

### Install 

    npm install motebus
    
### Usage

Import the motebus module to the code
    
    motebus = require('motebus');
   
The module mainly contain two class, xRPC, xMsg

### xRPC   
    xrpc = motebus.xRPC();

xRPC contain two functions

Publish function will publish the app which contain your functions on to the motebus network. 
    
    xrpc.publish("APPNAME","MODULE");
        "APPNAME"             expect a string of the appname being defined in your program
        "MODULE"              expect a string of the function defined inside the appname, multi function is possible.

Call function will call the function that has been published 
    
    xrpc.call("TARGET","FUNCTION","ARGUMENTS","PRIO","TIMEOUT1","TIMEOUT2");
        "TARGET"              expect a string of MMA, which contain "APPNAME"@"IP"
        "FUNCTION"            expect an string as the function name in App
        "ARGUMENT"            expect an list of dictionary format of variable such as {"A":"12","B":"25"}
        "PRIO"                expect an Interger to indicate the priority of request
        "TIMEOUT1"            expect an Interger to indicate the time to retry
        "TIMEOUT2"            expect an Interger to indicate the time to disconnect if not responsed
   
### xMsg
    xmsg = motebus.xMsg();
xMsg contain 4 functions
    
    xmsg.open("ALIAS","PASSWORD","UNQUE","CALLBACK");
    xmsg.send("TARGET","BODY","FILES","PRIO","TIMEOUT1","TIMEOUT2","CALLBACK");
    xmsg.reply("HEAD","BODY","FILES","PRIO","TIMEOUT1","TIMEOUT2","CALLBACK");
    xmsg.extract("MESSAGE_ID","PATH","CALLBACK");

