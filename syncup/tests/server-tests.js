import { Mongo } from 'meteor/mongo';

Tinytest.add('Sessions Collection is available on the server', function ( test ) {
  test.equal( Sessions.constructor, Mongo.Collection);
});

Tinytest.add('Confs Collection is available on the server', function ( test ) {
  test.equal( Confs.constructor, Mongo.Collection);
});

