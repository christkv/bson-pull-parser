var assert = require('assert'),
  f = require('util').format,
  bson = require('bson'),
  Long = bson.Long,
  ObjectId = bson.ObjectID,
  Binary = bson.Binary,
  Code = bson.Code,
  DBRef = bson.DBRef,
  Symbol = bson.Symbol,
  Double = bson.Double,
  MaxKey = bson.MaxKey,
  MinKey = bson.MinKey,
  Timestamp = bson.Timestamp,
  BSON = bson.pure().BSON,
  Parser = require('../lib/bson_pull_parser');

var hydrate = function(buffer) {
  // Create parser
  var parser = new Parser();
  // Set the input source, resets the parser
  parser.setInput(buffer);

  // Get the eventType
  var eventType = parser.eventType;

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
          current[parser.name] = {};
          current = current[parser.name];
        }

        break;
      }
      case Parser.END_OBJECT: {
        if(inCodeWScopeObject) {
          inCodeWScopeObject.scope = current;
          inCodeWScopeObject = null;
        }

        if(current['$ref'] && current['$id']) {
          var dbref = new DBRef(current['$ref'], current['$id'], current['$db']);
        }

        current = pointers.pop();
        if(dbref) current[parser.parent] = dbref;
        break;
      }
      case Parser.START_ARRAY_OBJECT: {
        pointers.push(current);
        current[parser.name] = [];
        current = current[parser.name];
        break;
      }
      case Parser.START_CODE_W_SCOPE_OBJECT: {
        inCodeWScopeObject = parser.value;
        current[parser.name] = parser.value;
        pointers.push(current);
        current = {}
        break;
      }
      case Parser.FIELD: {
        current[parser.name] = parser.value;
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

    it('handle complex object with all types', function() {
      // First doc
      var date = new Date();
      var oid = new ObjectId();
      var string = 'binstring';
      var bin = new Binary(new Buffer('binstring'));

      var doc = {
        'string': 'hello',
        'array': [1,2,3],
        'hash': {'a':1, 'b':2},
        'date': date,
        'oid': oid,
        'binary': bin,
        'int': 42,
        'float': 33.3333,
        'regexp': /regexp/,
        'boolean': true,
        'long': date.getTime(),
        'where': new Code('this.a > i', {i:1}),
        'dbref': new DBRef('namespace', oid, 'integration_tests_')
      }

      var buffer = new BSON().serialize(doc);
      var object = hydrate(buffer);
      assert.deepEqual(doc, object)
    });
  });
});
