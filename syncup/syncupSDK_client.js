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

  var confChangedHandler;

  this.init = function() {
    if(parent !== window && apiHost) {
      parent.postMessage({type:'getContext'}, apiHost);
      parent.postMessage({type:'getEmails'}, apiHost); 
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
    }
  };

  this.getContext = function() {
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

  this.setConf = function(cuid, email, name, title, spa) {
    //check(cuid, String);
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
    
    if(spa && confChangedHandler)
      confChangedHandler(_confid, _email, _name, _title);
    else if(parent && parent !== window)  
      parent.postMessage({type:'setConf', confid:cuid}, apiHost);
  };

  this.registerConfChangedHandler = function(handler) {
    if(typeof(handler) === typeof(Function))
    {
      confChangedHandler = handler;
      if(_confid)
        confChangedHandler(_confid, _email, name, _title);
    }
  };

  this.setEmails = function(emails) {
    _emails = emails;
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
};

SyncupSDK = new SDK();

var oldStat;
Tracker.autorun(function() {
  var con = Meteor.status();
  console.log('status', con);
  if(con.status !== oldStat && con.status === 'connected')
    SyncupSDK.init();

  oldStat = con.status;
});

//get the status of the Syncup Conferences by using post message handling
postMessageHandling = function(msg) { 
  var origin = msg.origin || msg.originalEvent.origin;
  if(origin.match(/https:\/\/[\S]*.syncup.at[\S]*/i)) { 
    console.log("iframe recieved: " + JSON.stringify(msg.data));
    if(msg.data.type) {
      if(msg.data.type === 'confChanged' || msg.data.type === 'getContext') { 
        var confid = msg.data.confid;
        //if(confid && confid.length) {
          var email = msg.data.email;
          var name = msg.data.name;
          
          SyncupSDK.setConf(confid, email, name, msg.data.title, true);
      }
      else if(msg.data.type === 'getEmails')
      {
        var emails = msg.data.emails;
        SyncupSDK.setEmails(emails);
        Meteor.call('publishEmails', emails);
        //Meteor.call('registerWebhooks', 'salesforceTask'); 
      }
    } 
  } 
} 
window.addEventListener('message', postMessageHandling, false);

