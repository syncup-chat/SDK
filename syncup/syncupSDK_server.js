import { Meteor } from 'meteor/meteor';
import { Mongo } from 'meteor/mongo';

// live state, cleared on restart or client disconnect
Sessions = new Mongo.Collection('sessions');
// persistent email <-> conf mapping built as clients connect
Confs = new Mongo.Collection('confs');

Meteor.startup(() => {
  Sessions.remove({});
  // code to run on server at startup
  Meteor.publish('sessions', function sessionsPublication() {
    var sessionID = this._session.id;
    this._session.socket.on("close", Meteor.bindEnvironment(function()
    {
      Sessions.remove({sid:sessionID});
    }, function(e){console.log(e)})); 
  
    return Sessions.find({});
  });
});

// webhooks 
Router.route("/webhook/:eventName/:email", 
  { 
    where : "server" 
  }).get( function() {
    console.log('GET webhook', this.params, this.request.body); 
    //this.response.setHeader( 'access-control-allow-origin', 'https://syncup.at' ); 
    var eventName = this.params.eventName;
    var email = this.params.email;
    var query  = this.request.query;
     
    var sessions = Sessions.find({}).fetch(); 
    if ( sessions.length ) {
      this.response.statusCode = 200;
      this.response.end( JSON.stringify(this.request.body) ); }
    else {
      this.response.statusCode = 404;
      this.response.end( "Sessions not found." );
    }
  }).post( function() {
    console.log('POST webhook', this.params, this.request.body); 
    //this.response.setHeader( 'access-control-allow-origin', 'https://syncup.at' ); 
    var eventName = this.params.eventName;
    var email = this.params.email;
    var query  = this.request.query;
     
    this.response.statusCode = 200;
    this.response.end( "recieved" ); 
  }).put( function() {
  }).delete( function() {
  });

// Method calls 
Meteor.methods({
  getAPIHost : function() {
    return Meteor.settings.syncup.apiHost;
  },
  sendBotChat: function(text, CUID, email) {
     this.unblock();
     var session = Sessions.findOne({sid: this.connection.id});
     var members = session && session.confid ? Confs.find({confids:{$in:[CUID]}}, {fields:{email:1}}).fetch() : [];
     console.log('members', members);
     var tokens = session && session.tokens ? JSON.parse(session.tokens) : {};
     var token; 
     if(email)
        token = tokens[email];
     else if(members.length)
     {
        for(var i = 0; i < members.length; i++)
        {
          var e = members[i].email;
          token = tokens[e];
          if(token)
            break;
        }
     }
     console.log('token',token);
     if(token == null || Meteor.settings.syncup == null)
       return;
     var url = Meteor.settings.syncup.apiHost+"/GroupMessage/"+encodeURIComponent(CUID)+"/"+token;
     console.log('http url:', url);
     var params = {
	 widgetID: Meteor.settings.syncup.id,
	 msg: JSON.stringify({txt: text}),
	 widgetAPIKey: Meteor.settings.syncup.secret 
       };
     console.log('params:', params);
     return Meteor.http.call("GET", url,
     {
       params:params,
     });
    },
  registerWebhook: function(eventType) { //also have list and delete
    this.unblock();
    var session = Sessions.findOne({sid: this.connection.id});
    var emails = session && session.emailArray ? session.emailArray : [];
    var tokens = session && session.tokens ? JSON.parse(session.tokens) : {};
    var token; 
 
    for(var email in tokens)
    {
      console.log(email, token);
      var token = tokens[email];
       
      console.log('token',token);
      if(token === null || Meteor.settings.syncup === null)
	continue;
      var url = Meteor.settings.syncup.apiHost+"/addWebhook/"+eventType+"/"+Meteor.settings.syncup.id+'/' 
                +Meteor.settings.syncup.secret;//token;
      console.log('http url:', url);
      var params = {
            email : email,
            token : token,
            useGet : false,
	  };
      console.log('params:', params);
      Meteor.http.call("GET", url,
      {
	 params:params,
      });
    }
  },
  publishEmails: function(emailsToTokens) {
    console.log(emailsToTokens);
    var connectionID = this.connection.id;
    Meteor.http.call("POST", Meteor.settings.syncup.apiHost+"/validateTokens",
                     {data:emailsToTokens}, function(error, result) {
      var validTokens = result.content ? JSON.parse(result.content) : {};
      //console.log(validTokens, typeof(validTokens));
      var emails = [];
      for(var key in validTokens) {
        emails.push(key);
      }
      var session = Sessions.findOne({sid: connectionID});
      if(session && session._id)
	      Sessions.update(session._id, {$set: {emailArray: emails, tokens:JSON.stringify(validTokens)}});
      else 
	      Sessions.insert({sid:connectionID, emailArray:emails, tokens:JSON.stringify(validTokens)});
    });
  },
  setContext: function(confid, email) {
    if(confid)
    {
      var session = Sessions.findOne({sid: this.connection.id});
      if(session && session._id)
	      Sessions.update(session._id, {$set: {confid: confid}});
      else 
	      Sessions.insert({sid:this.connection.id, confid:confid});
    }
    if(email)
    {
      var confs = Confs.findOne({email:email});
      if(confs && confs._id)
      {
        if(confid && confid.length)
        {
          var confArray = confs.confids;
          if(confArray.indexOf(confid) == -1)
            confArray.push(confid);
          Confs.update(confs._id, {$set: {confids: confArray}});
        }
      }
      else if(confid && confid.length)
        Confs.insert({email:email, confids: [confid]});
      else
        Confs.insert({email:email, confids: []});
    }
  },
});
