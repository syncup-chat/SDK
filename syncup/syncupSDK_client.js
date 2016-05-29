import { Meteor } from 'meteor/meteor';
import { check } from 'meteor/check';
import { Tracker } from 'meteor/tracker';

var apiHost;
Meteor.call('getAPIHost', function(error, result) {
  apiHost = "https://syncup.at"; //default
  if(error)
    console.log(error)
  else 
    apiHost = result;

  SyncupSDK.init();
});
Meteor.subscribe('sessions');

function SDK() { 
  var _confid;
  var _emails;
  var _email;
  var _name;
  var _title;

  var contextPromise;
  var Resolve;
  var Reject;
  var confChangedHandlers = {};

  this.init = function() {
    if(parent !== window && apiHost) {
      if(_emails)
        Meteor.call('publishEmails', _emails);
      else
      {
        parent.postMessage({type:'getContext'}, apiHost);
        parent.postMessage({type:'getEmails'}, apiHost); 
      }
    }
    else if(localStorage['sci-email'] && localStorage['sci-token']) {
      var emails = {};
      emails[localStorage['sci-email']] = localStorage['sci-token'];
      _emails = emails;
      _email = localStorage['sci-email'];
      _confid = localStorage['sci-confid'];
      console.log('emails', emails);
      Meteor.call('publishEmails', emails);
      Meteor.call('setContext', localStorage['sci-confid'], _email);
      if(contextPromise)
      {
        var context = Context();
        Resolve(context);
        contextPromise = null;
      }
      for(var key in confChangedHandlers)
        if(confChangedHandlers.hasOwnProperty(key))
          confChangedHandlers[key](_confid, _email, _name, _title);
    }
  };
  
  var Context = function() {
    var context = {};
    if(_email)
      context.email = _email;
    if(_confid)
      context.confid = _confid;
    if(_name)
      context.name = _name;
    if(_title)
      context.title = _title;
    
    return context;
  }

  this.getContext = function() {
    if(!_email && !_confid)
    {
      console.log('test');
      contextPromise = contextPromise || new Promise(function(resolve,reject){
        Resolve = resolve; 
        Reject = reject;
        
      });
      return contextPromise;
    }
   
    return Promise.resolve(Context());
  };

  this.setConf = function(cuid, email, name, title) {
    //check(cuid, String);
    SetConf(cuid, email, name, title, false);
    if(parent && parent !== window)  
      parent.postMessage({type:'setConf', confid:cuid}, apiHost);
  };

  this.registerConfChangedHandler = function(handler) {
    if(typeof(handler) === typeof(Function))
    {
      var handlerID = (Math.random() + 1).toString(36).substring(8);
      confChangedHandlers.handlerID = handler;
      if(_confid)
        confChangedHandlers.handlerID(_confid, _email, name, _title);
      
      return handlerID;
    }
  };
  
  this.removeConfChangedHandler = function(handlerID) {
    delete confChangedHandlers[handlerID]; 
  };

  this.leaveConf = function(cuid, spa) {
    check(cuid, String);
    _confid = null;
    if(parent && parent !== window && !spa)
      parent.postMessage({type:'leaveConf', confid:cuid}, apiHost);
  };

  this.sendBotChat = function(message, cuid) {
    check(message, String);
    check(cuid, String);
    Meteor.call('sendBotChat', message, cuid);
  };
  
  var SetConf = function(cuid, email, name, title, spa) {
    _confid = cuid;
    if(title)
      _title = title;
    if(email)
    {
      _email = email;
      if(name)
        _name = name;
      Meteor.call('setContext', cuid, email); 
    }
    else 
      Meteor.call('setContext', cuid);
    
    if(spa && Object.keys(confChangedHandlers).length)
    {
      for(let key of Object.keys(confChangedHandlers))
	confChangedHandlers[key](_confid, _email, _name, _title);
    }
  };
  
  //get the status of the Syncup Conferences by using post message handling
  postMessageHandling = function(msg) { 
    var origin = msg.origin || msg.originalEvent.origin;
    if(origin.match(/https:\/\/[\S]*.syncup.at[\S]*/i)) { 
      console.log("iframe received: " + JSON.stringify(msg.data));
      if(msg.data.type) {
        if(msg.data.type === 'confChanged' || msg.data.type === 'getContext') { 
          var confid = msg.data.confid;
	  var email = msg.data.email;
	  var name = msg.data.name;

	  SetConf(confid, email, name, msg.data.title, true);
	  if(contextPromise)
	  {
	    var context = Context();
	    Resolve(context);
	    contextPromise = null;
	  }
        }
        else if(msg.data.type === 'getEmails')
        {
          var emails = msg.data.emails;
          _emails = emails;
          Meteor.call('publishEmails', emails);
        }
      } 
    } 
  } 
  window.addEventListener('message', postMessageHandling, false);
};

//global sdk object
SyncupSDK = new SDK();

//initialize the sdk when connected to the server
var oldStat;
Tracker.autorun(function() {
  var con = Meteor.status();
  console.log('status', con);
  if(con.status !== oldStat && con.status === 'connected')
    SyncupSDK.init();

  oldStat = con.status;
});
