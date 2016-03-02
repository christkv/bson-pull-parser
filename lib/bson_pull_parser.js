"use strict"

var Long = require('bson').Long,
  Double = require('bson').Double,
  Timestamp = require('bson').Timestamp,
  ObjectID = require('bson').ObjectID,
  Symbol = require('bson').Symbol,
  Code = require('bson').Code,
  MinKey = require('bson').MinKey,
  MaxKey = require('bson').MaxKey,
  DBRef = require('bson').DBRef,
  BSONRegExp = require('bson').BSONRegExp,
  Binary = require('bson').Binary;

var Parser = function() {
}

// Pull parser states
Parser.START_DOCUMENT = 0;
Parser.END_DOCUMENT = 1;
Parser.FIELD = 2;
Parser.START_ARRAY_OBJECT = 3;
Parser.START_OBJECT = 5;
Parser.END_OBJECT = 6;

// BSON Types
Parser.Long = Long;
Parser.Double = Double;
Parser.Timestamp = Timestamp;
Parser.ObjectID = ObjectID;
Parser.Symbol = Symbol;
Parser.Code = Code;
Parser.MinKey = MinKey;
Parser.MaxKey = MaxKey;
Parser.DBRef = DBRef;
Parser.BSONRegExp = BSONRegExp;
Parser.Binary = Binary;

Parser.prototype.setInput = function(buffer, options) {
  options = options || {};

  this.s = {
    // Current State of the parser
    buffer: buffer,
    index: 0,
    depth: 0,
    eventType: Parser.START_DOCUMENT,
    // Current values viewed
    name: null,
    value: null,
    // Options
    promoteLong: typeof options.promoteLong == 'boolean' ? options.promoteLong : true,
    promoteBuffers: typeof options.promoteBuffers == 'boolean' ? options.promoteBuffers : false,
    bsonRegExp: typeof options.bsonRegExp == 'boolean' ? options.bsonRegExp : false
  }
}

Parser.prototype.eventType = function() {
  return this.s.eventType;
}

Parser.prototype.name = function() {
  return this.s.name;
}

Parser.prototype.value = function() {
  return this.s.value;
}

Parser.prototype.depth = function() {
  return this.s.depth;
}

