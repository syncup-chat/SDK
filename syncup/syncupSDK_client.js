import { Meteor } from 'meteor/meteor';
import { check } from 'meteor/check';
import { Tracker } from 'meteor/tracker';

var apiHost;
var params = window.location.search.substr(1).split('&');
if(params.length) {
  params.some(function(kv) {
    var param = kv.split('=');
    if (param[0] === 'origin') {
      apiHost = decodeURIComponent(param[1]);
      Meteor.call('setAPIHost', apiHost, function(error, result) {
        SyncupSDK.init();
      });
      return true;
    }
  });
}
if (!apiHost)
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
  var _sentConfid;
  var _confid;
  var _emails;
  var _email;
  var _name;
  var _title;

  var _fullscreen = false;

  var contextPromise;
  var contextCB = {};
  var fullscreenPromise;
  var fullscreenCB = {};
  
  var confChangedHandlers = {};

  this.init = function() {
    if(parent !== window) {
      if(apiHost && !_emails){
        parent.postMessage({type:'getContext'}, apiHost);
        parent.postMessage({type:'getEmails'}, apiHost); 
      }
    }
    else if(window.webkit)
    {
      if(!_emails) {
        window.webkit.messageHandlers.getContext.postMessage({});
        window.webkit.messageHandlers.getEmails.postMessage({});
      }
    }
    else if(localStorage['sci-email'] && localStorage['sci-token']) {
      var emails = {};
      emails[localStorage['sci-email']] = localStorage['sci-token'];
      _emails = emails;
      _email = localStorage['sci-email'];
      _confid = localStorage['sci-confid'];  
    } 
    
    if(_emails) {
      Meteor.call('publishEmails', _emails);
      Meteor.call('setContext', _confid, _email);
      if(contextPromise)
      {
        var context = Context();
        contextCB.resolve(context);
        contextPromise = null;
      }
      sendConfUpdate();
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
  };

  var sendConfUpdate = function() {
    if(Object.keys(confChangedHandlers).length && _confid !== _sentConfid)
    {
      for(let key of Object.keys(confChangedHandlers))
          confChangedHandlers[key](_confid, _email, _name, _title);
      _sentConfid = _confid;
    }
  };

  this.toggleFullscreen = function() {
    var enabled = !_fullscreen;
    
    fullscreenPromise = fullscreenPromise || new Promise(function(resolve,reject){
      fullscreenCB.resolve = resolve; 
      fullscreenCB.reject = reject;
    });
    if(parent !== window) { //only works for spa, not app or localhost dev
        parent.postMessage({type:'goFull', enabled}, apiHost);
    }

    return fullscreenPromise; 
  };

  this.getContext = function() {
    if(!_email && !_confid)
    {
      contextPromise = contextPromise || new Promise(function(resolve,reject){
        contextCB.resolve = resolve; 
        contextCB.reject = reject;
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
    return new Promise(function(resolve,reject){
      Meteor.call('sendBotChat', message, cuid, function(error, resp) {
        if(error)
          reject(error);
        else
          resolve(resp);
      });
    });
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
    
    if(spa)
      sendConfUpdate();
  };
  
  //get the status of the Syncup Conferences by using post message handling
  postMessageHandling = function(msg) { 
    var origin = msg.origin || msg.originalEvent.origin;
    if(origin.match(/https:\/\/(?:\w+.)*syncup.at[\S]*/i)) {
      console.log("iframe recieved: " + JSON.stringify(msg.data));
      if(msg.data.type) {
        if(msg.data.type === 'confChanged' || msg.data.type === 'getContext') { 
          var confid = msg.data.confid;
            var email = msg.data.email;
            var name = msg.data.name;
            
            SetConf(confid, email, name, msg.data.title, true);
            if(contextPromise)
            {
              var context = Context();
              contextCB.resolve(context);
              contextPromise = null;
            }
        }
        else if(msg.data.type === 'goFull') {
          _fullscreen = msg.data.enabled;
          if(fullscreenPromise)
          {
            fullscreenCB.resolve(_fullscreen);
            fullscreenPromise = null;
          }
        }
        else if(msg.data.type === 'getEmails') {
          var emails = msg.data.emails;
          _emails = emails;
          Meteor.call('publishEmails', emails);
        }
      } 
    } 
  } 
  window.addEventListener('message', postMessageHandling, false);

  //communication with the iOS App
  document.addEventListener("iOSMessage", function(event) {
    //if(window.webkit)
    //{
      var msg = event.message;
      if(msg.type) {
        if(msg.type === 'confChanged' || msg.type === 'getContext') { 
          var confid = msg.data.confid;
            var email = msg.data.email;
            var name = msg.data.name;
            
            SetConf(confid, email, name, msg.data.title, true);
            if(contextPromise)
            {
              var context = Context();
              contextCB.resolve(context);
              contextPromise = null;
            }
        }
        else if(msg.type === 'getEmails')
        {
          var emails = msg.data.emails;
          _emails = emails;
          Meteor.call('publishEmails', emails);
        }
     }
    //}
  }, false);
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
