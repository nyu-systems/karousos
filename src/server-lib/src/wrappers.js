"use strict";

const assert = require('assert');

// A wrapper class for primitive types
class PrimitiveWrapper {
    // Wraps x in a primitive wrapper and assigns an object id
    constructor(x, objID) {
        this.karousos_x = x;
        Object.defineProperty(this, 'objID', {
            value: objID,
            enumerable: false,
            writable: true,
        })
    }

    // returns the wrapped value
    valueOf(x) {
        return this.karousos_x;
    }

    // turn x to string
    toString() {
        return this.karousos_x == undefined ? "undefined" :
            (this.karousos_x == null ? "null" : this.karousos_x.toString());
    }
}

exports.PrimitiveWrapper = PrimitiveWrapper;

// Returns the enclosed value of obj if the object is a wrapper
// If unpack_array = true and obj is an array, unrwaps all elements in array recursively
// If unpack_obj = true and obj is an array or object, unwraps the elements in obj recursively
function getValueOf(obj, unpack_array, unpack_obj) {
    if (obj && obj instanceof PrimitiveWrapper) {
        obj = obj.karousos_x;
    }
    if (obj instanceof Array && unpack_array) {
        return obj.map(x => x && x.karousos_x ? x.karousos_x : x)
    }
    if (obj instanceof Array && unpack_obj) {
        return obj.map(x => getValueOf(x, unpack_array, unpack_obj))
    }
    if (
        unpack_obj &&
        (obj instanceof Object || obj instanceof Array) &&
        obj != undefined &&
        !(obj instanceof require('string_decoder').StringDecoder)) {
        var obj2 = {};
        for (let key in obj) {
            obj2[key] = getValueOf(obj[key], unpack_array, unpack_obj)

        }
        return obj2;
    }
    return obj;
}

exports.getValueOf = getValueOf;