Parser.prototype.next = function() {
  var buffer = this.s.buffer;

  // We are finished
  if(this.s.index >= buffer.length) {
    this.s.eventType = Parser.END_DOCUMENT;
    return this.s.eventType;
  }

  // Start of the document
  if(this.s.eventType == Parser.START_DOCUMENT) {
    console.log("------------------------ next START_DOCUMENT")

    // Read length of the initial object
    var documentSize = buffer.readInt32LE(this.s.index);
    if(documentSize < 5 || documentSize > buffer.length) {
      throw new Error('bson document contains illegal size');
    }

    // Adjust the index
    this.s.index += 4;

    // Set the type to START_OBJECT
    this.s.eventType = Parser.START_OBJECT;
  } else if(this.s.eventType == Parser.START_OBJECT
    || this.s.eventType == Parser.END_OBJECT
    || this.s.eventType == Parser.FIELD
    || this.s.eventType == Parser.START_ARRAY_OBJECT) {
    // console.log("------------------------ next START_OBJECT :: START " + this.s.eventType)
    // Read the type
    var elementType = buffer[this.s.index++];

    // We are done with the object
    if(elementType == 0) {
      this.s.name = null,
      this.s.value = null,
      this.s.eventType = Parser.END_OBJECT;
      return this.s.eventType;
    }

    if(this.s.eventType == Parser.FIELD) {
      console.log("------------------------ next FIELD :: " + elementType)
    } else {
      console.log("------------------------ next START_OBJECT")
    }

    // Get the start search index
		var i = this.s.index;
		// Locate the end of the c string
		while(buffer[i] !== 0x00 && i < buffer.length) {
			i++
		}

    // Did we blow past the size of the buffer
    if(i >= buffer.length) throw new Error("Bad BSON Document: illegal CString")
    // Retrieve the name
    this.s.name = buffer.toString('utf8', this.s.index, i);
    // Adjust index
    this.s.index = i + 1;

    // Set the event Type
    this.s.eventType = Parser.FIELD;

    // console.log("  ==== name " + this.s.name)

    // Switch the element type
    if(elementType == BSON_DATA_STRING) {
      console.log("------------------------ next BSON_DATA_STRING")
      // Read the string size
      var stringSize= buffer.readInt32LE(this.s.index);

      // Skip string size
      this.s.index += 4;

      // Is the string size wrong
			if(stringSize <= 0 || stringSize > (buffer.length - this.s.index) || buffer[this.s.index + stringSize - 1] != 0) {
        throw new Error("bad string length in bson");
      }

      // Set the value and adjust the index
      this.s.value = buffer.toString('utf8', this.s.index, this.s.index + stringSize - 1);
      // console.dir(this.s.value)
      this.s.index = this.s.index + stringSize;
    } else if(elementType == BSON_DATA_OID) {
      var string = buffer.toString('binary', this.s.index, this.s.index + 12);
      this.s.value = new ObjectID(string);
      this.s.index += 12;
    } else if(elementType == BSON_DATA_INT) {
      this.s.value = buffer.readInt32LE(this.s.index);
      this.s.index += 4;
    } else if(elementType == BSON_DATA_NUMBER) {
      this.s.value = buffer.readDoubleLE(this.s.index);
      this.s.index += 8;
    } else if(elementType == BSON_DATA_DATE) {
      var lowBits = buffer.readInt32LE(this.s.index);
      var highBits = buffer.readInt32LE(this.s.index + 4);
      this.s.value = new Date(new Long(lowBits, highBits).toNumber());
      this.s.index += 8;
    } else if(elementType == BSON_DATA_BOOLEAN) {
      this.s.value = buffer[this.s.index++] == 1;
    } else if(elementType == BSON_DATA_UNDEFINED) {
      this.s.value = null;
    } else if(elementType == BSON_DATA_LONG) {
      var lowBits = buffer.readInt32LE(this.s.index);
      var highBits = buffer.readInt32LE(this.s.index + 4);
      var long = new Long(lowBits, highBits);

      if(this.s.promoteLong) {
        this.s.value = long.lessThanOrEqual(JS_INT_MAX_LONG) && long.greaterThanOrEqual(JS_INT_MIN_LONG) ? long.toNumber() : long;
      } else {
        this.s.value = long;
      }
    } else if(elementType == BSON_DATA_BINARY) {
      var binarySize = buffer.readInt32LE(this.s.index);
      this.s.index += 4;

      // Get the subtype
      var subType = buffer[this.s.index++];
      // If we have subtype 2 skip the 4 bytes for the size
      if(subType == Binary.SUBTYPE_BYTE_ARRAY) {
        binarySize = buffer.readInt32LE(this.s.index);
        this.s.index += 4;
      }

      if(this.s.promoteBuffers) {
        this.s.value = buffer.slice(this.s.index, this.s.index + binarySize);
      } else {
        this.s.value = new Binary(buffer.slice(this.s.index, this.s.index + binarySize), subType);
      }
      // Update the index
      this.s.index += binarySize;
    } else if(elementType == BSON_DATA_REGEXP && !this.s.bsonRegExp) {
      // Get the start search index
			var i = this.s.index;
			// Locate the end of the c string
			while(buffer[i] !== 0x00 && i < buffer.length) {
				i++
			}
			// If are at the end of the buffer there is a problem with the document
			if(i >= buffer.length) {
        throw new Error("Bad BSON Document: illegal CString")
      }

			// Return the C string
			var source = buffer.toString('utf8', this.s.index, i);
      // Create the regexp
			this.s.index = i + 1;

			// Get the start search index
			var i = this.s.index;
			// Locate the end of the c string
			while(buffer[i] !== 0x00 && i < buffer.length) {
				i++
			}
			// If are at the end of the buffer there is a problem with the document
			if(i >= buffer.length) {
        throw new Error("Bad BSON Document: illegal CString")
      }

			// Return the C string
			var regExpOptions = buffer.toString('utf8', this.s.index, i);
			this.s.index = i + 1;

      // For each option add the corresponding one for javascript
      var optionsArray = new Array(regExpOptions.length);

      // Parse options
      for(var i = 0; i < regExpOptions.length; i++) {
        switch(regExpOptions[i]) {
          case 'm':
            optionsArray[i] = 'm';
            break;
          case 's':
            optionsArray[i] = 'g';
            break;
          case 'i':
            optionsArray[i] = 'i';
            break;
        }
      }

      this.s.value = new RegExp(source, optionsArray.join(''));
    } else if(elementType == BSON_DATA_REGEXP && this.s.bsonRegExp) {
      // Get the start search index
			var i = this.s.index;
			// Locate the end of the c string
			while(buffer[i] !== 0x00 && i < buffer.length) {
				i++
			}
			// If are at the end of the buffer there is a problem with the document
			if(i >= buffer.length) {
        throw new Error("Bad BSON Document: illegal CString")
      }

			// Return the C string
			var source = buffer.toString('utf8', this.s.index, i);
      this.s.index = i + 1;

			// Get the start search index
			var i = this.s.index;
			// Locate the end of the c string
			while(buffer[i] !== 0x00 && i < buffer.length) {
				i++
			}
			// If are at the end of the buffer there is a problem with the document
			if(i >= buffer.length) {
        throw new Error("Bad BSON Document: illegal CString")
      }

			// Return the C string
			var regExpOptions = buffer.toString('utf8', this.s.index, i);
      this.s.index = i + 1;

      // Set the object
      this.s.value = new BSONRegExp(source, regExpOptions);
    } else if(elementType == BSON_DATA_SYMBOL) {
      var stringSize = buffer.readInt32LE(this.s.index);
      this.s.index += 4;

			if(stringSize <= 0 || stringSize > (buffer.length - this.s.index) || buffer[this.s.index + stringSize - 1] != 0) {
        throw new Error("bad string length in bson");
      }

      this.s.value = new Symbol(buffer.toString('utf8', this.s.index, this.s.index + stringSize - 1));
      this.s.index += stringSize;
    } else if(elementType == BSON_DATA_TIMESTAMP) {
      var lowBits = this.readInt32LE(this.s.index);
      var highBits = this.readInt32LE(this.s.index + 4);
      this.s.value = new Timestamp(lowBits, highBits);
      this.s.index += 8;
    } else if(elementType == BSON_DATA_MIN_KEY) {
      this.s.value = new MinKey();
    } else if(elementType == BSON_DATA_MAX_KEY) {
      this.s.value = new MaxKey();
    } else if(elementType == BSON_DATA_CODE) {
      var stringSize = buffer.readInt32LE(this.s.index);
      this.s.index += 4;
			if(stringSize <= 0 || stringSize > (buffer.length - this.s.index) || buffer[this.s.index + stringSize - 1] != 0) {
        throw new Error("bad string length in bson");
      }

      // Get code string out
      var functionString = buffer.toString('utf8', this.s.index, this.s.index + stringSize - 1);
      // If we are evaluating the functions
      this.s.value  = new Code(functionString, {});
      // Update parse index position
      this.s.index += stringSize;
    } else if(elementType == BSON_DATA_CODE_W_SCOPE) {
      var totalSize = buffer.readInt32LE(this.s.index);
      var stringSize = buffer.readInt32LE(this.s.index);
      this.s.index += 8;

      // Validate string
			if(stringSize <= 0 || stringSize > (buffer.length - this.s.index) || buffer[this.s.index + stringSize - 1] != 0) {
        throw new Error("bad string length in bson");
      }

      // Javascript function
      var functionString = buffer.toString('utf8', this.s.index, this.s.index + stringSize - 1);
      // Update parse index position
      this.s.index = this.s.index + stringSize;
      // // Parse the element
			// var _index = this.s.index;
      // // Decode the size of the object document
      // var objectSize = buffer.readInt32LE(this.s.index);
      // // Decode the scope object
      // var scopeObject = deserializeObject(buffer, _index, options, false);
      // // Adjust the index
      // this.s.index += objectSize;

      // Create the code object
      this.s.value  = new Code(functionString, {});

      // Decode the size of the object document
      var objectSize = buffer.readInt32LE(this.s.index);

      // Check if the object size is corrupt
      if(objectSize <= 0 || objectSize > (buffer.length - this.s.index)) {
        throw new Error("bad embedded document length in bson");
      }

      // Adjust the index
      this.s.index += 4;

      // Set START_CODE_W_SCOPE
      this.s.eventType = Parser.START_CODE_W_SCOPE_OBJECT;
    } else if(elementType == BSON_DATA_OBJECT) {
      console.log("------------------------ next BSON_DATA_OBJECT")
      // Read the object size
      var objectSize = buffer.readInt32LE(this.s.index);

      // Check if the object size is corrupt
      if(objectSize <= 0 || objectSize > (buffer.length - this.s.index)) {
        throw new Error("bad embedded document length in bson");
      }

      // Adjust the index
      this.s.index += 4;

      // Started a new object
      this.s.eventType = Parser.START_OBJECT;
    } else if(elementType == BSON_DATA_ARRAY) {
      console.log("------------------------ next BSON_DATA_ARRAY")
      // Read the object size
      var objectSize = buffer.readInt32LE(this.s.index);

      // Check if the object size is corrupt
      if(objectSize <= 0 || objectSize > (buffer.length - this.s.index)) {
        throw new Error("bad embedded document length in bson");
      }

      // Adjust the index
      this.s.index += 4;

      // Started a new object
      this.s.eventType = Parser.START_ARRAY_OBJECT;
    }
  }

  return this.s.eventType;
}

