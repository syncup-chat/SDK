## Syncup SDK 

A meteor package to use when writing a Syncup Widget 

## Requirements in settings file

In order to use this SDK you need to add three values to your settins file for "syncup"
* "apiHost" - the site you wish to run next to 
* "id" - the Widget id given to you by SyncUp
* "secret" - the Widget API key given to you by Syncup
     
This will allow you to send chat from the Widget

example minimum settings file:
```json
{
  "syncup": {
    "apiHost" : "https://syncup.at",
    "id" : "YOUR_WIDGET_ID",
    "secret": "YOUR_WIDGET_API_KEY"
  }
}
```

## Client-side API

### The SyncupSDK object has the following methods:

---

The getContext method will return an object that contains 4 possible keys
* confid - a unique identifier for the current chat 
* title - the title of the current chat
* email - the current email of the user
* name - the current name of the user

```js
var currContext = SyncupSDK.getContext()
if(currContext.confid)
  ;//Filter collection
if(currContext.email)
  ;//display email
```

---

The setConf method will change the chat context to that of the provided confid

```js
Template.confidTask.events({
  'click .confName'(e, instance) {
    SyncupSDK.setConf(this.confID);
  },
});
```
---

The registerConfChangedHandler can be used to register a callback function that is fired when the user switches chat context within the Syncup page. 
If the user is currently in a chat context at the time the callback is registered, it will immediatly be called with that state.
You can register multiple of these callbacks.
The removeConfChangedHandler removes the callback if you no longer need it. Don't forget to do this clean up if a template is going away.

Register Handler:
```js
var handlerID = SyncupSDK.registerConfChangedHandler(function(confid, email, name, title) {
  var url = "/";
  if(confid && confid.length)
  {
     url += 'confid/'+confid;
     if(email)
       url += '?email='+email;
     if(name)
       url += '&name='+name;
     if(title)
       url += '&title='+title;
  } 
  else if(email)
    url += 'email/'+email;
  Router.go(url);
});
```

Clean Up:
```js
SyncupSDK.removeConfChangedHandler(handlerID);
```
---

The sendBotChat method can be called to insert chat from the widget

```js
Template.taskList.events({
  'submit .new-task'(event) {
    // Prevent default browser form submit
    event.preventDefault();

    // Get value from form element
    const text = event.target.text.value;
    const confid = this.confid ;
    const title = this.title;
    const email = this.email;
    const name = this.name;

    // Insert a task into the collection
    Meteor.call('tasks.insert', text, confid, email, title);

    //Syncup bot chat
    const message = name+' added a new todo: '+text;
    console.log(message);

    SyncupSDK.sendBotChat(message, confid);

    target.text.value = '';
  },
});
```

## Server Side 

### Methods

The confidForConnection method will return a promise that resolves with the current confid given a session id

```js
Meteor.methods({
    'myCollection.insert' : function(data) {
      check(data, Object);
      
      confidForConnection( this.connection.id ).then( (confid) => {
        myCollection.insert(confid, data});
      }).catch( ( error ) => {
        throw new Meteor.Error( '404' , error );
      });
    }
  });
```

---

### Collections

you can use the Sessions and Confs Collections to help filter your data and keep your Meteor app secure

Here is an example from a simple Todo List, here we publish the Todo items based on the users emails
*note: this code makes use of peerlibrary:reactive-publish

```js
Meteor.publish('emailTasks', function emailTasksPublication() {
    this.autorun(function() {
      var session = Sessions.findOne({sid:this._session.id});
      var emailArr = [];
      if(session && session.emailArray)
        emailArr = session.emailArray;
      return EmailTasks.find({
          email:{
            $exists:true,
            $in:emailArr},
        });
    });
  });
```

Description of the collections 

1. Sessions
    * sid - the session id 
    * emailArray - an array of the emails for the user
    * confid - the current confid (Can be NULL if user is not currently in a conference)
2. Confs 
    * email 
    * confids - an array of confids that correspond to the email