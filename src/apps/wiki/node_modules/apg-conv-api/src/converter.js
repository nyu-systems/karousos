// This module exposes the public encoding, decoding and conversion functions.
// Its private functions provide the disassembling and interpetation of the source and destination encoding types.
// In the case of Unicode encodings, private functions determine the presence of Byte Order Marks (BOMs), if any.
//
// Throws "TypeError" exceptions on input errors.
//
"use strict;"
var _this = this;
var trans = require('./transformers.js');

/* types */
var UTF8     = "UTF8";
var UTF16    = "UTF16";
var UTF16BE  = "UTF16BE";
var UTF16LE  = "UTF16LE";
var UTF32    = "UTF32";
var UTF32BE  = "UTF32BE";
var UTF32LE  = "UTF32LE";
var UINT7    = "UINT7";
var ASCII    = "ASCII";
var BINARY   = "BINARY";
var UINT8    = "UINT8";
var UINT16   = "UINT16";
var UINT16LE = "UINT16LE";
var UINT16BE = "UINT16BE";
var UINT32   = "UINT32";
var UINT32LE = "UINT32LE";
var UINT32BE = "UINT32BE";
var ESCAPED  = "ESCAPED";
var STRING   = "STRING";

/* private functions */
// Find the UTF8 BOM, if any.
var bom8 = function(src) {
  src.type = UTF8;
  var buf = src.data;
  src.bom = 0;
  if(buf.length >= 3){
    if (buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
      src.bom = 3;
    }
  }
}
// Find the UTF16 BOM, if any, and determine the UTF16 type.
// Defaults to UTF16BE.
// Throws TypeError exception if BOM does not match the specified type.
var bom16 = function(src) {
  var buf = src.data;
  src.bom = 0;
  switch (src.type) {
  case UTF16:
    src.type = UTF16BE;
    if(buf.length >= 2){
      if (buf[0] === 0xFE && buf[1] === 0xFF) {
        src.bom = 2;
      }else if (buf[0] === 0xFF && buf[1] === 0xFE) {
        src.type = UTF16LE;
        src.bom = 2;
      }
    }
    break;
  case UTF16BE:
    src.type = UTF16BE;
    if(buf.length >= 2){
      if (buf[0] === 0xFE && buf[1] === 0xFF) {
        src.bom = 2;
      }else if (buf[0] === 0xFF && buf[1] === 0xFE) {
        throw new TypeError('src type: "' + UTF16BE + '" specified but BOM is for "' + UTF16LE + '"');
      }
    }
    break;
  case UTF16LE:
    src.type = UTF16LE;
    if(buf.length >= 0){
      if (buf[0] === 0xFE && buf[1] === 0xFF) {
        throw new TypeError('src type: "' + UTF16LE + '" specified but BOM is for "' + UTF16BE + '"');
      }else if (buf[0] === 0xFF && buf[1] === 0xFE) {
        src.bom = 2;
      }
    }
    break;
  default:
    throw new TypeError('UTF16 BOM: src type "' + src.type + '" unrecognized');
  }
}
//Find the UTF32 BOM, if any, and determine the UTF32 type.
//Defaults to UTF32BE.
//Throws exception if BOM does not match the specified type.
var bom32 = function(src) {
  var buf = src.data;
  src.bom = 0;
  switch (src.type) {
  case UTF32:
    src.type = UTF32BE;
    if(buf.length >= 4){
      if (buf[0] === 0 && buf[1] === 0 && buf[2] === 0xFE && buf[3] === 0xFF) {
        src.bom = 4;
      }
      if (buf[0] === 0xFF && buf[1] === 0xFE && buf[2] === 0 && buf[3] === 0) {
        src.type = UTF32LE;
        src.bom = 4;
      }
    }
    break;
  case UTF32BE:
    src.type = UTF32BE;
    if(buf.length >= 4){
      if (buf[0] === 0 && buf[1] === 0 && buf[2] === 0xFE && buf[3] === 0xFF) {
        src.bom = 4;
      }
      if (buf[0] === 0xFF && buf[1] === 0xFE && buf[2] === 0 && buf[3] === 0) {
        throw new TypeError('src type: ' + UTF32BE + ' specified but BOM is for ' + UTF32LE + '"');
      }
    }
    break;
  case UTF32LE:
    src.type = UTF32LE;
    if(buf.length >= 4){
      if (buf[0] === 0 && buf[1] === 0 && buf[2] === 0xFE && buf[3] === 0xFF) {
        throw new TypeError('src type: "' + UTF32LE + '" specified but BOM is for "' + UTF32BE + '"');
      }
      if (buf[0] === 0xFF && buf[1] === 0xFE && buf[2] === 0 && buf[3] === 0) {
        src.bom = 4;
      }
    }
    break;
  default:
    throw new TypeError('UTF32 BOM: src type "' + src.type + '" unrecognized');
  }
}
// Validates the source encoding type and matching data.
// If the BASE64: prefix is present, the base 64 decoding is done here as the initial step.
// - For type STRING, data must be a JavaScript string.
// - For type BASE64:*, data may be a string or Buffer.
// - For all other types, data must be a Buffer.
// - The BASE64: prefix is not allowed for type STRING.
var validateSrc = function(type, data){
  function getType(type){
    var ret = {
        type: "",
        base64: false
    }
    var rx = /^(base64:)?([a-zA-Z0-9]+)$/i;
    var result = rx.exec(type);
    if (result) {
      if (result[2]) {
        ret.type = result[2].toUpperCase();
      }
      if (result[1]) {
        ret.base64 = true;
      }
    }
    return ret;
  }
  if (typeof(type) !== "string" || type === "") {
    throw new TypeError('type: "' + type + '" not recognized');
  }
  var ret = getType(type.toUpperCase());
  if(ret.base64){
    /* handle base 64 */
    if(ret.type === STRING){
      throw new TypeError('type: "' + type + ' "BASE64:" prefix not allowed with type '+STRING);
    }
    if(Buffer.isBuffer(data)){
      ret.data = trans.base64.decode(data);
    }else if(typeof(data) === "string"){
      var buf = Buffer.from(data, "ascii");
      ret.data = trans.base64.decode(buf);
    }else{
      throw new TypeError('type: "' + type + ' unrecognized data type: typeof(data): ' + typeof(data));
    }
  }else{
    ret.data = data;
  }
  switch (ret.type) {
  case UTF8:
    bom8(ret);
    break;
  case UTF16:
  case UTF16BE:
  case UTF16LE:
    bom16(ret);
    break;
  case UTF32:
  case UTF32BE:
  case UTF32LE:
    bom32(ret);
    break;
  case UINT16:
    ret.type = UINT16BE;
    break;
  case UINT32:
    ret.type = UINT32BE;
    break;
  case ASCII:
    ret.type = UINT7;
    break;
  case BINARY:
    ret.type = UINT8;
    break;
  case UINT7:
  case UINT8:
  case UINT16LE:
  case UINT16BE:
  case UINT32LE:
  case UINT32BE:
  case STRING:
  case ESCAPED:
    break;
  default:
    throw new TypeError('type: "' + type + '" not recognized');
  }
  if(ret.type === STRING){
    if(typeof(ret.data) !== "string"){
      throw new TypeError('type: "' + type + '" but data is not a string');
    }
  }else{
    if(!Buffer.isBuffer(ret.data)){
      throw new TypeError('type: "' + type + '" but data is not a Buffer');
    }
  }
  return ret;
}
// Disassembles and validates the destination type.
// `chars` must be an Array of integers.
// The :BASE64 suffix is not allowed for type STRING.
var validateDst = function(type, chars){
  function getType(type){
    var fix, rem;
    var ret = {
        crlf: false,
        lf: false,
        base64: false,
        type: ""
    }
    /*prefix, if any */
    while(true){
      rem = type;
      fix = type.slice(0, 5);
      if(fix === "CRLF:"){
        ret.crlf = true;
        rem = type.slice(5);
        break;
      }
      fix = type.slice(0, 3);
      if(fix === "LF:"){
        ret.lf = true;
        rem = type.slice(3);
        break;
      }
      break;
    }
    /*suffix, if any */
    fix = rem.split(":");
    if(fix.length === 1){
      ret.type = fix[0];
      
    }else if(fix.length === 2 && fix[1] === "BASE64"){
      ret.base64 = true;
      ret.type = fix[0];
    }
    return ret;
  }
  if(!Array.isArray(chars)){
    throw new TypeError('dst chars: not array: "' + typeof(chars));
  }
  if (typeof(type) !== "string") {
    throw new TypeError('dst type: not string: "' + typeof(type));
  }
  ret = getType(type.toUpperCase());
  switch (ret.type) {
  case UTF8:
  case UTF16BE:
  case UTF16LE:
  case UTF32BE:
  case UTF32LE:
  case UINT7:
  case UINT8:
  case UINT16LE:
  case UINT16BE:
  case UINT32LE:
  case UINT32BE:
  case ESCAPED:
    break;
  case STRING:
    if(ret.base64){
      throw new TypeError('":BASE64" suffix not allowed with type '+STRING);
    }
    break;
  case ASCII:
    ret.type = UINT7;
    break;
  case BINARY:
    ret.type = UINT8;
    break;
  case UTF16:
    ret.type = UTF16BE;
    break;
  case UTF32:
    ret.type = UTF32BE;
    break;
  case UINT16:
    ret.type = UINT16BE;
    break;
  case UINT32:
    ret.type = UINT32BE;
    break;
  default:
    throw new TypeError('dst type unrecognized: "' + type + '" : must have form [crlf:|lf:]type[:base64]');
  }
  return ret;
}
// Select and call the requested encoding function.
var encode = function(type, chars){
  switch(type){
  case UTF8:
    return trans.utf8.encode(chars);
  case UTF16BE:
    return trans.utf16be.encode(chars);
  case UTF16LE:
    return trans.utf16le.encode(chars);
  case UTF32BE:
    return trans.utf32be.encode(chars);
  case UTF32LE:
    return trans.utf32le.encode(chars);
  case UINT7:
    return trans.uint7.encode(chars);
  case UINT8:
    return trans.uint8.encode(chars);
  case UINT16BE:
    return trans.uint16be.encode(chars);
  case UINT16LE:
    return trans.uint16le.encode(chars);
  case UINT32BE:
    return trans.uint32be.encode(chars);
  case UINT32LE:
    return trans.uint32le.encode(chars);
  case STRING:
    return trans.string.encode(chars);
  case ESCAPED:
    return trans.escaped.encode(chars);
  default:
    throw new TypeError('encode type "'+type+'" not recognized')
  }
}
// Select and call the requested decoding function.
// `src` contains BOM information as well as the source type and data.
var decode = function(src){
  switch(src.type){
  case UTF8:
    return trans.utf8.decode(src.data, src.bom);
  case UTF16LE:
    return trans.utf16le.decode(src.data, src.bom);
  case UTF16BE:
    return trans.utf16be.decode(src.data, src.bom);
  case UTF32BE:
    return trans.utf32be.decode(src.data, src.bom);
  case UTF32LE:
    return trans.utf32le.decode(src.data, src.bom);
  case UINT7:
    return trans.uint7.decode(src.data);
  case UINT8:
    return trans.uint8.decode(src.data);
  case UINT16BE:
    return trans.uint16be.decode(src.data);
  case UINT16LE:
    return trans.uint16le.decode(src.data);
  case UINT32BE:
    return trans.uint32be.decode(src.data);
  case UINT32LE:
    return trans.uint32le.decode(src.data);
  case STRING:
    return trans.string.decode(src.data);
  case ESCAPED:
    return trans.escaped.decode(src.data);
  default:
    throw new TypeError('decode type "'+src.type+'" not recognized')
  }
}

// The public decoding function. Returns an array of integers.
exports.decode = function(type, data) {
  var src = validateSrc(type, data);
  return decode(src);
}
// The public encoding function. Returns a Buffer-typed byte array.
exports.encode = function(type, chars) {
  var c, buf;
  var dst = validateDst(type, chars);
  if(dst.crlf){
    /* prefix with CRLF line end conversion, don't contaminate caller's chars array */
    c = trans.lineEnds.crlf(chars);
    buf = encode(dst.type, c);
  }else if(dst.lf){
    /* prefix with LF line end conversion, don't contaminate caller's chars array */
    c = trans.lineEnds.lf(chars);
    buf = encode(dst.type, c);
  }else{
    buf = encode(dst.type, chars);
  }
  if(dst.base64){
    /* post base 64 encoding */
    buf = trans.base64.encode(buf);
  }
  return buf;
}
// Converts data of type `srcType` to data of type `dstType`.
// `srcData` may be a JavaScript String, or node.js Buffer, depending on the corresponding type.
exports.convert = function(srcType, srcData, dstType) {
  return _this.encode(dstType, _this.decode(srcType, srcData));
}