/**
 * Number BSON Type
 *
 * @classconstant BSON_DATA_NUMBER
 **/
var BSON_DATA_NUMBER = 1;
/**
 * String BSON Type
 *
 * @classconstant BSON_DATA_STRING
 **/
var BSON_DATA_STRING = 2;
/**
 * Object BSON Type
 *
 * @classconstant BSON_DATA_OBJECT
 **/
var BSON_DATA_OBJECT = 3;
/**
 * Array BSON Type
 *
 * @classconstant BSON_DATA_ARRAY
 **/
var BSON_DATA_ARRAY = 4;
/**
 * Binary BSON Type
 *
 * @classconstant BSON_DATA_BINARY
 **/
var BSON_DATA_BINARY = 5;
/**
 * ObjectID BSON Type
 *
 * @classconstant BSON_DATA_UNDEFINED
 **/
var BSON_DATA_UNDEFINED = 6;
/**
 * ObjectID BSON Type
 *
 * @classconstant BSON_DATA_OID
 **/
var BSON_DATA_OID = 7;
/**
 * Boolean BSON Type
 *
 * @classconstant BSON_DATA_BOOLEAN
 **/
var BSON_DATA_BOOLEAN = 8;
/**
 * Date BSON Type
 *
 * @classconstant BSON_DATA_DATE
 **/
