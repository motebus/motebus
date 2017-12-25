# motebus

MoteBus is a message transport bus for peer-to-peer communication. It supports xMsg, xRPC protocols.

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
        "FUNCTION"            expect a string as the function name in App
        "ARGUMENT"            expect a list of dictionary format of variable such as {"A":"12","B":"25"}
        "PRIO"                expect an Interger to indicate the priority of request
        "TIMEOUT1"            expect an Interger to indicate the maximum sending waiting time
        "TIMEOUT2"            expect an Interger to indicate the maximum reply waiting time
   
### xMsg
    xmsg = motebus.xMsg();
xMsg contain 4 functions

Open function publish the current user as available

    xmsg.open("ALIAS","PASSWORD","UNIQUE","CALLBACK");
        "ALIAS"               expect a string of the ID published on the network
        "PASSWORD"            expect a string of password for entry, can be left blank
        "UNIQUE"              expect a string of "true" or "false", permission for duplicated ALIAS ID 
        "CALLBACK"            expect a defined function for callback action 
        
Send function send the message to the target you defined

    xmsg.send("TARGET","BODY","FILES","PRIO","TIMEOUT1","TIMEOUT2","CALLBACK");
        "TARGET"              expect a string of MMA, which contain "APPNAME"@"IP"
        "BODY"                expect a string of message
        "FILES"               expect a string of the file path
        "PRIO"                expect an Interger to indicate the priority of request
        "TIMEOUT1"            expect an Interger to indicate the maximum sending waiting time
        "TIMEOUT2"            expect an Interger to indicate the maximum reply waiting time
        "CALLBACK"            expect a defined function for callback action 
        
Reply function is used to reply the message received

    xmsg.reply("HEAD","BODY","FILES","PRIO","TIMEOUT1","TIMEOUT2","CALLBACK");
        "HEAD"                expect a string of MMA, which contain "APPNAME"@"IP"
        "BODY"                expect a string of message
        "FILES"               expect a string of the file path
        "PRIO"                expect an Interger to indicate the priority of request
        "TIMEOUT1"            expect an Interger to indicate the maximum sending waiting time
        "TIMEOUT2"            expect an Interger to indicate the maximum reply waiting time
        "CALLBACK"            expect a defined function for callback action 

Extract function is for saving the file received to the PATH you defined. 
    
    xmsg.extract("MESSAGE_ID","PATH","CALLBACK");
        "MESSAGE_ID"          expect a string of the senders DDN
        "PATH"                expect a string of the stored file path
        "CALLBACK"            expect a defined function for callback action 

