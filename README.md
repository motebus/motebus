# motebus

MoteBus is a message transport bus for peer-to-peer communication. It supports xMsg, xRPC protocols.

To use this package, it is necessary to acquire the motebus binary file from https://www.ypcloud.com/download/motebushelloworld.zip


### Install 

    npm install motebus
    
### Usage

Add the motebus module to the code
    
    motebus = require('motebus');
   
The module mainly contains two classes: xRPC and xMsg

### xRPC   
    xrpc = motebus.xRPC();

xRPC contains two functions

The publish function will publish the app which contains your functions on the motebus network. 
    
    xrpc.publish("APPNAME","MODULE");
        "APPNAME"             expects a string of the appname being defined in your program
        "MODULE"              expects a string of the function defined inside the appname, multi functions are possible.

The call function will call the function that has been published 
    
    xrpc.call("TARGET","FUNCTION","ARGUMENTS","PRIO","TIMEOUT1","TIMEOUT2");
        "TARGET"              expects a string of MMA, which contains "APPNAME"@"IP"
        "FUNCTION"            expects a string as the function name in App
        "ARGUMENT"            expects a list in dictionary format such as {"A":"12","B":"25"}
        "PRIO"                expects an Integer to indicate the priority of the request
        "TIMEOUT1"            expects an Integer to indicate the maximum sending time
        "TIMEOUT2"            expects an Integer to indicate the maximum reply waiting time
   
### xMsg
    xmsg = motebus.xMsg();
xMsg contains 4 functions

The open function sets the current user as available

    xmsg.open("ALIAS","PASSWORD","UNIQUE","CALLBACK");
        "ALIAS"               expects a string of the ID published on the network
        "PASSWORD"            expects a password string, can be left blank
        "UNIQUE"              expects a string of "true" or "false", permission for duplicated ALIAS ID 
        "CALLBACK"            expects a defined function for callback action 
        
The send function sends the message to the previously defined target

    xmsg.send("TARGET","BODY","FILES","PRIO","TIMEOUT1","TIMEOUT2","CALLBACK");
        "TARGET"              expects a string of MMA, which contains "APPNAME"@"IP"
        "BODY"                expects a string of the message
        "FILES"               expects a string of the file path
        "PRIO"                expects an Integer to indicate the priority of the request
        "TIMEOUT1"            expects an Integer to indicate the maximum sending time
        "TIMEOUT2"            expects an Integer to indicate the maximum reply waiting time
        "CALLBACK"            expects a defined function for callback action 
        
The reply function is used to reply to the received message

    xmsg.reply("HEAD","BODY","FILES","PRIO","TIMEOUT1","TIMEOUT2","CALLBACK");
        "HEAD"                expects a string of MMA, which contains "APPNAME"@"IP"
        "BODY"                expects a string of the message
        "FILES"               expects a string of the file path
        "PRIO"                expects an Integer to indicate the priority of request
        "TIMEOUT1"            expects an Integer to indicate the maximum sending time
        "TIMEOUT2"            expects an Integer to indicate the maximum reply waiting time
        "CALLBACK"            expects a defined function for callback action 

The extract function is for saving the file received to the PATH you defined. 
    
    xmsg.extract("MESSAGE_ID","PATH","CALLBACK");
        "MESSAGE_ID"          expects a string of the senders DDN
        "PATH"                expects a string of the stored file path
        "CALLBACK"            expects a defined function for callback action 