var BSON_DATA_DATE = 9;
/**
 * null BSON Type
 *
 * @classconstant BSON_DATA_NULL
 **/
var BSON_DATA_NULL = 10;
/**
 * RegExp BSON Type
 *
 * @classconstant BSON_DATA_REGEXP
 **/
var BSON_DATA_REGEXP = 11;
/**
 * Code BSON Type
 *
 * @classconstant BSON_DATA_CODE
 **/
var BSON_DATA_CODE = 13;
/**
 * Symbol BSON Type
 *
 * @classconstant BSON_DATA_SYMBOL
 **/
var BSON_DATA_SYMBOL = 14;
/**
 * Code with Scope BSON Type
 *
 * @classconstant BSON_DATA_CODE_W_SCOPE
 **/
var BSON_DATA_CODE_W_SCOPE = 15;
/**
 * 32 bit Integer BSON Type
 *
 * @classconstant BSON_DATA_INT
 **/
var BSON_DATA_INT = 16;
/**
 * Timestamp BSON Type
 *
 * @classconstant BSON_DATA_TIMESTAMP
 **/
var BSON_DATA_TIMESTAMP = 17;
/**
 * Long BSON Type
 *
 * @classconstant BSON_DATA_LONG
 **/
var BSON_DATA_LONG = 18;
/**
 * MinKey BSON Type
 *
 * @classconstant BSON_DATA_MIN_KEY
 **/
var BSON_DATA_MIN_KEY = 0xff;
/**
 * MaxKey BSON Type
 *
 * @classconstant BSON_DATA_MAX_KEY
 **/
var BSON_DATA_MAX_KEY = 0x7f;

/**
 * Binary Default Type
 *
 * @classconstant BSON_BINARY_SUBTYPE_DEFAULT
 **/
var BSON_BINARY_SUBTYPE_DEFAULT = 0;
/**
 * Binary Function Type
 *
 * @classconstant BSON_BINARY_SUBTYPE_FUNCTION
 **/
var BSON_BINARY_SUBTYPE_FUNCTION = 1;
/**
 * Binary Byte Array Type
 *
 * @classconstant BSON_BINARY_SUBTYPE_BYTE_ARRAY
 **/
var BSON_BINARY_SUBTYPE_BYTE_ARRAY = 2;
/**
 * Binary UUID Type
 *
 * @classconstant BSON_BINARY_SUBTYPE_UUID
 **/
var BSON_BINARY_SUBTYPE_UUID = 3;
/**
 * Binary MD5 Type
 *
 * @classconstant BSON_BINARY_SUBTYPE_MD5
 **/
var BSON_BINARY_SUBTYPE_MD5 = 4;
/**
 * Binary User Defined Type
 *
 * @classconstant BSON_BINARY_SUBTYPE_USER_DEFINED
 **/
var BSON_BINARY_SUBTYPE_USER_DEFINED = 128;

// BSON MAX VALUES
var BSON_INT32_MAX = 0x7FFFFFFF;
var BSON_INT32_MIN = -0x80000000;

var BSON_INT64_MAX = Math.pow(2, 63) - 1;
var BSON_INT64_MIN = -Math.pow(2, 63);

// JS MAX PRECISE VALUES
var JS_INT_MAX = 0x20000000000000;  // Any integer up to 2^53 can be precisely represented by a double.
var JS_INT_MIN = -0x20000000000000;  // Any integer down to -2^53 can be precisely represented by a double.

// Internal long versions
var JS_INT_MAX_LONG = Long.fromNumber(0x20000000000000);  // Any integer up to 2^53 can be precisely represented by a double.
var JS_INT_MIN_LONG = Long.fromNumber(-0x20000000000000);  // Any integer down to -2^53 can be precisely represented by a double.

module.exports = Parser;
