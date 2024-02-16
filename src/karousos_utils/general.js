"use strict";

const EventEmitter = require('events');
const {
    globalHandler
} = require('./commonClasses');
const {
    functionType
} = require('./function_types');
const mode = parseInt(process.env.ADVICE_MODE || 0) //what advice to collect;
const inherits = require('util').inherits;
var context;

module.exports = {
    makeUid,
    uidHasRid,
    defineProperty,
    assignProperty,
    reportCollectionActivated,
    reportCollectionDeactivated,
    shouldSkip,
    pushContext,
    popContext,
    hasOwnProperty,
    findLength,
    setObjIDsAppropriately,
    toEventStr,
    desymbolize,
    convertSymbols,
    getRequestID,
    maybeReturnPromise,
    mapToObject,
}

// Make a unique id from the request and the id
function makeUid(rid, id) {
    rid = rid.karousos_x ? rid.karousos_x : rid;
    return rid + "," + id.toString();
}

// Check if a unique id belongs to a request
function uidHasRid(lbl, rid) {
    return lbl.startsWith(rid + ",");
}

// Set obj.p = val
function defineProperty(obj, p, val) {
    if (obj instanceof Error) {
        val = 'error:' + val.toString();
    }
    if (obj instanceof Object || typeof obj == 'object') {
        Object.defineProperty(obj, p, {
            value: val,
            enumerable: false,
            writable: true,
            configurable: true,
        });
    } else {
        obj[p] = val;
    }
}

function assignProperty(obj, p, val, rid, hid) {
    rid = rid.karousos_x ? rid.karousos_x : rid;
    // if the object already has the property p, and p is objID
    // then do nothing
    if (p == 'objID' && hasOwnProperty(obj, p)) {
        return;
    }
    defineProperty(obj, p, val);
}

// check if the advice collection is activated
function reportCollectionActivated(rid) {
    return rid != -1 && rid != -2;
}

// check if the advice collection is deactivated
function reportCollectionDeactivated(rid) {
    return rid == -2;
}

// Used if for..in. We should move to the next iteration if property is object id
// and the object is not eventEmitter
function shouldSkip(property, object) {
    return property == 'objID' && !(object instanceof EventEmitter);
}

// Save the current request id, hid, retEventTypes, and objID
function pushContext(cft, hid, retEventTypes, objID) {
    cft = cft.karousos_x ? cft.karousos_x : cft;
    context = [cft, hid, retEventTypes, objID];
}

// Return the most recent request id, hid, retEventTypes, and objID
function popContext() {
    // If there is no context, then we are running during init
    if (!context) return [-1, globalHandler, [], ''];
    return context;
}

// check if an object has the given property
function hasOwnProperty(obj, property) {
    if (!obj) {
        return false;
    }
    if (obj.hasOwnProperty) {
        return obj.hasOwnProperty(property);
    }
    return obj[property] != undefined;
}

// Find the length of an object
function findLength(obj) {
    if (mode >= 5) return obj.length;
    obj = obj.karousos_x || obj;
    if (
        typeof obj === 'function' &&
        obj.toString == Function.prototype.toString &&
        functionType(obj, []) == 1
    ) {
        // The object is a user-defined function whose arguments have been modified compared
        // to the original. Return the length of the original function's length
        return obj.length - 4;
    }
    return obj.length;
}

// Modifies the object ids if the function is inherits.
function setObjIDsAppropriately(rid, hid, fn, thisArg, args, assignObjectID) {
    if (fn == inherits) {
        delete args[0].prototype.objID;
        assignObjectID(args[0].prototype, rid, hid, false)
    }
}

// Converts an event and its success type to a string
function toEventStr(evt, success) {
    return (evt.string || evt.hash || evt) + ':' + success;
}

// Desymbolizes the input object o by converting all properties that are symbols
// to strings.
function desymbolize(o, prev) {
    if (prev == undefined) prev = [o];
    if (Array.isArray(o)) {
        return o.map((x) => {
            if (prev.includes(x)) return x;
            return desymbolize(x, prev.concat([x]));
        });
    } else if (typeof o != "object" || o == null || o instanceof Map) {
        return o;
    } else {
        let d = Object.assign(Object.create(Object.getPrototypeOf(o)), o);
        Object.getOwnPropertySymbols(o).forEach(k => {
            d[k.toString()] = mapToObject(o[k]);
            delete d[k];
        });
        Object.keys(d).forEach(k => {
            if (prev.includes(d[k])) return;
            d[k] = desymbolize(d[k], prev.concat([d[k]]))
        });
        return d;
    }
}

// Modifies an object that has been desymbolized by comparing it against the original object:
// and converts all desymbolized properties back to symbols using the original object for reference
function convertSymbols(objNew, objOriginal) {
    var createMapFromObj = function(obj) {
        var res = new Map();
        for (let prop in obj) {
            res.set(prop, obj[prop])
        }
        return res;
    }
    Object.getOwnPropertySymbols(objOriginal).forEach(k => {
        if (objOriginal[k] instanceof Map) {
            var newMap = objNew[k.toString()];
            if (newMap instanceof Multivalue && !newMap.collapsed) {
                var res = [];
                for (let i = 0; i < newMap.length; i++) {
                    res.push(createMapFromObj(newMap.karousos_value[i]))
                }
                objNew[k] = createMultivalue(res);
            } else {
                assert(!(newMap instanceof Multivalue));
                objNew[k] = createMapFromObj(newMap);
            }
        } else {
            objNew[k] = objNew[k.toString()];
        }
        delete objNew[k.toString()]
    })
}

// Export the request id from a request object
function getRequestID(req) {
    let rid = req.get('X-Request-Id');
    if (!reportCollectionActivated(rid)) return rid;
    if (rid == null || rid === undefined) {
        throw new Error('rid undefined!!');
    }
    return rid;
}

// Takes as input an argument. If the argument is a promise, it makes the input
// retEventTypes depend on the argument's retEventTypes,
// Otherwise, it emits all retEventTypes
function maybeReturnPromise(requestID, handlerID, retEventTypes, arg, success, SetRetEvtTypes, Emit) {
    requestID = requestID.karousos_x ? requestID.karousos_x : requestID;
    if (arg != undefined && arg.karContents instanceof Promise && retEventTypes.length > 0) {
        SetRetEvtTypes(requestID, arg.retEventTypes, retEventTypes, true);
        return arg.karContents;
    }
    Emit(requestID, handlerID, retEventTypes, success);
    return arg;
}

// Converts a map to an object recursively
// from https://gist.github.com/davemackintosh/3b9c446e8681f7bbe7c5
function mapToObject(map) {
    if (!(map instanceof Map)) return map;
    const out = {}
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