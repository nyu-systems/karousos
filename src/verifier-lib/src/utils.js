"use strict";

const {
    isEqual,
    merge,
    mergeWith
} = require('lodash');
const {
    PrimitiveWrapper,
    Multivalue,
    createMultivalue
} = require('./wrappers');
const {
    builtins,
    defineProperty
} = require(process.env.KAR_HOME + "/src/karousos_utils");
const isPrimitiveType = builtins.isPrimitiveType;
const assert = require('assert');
const {
    desymbolize,
    convertSymbols
} = require(process.env.KAR_HOME + "/src/karousos_utils");

// Checks if x is undefined or if x is a PrimitiveWrapper whose wrapped value is undefined
exports.isUndefined = function(x) {
    return x == undefined || (x instanceof PrimitiveWrapper && x.karousos_x == undefined);
}

// Tries to merge the objNew and the value by appropriately assigning the object ids of
// objNew to the ones in value
exports.my_merge = function(objNew, value, needToMerge) {
    try {
        if (isEqual(value, objNew)) {
            return value
        }
        // Create a new Uint8Array if the value is a Uint8Array
        if (!value.karousos_x && !objNew.karousos_x && value instanceof Uint8Array) {
            value = new Uint8Array(Object.values(objNew))
            return value
        }
        // If value is a multivalue and x objNew is a primitive wrapper,
        // the new object is a Primitive wrapper whose value is objNew.karousos_x and its object id
        // is the one of value
        if (value instanceof Multivalue && objNew && objNew.karousos_x) {
            var res = new PrimitiveWrapper(objNew.karousos_x);
            defineProperty(res, 'objID', value.objID);
            return res;
        }
        // If value is a primitive wrapper, and the objNew is either null or a primitive object
        // return a wrapper whose value is objNew and the object id is the one of value
        if (value instanceof PrimitiveWrapper && (Object.keys(objNew).length == 0 || objNew.karousos_x)) {
            if (value.karousos_x instanceof Uint8Array) {
                value.karousos_x = new Uint8Array(Object.values(objNew.karousos_x))
            } else {
                value.karousos_x = objNew.karousos_x;
            }
            return value;
        }
        // If objNew is an array and value is a primitive wrapper, wrap the objNew and assign
        // to it the object id of value. return the objNew
        if (
            (objNew instanceof Array || objNew instanceof Uint8Array) &&
            value instanceof PrimitiveWrapper
        ) {
            objNew = new PrimitiveWrapper(objNew);
            defineProperty(objNew, 'objID', value.objID);
            return objNew;
        }

        // If the new object is a Multivalue and the old object is a Map, convert
        // Each entry of the multivalue into a map
        if (value instanceof Map && objNew instanceof Multivalue) {
            for (let i = 0; i < objNew.karousos_value.length; i++) {
                if (!(objNew.karousos_value[i] instanceof Map)) {
                    objNew.karousos_value[i] = new Map(Object.entries(objNew.karousos_value[i]));
                }
            }
            return objNew;
        }
        // If both objNew and value are multivalues, then assign the object ids of value to each
        // of the properties of objNew and return objNew
        if (
            value &&
            value.objID &&
            (objNew instanceof Multivalue || (objNew && objNew.isMultivalue)) &&
            (value instanceof Multivalue || (value && value.isMultivalue))
        ) {
            defineProperty(objNew, 'objID', value.objID);
            for (let prop in objNew) {
                if (value[prop].hasOwnProperty('objID') && !isPrimitiveType(objNew[prop])) {
                    defineProperty(objNew[prop], 'objID', value[prop].objID);
                }
            }
        } else if (needToMerge) {
            // value is a primitive wrapper and objNew is not, then wrap objNew to a Primitive
            // wrapper and assign the object id of value to the new wrapper. Return the new wrapper.
            if (value instanceof PrimitiveWrapper || value.hasOwnProperty("karousos_x")) {
                if (!(objNew instanceof PrimitiveWrapper) && isPrimitiveType(objNew)) {
                    objNew = new PrimitiveWrapper(objNew);
                }
                defineProperty(objNew, 'objID', value.objID);
            } else {
                var hasMyUndefined = false;
                var value2 = desymbolize(value);
                // Merge the desymbolized obj with the new object (that is already desymbolized
                // because it comes from JSON.parse)
                objNew = mergeWith(objNew, value2, function(objValue, srcValue, property) {
                    // TODO: Continue from here!
                    if (
                        srcValue == undefined &&
                        objValue != undefined &&
                        Object.keys(objValue).length == 0
                    ) {
                        // if srcValue is undefined, do not return undefined
                        // because it will be overwritten by object value.
                        // Instead, write a special value that we later convert to undefined
                        hasMyUndefined = true;
                        return "karousosUndefined"
                    }
                    // For event emitters, maintain the events.
                    if (property == "_events") {
                        return objValue;
                    }
                    // handle the case where the value is an array. We still want the result
                    // to be srcValue but the types of the objects should be instances of the
                    // objects in objValue. This is special cased and will not work generally
                    if (
                        objValue != undefined &&
                        srcValue != undefined &&
                        objValue instanceof Array &&
                        srcValue instanceof Array &&
                        objValue.length < srcValue.length
                    ) {
                        var sameConstructor = true;
                        for (let i = 1; i < objValue.length; i++) {
                            if (objValue[0].constructor != objValue[i].constructor) {
                                sameConstructor = false;
                            }
                        }
                        if (sameConstructor) {
                            var res = new Array();
                            if (isPrimitiveType(objValue[0])) {
                                for (let i = 0; i < srcValue.length; i++) {
                                    res.push(srcValue[i]);
                                }
                            } else {
                                for (let i = 0; i < srcValue.length; i++) {
                                    res.push(merge(
                                        objValue[0] ?
                                        new objValue[0].constructor(-2, "", [], {}) : {},
                                        objValue[0],
                                        srcValue[i]
                                    ))
                                }
                            }
                            return res;
                        }
                    }
                });
                // Convert karousosUndefined to undefined recursively
                var deleteMyUndefined = function(obj, prevObjs) {
                    if (obj != undefined && obj instanceof Object) {
                        var keys = Object.keys(obj);
                        for (let i = 0; i < keys.length; i++) {
                            var key = keys[i];
                            if (typeof obj[key] == "string" && obj[key] == "karousosUndefined") {
                                obj[key] = undefined
                            } else if (
                                obj[key] != undefined && obj[key] instanceof Object &&
                                !prevObjs.includes(obj[key])
                            ) {
                                deleteMyUndefined(obj[key], prevObjs.concat([obj[key]]))
                            }
                        }
                    }
                }
                if (hasMyUndefined) {
                    deleteMyUndefined(objNew, [objNew])
                }
                // Turned the desymbolized objNew to a symbol
                convertSymbols(objNew, value);
            }
        }
        // Set the object id of the object we are returning to the object id of value
        if (value.objID && !objNew.objID) {
            defineProperty(objNew, 'objID', value.objID)
        }
        return objNew;
    } catch (err) {
        console.log(err);
        process.exit();
    }
}


// Converts a map to an object recursively
// from https://gist.github.com/davemackintosh/3b9c446e8681f7bbe7c5
function mapToObject(map) {
    if (!(map instanceof Map)) return map;
    const out = Object.create(null);
    map.forEach((value, key) => {
        if (value instanceof Map) {
            out[key] = mapToObject(value);
        } else if (typeof value === 'bigint') {
            out[key] = value.toString() + 'n';
        } else {
            out[key] = value;
        }
    })
    return out;
}