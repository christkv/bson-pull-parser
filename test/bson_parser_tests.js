var assert = require('assert'),
  f = require('util').format,
  bson = require('bson'),
  Code = bson.Code,
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
  var pointers = [];

  // Special handling of codeWScope object
  var inCodeWScopeObject = null;

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
        // console.log("~~~~~~~~~~~~~~~~~~~~~~~ END_OBJECT")
        // console.dir(current)

        if(inCodeWScopeObject) {
          inCodeWScopeObject.scope = current;
          inCodeWScopeObject = null;
        }

        current = pointers.pop();
        break;
      }
      case Parser.START_ARRAY_OBJECT: {
        pointers.push(current);
        current[parser.name()] = [];
        current = current[parser.name()];
        break;
      }
      case Parser.START_CODE_W_SCOPE_OBJECT: {
        // console.log("~~~~~~~~~~~~~~~~~~~~~~~ START_CODE_W_SCOPE_OBJECT")
        inCodeWScopeObject = parser.value();
        current[parser.name()] = parser.value();
        pointers.push(current);
        current = {}
        break;
      }
      case Parser.FIELD: {
        // console.log("~~~~~~~~~~~~~~~~~~~~~~~ FIELD :: " + parser.name())
        current[parser.name()] = parser.value();
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

    it('simple object with single array field', function() {
      var doc = {'hello': ["1", "2", "3"]};
      var buffer = new BSON().serialize(doc);
      var object = hydrate(buffer);
      assert.deepEqual(doc, object)
    });

    it('complex nested object with array of objects', function() {
      var doc = {'hello': ["1", {
        'array': ["5, 6, 7"],
        'obj': {
          'nested': {
            'a': ['9', '10']
          }
        }
      }, "3"]};
      var buffer = new BSON().serialize(doc);
      var object = hydrate(buffer);
      assert.deepEqual(doc, object)
    });

    it('code with scope document', function() {
      var doc = {'code': new Code('function() {}', {'a':1})};
      var buffer = new BSON().serialize(doc);
      var object = hydrate(buffer);
      assert.deepEqual(doc, object)
    });

  });
});
