Package.describe({
  name: 'hblockhus:syncup',
  version: '1.0.15',
  // Brief, one-line summary of the package.
  summary: 'an SDK for creating SyncUp Widgets',
  // URL to the Git repository containing the source code for this package.
  git: 'https://github.com/syncup-chat/SDK/tree/master/syncup',
  // By default, Meteor will default to using README.md for documentation.
  // To avoid submitting documentation, set this field to null.
  documentation: 'README.md'
});

Package.onUse(function(api) {
  api.versionsFrom('1.3.2.4');
  
  api.use(['ecmascript', 'meteor', 'mongo', 'http'], ['client', 'server']);
  api.use('iron:router@1.0.12', 'server', {weak:false, unordered:false});  
  
  api.addFiles(['syncupSDK_server.js'], ['server']);
  api.addFiles(['syncupSDK_client.js'], ['client']);

  api.export('SyncupSDK', 'client');
  api.export(['Confs', 'Sessions', 'confidForConnection'], 'server');
});

Package.onTest(function(api) {
  api.use('ecmascript');
  api.use('tinytest');
  api.use('hblockhus:syncup', ['client','server']);

  api.addFiles('tests/client-tests.js', 'client');
  api.addFiles('tests/server-tests.js', 'server');
});
