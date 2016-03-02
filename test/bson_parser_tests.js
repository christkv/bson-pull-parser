var assert = require('assert'),
  f = require('util').format,
  bson = require('bson'),
  BSON = bson.pure().BSON,
  Parser = require('../lib/bson_pull_parser');

var hydrate = function(buffer) {
  // Create parser
  var parser = new Parser();
  // Set the input source, resets the parser
  parser.setInput(buffer);

  // Get the eventType
  var eventType = parser.eventType();

  // Build the object
  var object = null;
  var current = object;
  var parent = null;
  var pointers = [];

  // Go over the document
  while(eventType != Parser.END_DOCUMENT) {
    switch(eventType) {
      case Parser.START_OBJECT: {
        if(object == null) {
          object = {};
          current = object;
          pointers.push(current);
        } else {
          pointers.push(current);
          current[parser.name()] = {};
          current = current[parser.name()];
        }

        break;
      }
      case Parser.END_OBJECT: {
        current = pointers.pop();
        break;
      }
      case Parser.START_ARRAY: {
        break;
      }
      case Parser.END_ARRAY: {
        break;
      }
      case Parser.FIELD: {
        // console.log("---------------------------------- FIELD " + parser.name())
        current[parser.name()] = parser.value();
        // console.dir(current)
        break;
      }
    }

    eventType = parser.next();
  }

  return object;
}

describe('Parser', function() {
  describe('BSON parsing', function() {
    it('simple object with single document field', function() {
      var doc = {'hello': 'world'};
      var buffer = new BSON().serialize(doc);
      var object = hydrate(buffer);
      assert.deepEqual(doc, object)
    });

    it('simple object with single nested document', function() {
      var doc = {'hello': { 'object': 'world' }};
      var buffer = new BSON().serialize(doc);
      var object = hydrate(buffer);
      assert.deepEqual(doc, object)
    });
  });
});
