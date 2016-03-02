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
Parser.START_ARRAY = 3;
Parser.END_ARRAY = 4;
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

Parser.prototype.setInput = function(buffer) {
  this.s = {
    // Current State of the parser
    buffer: buffer,
    index: 0,
    depth: 0,
    eventType: Parser.START_DOCUMENT,
    // Current values viewed
    name: null,
    value: null
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
  } else if(this.s.eventType == Parser.START_OBJECT || this.s.eventType == Parser.FIELD) {
    // console.log("------------------------ next START_OBJECT :: START " + this.s.eventType)
    // Read the type
    var elementType = buffer[this.s.index++];

    if(this.s.eventType == Parser.FIELD) {
      console.log("------------------------ next FIELD :: " + elementType)
    } else {
      console.log("------------------------ next START_OBJECT")
    }

    // We are done with the object
    if(elementType == 0) {
      this.s.name = null,
      this.s.value = null,
      this.s.index += 1;
      this.s.eventType = Parser.END_OBJECT;
      return this.s.eventType;
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
      this.s.index = this.s.index + stringSize;
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
