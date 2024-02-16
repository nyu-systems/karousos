"use strict";

const assert = require('assert');
const mode = parseInt(process.env.ADVICE_MODE || 0) //what advice to collect;

// map from request ids to map from object to the number of times an event has been emitted for 
// this object
var eventsPerObject = new Map();
eventsPerObject.set(-1, new Map());
eventsPerObject.set(-2, new Map());
// map from rids to the await events  
var awaitRetEvtTypes = new Map();

module.exports = {
    initEventsForObject,
    initAwaitRetEvtType,
    createAwaitRetEvtType,
    newEventForObject,
    flushDataOnEvents,
    getListeners,
    getEmitterEvents,
}

// Initialize the eventsPerObject for the specified request id
function initEventsForObject(rid) {
    eventsPerObject.set(rid, new Map());
}

function initAwaitRetEvtType(rid) {
    awaitRetEvtTypes.set(rid, new Map());
}

// Creates a new event for the object by reading the current value of eventsPerObject 
// and then increments the value
function newEventForObject(rid, objID) {
    rid = rid.karousos_x ? rid.karousos_x : rid;
    var idx = eventsPerObject.get(rid).get(objID.toString()) || 0;
    eventsPerObject.get(rid).set(objID.toString(), idx + 1);
    return objID.toString() + ':' + idx;
}

// Flush eventsPerObject and seenName
function flushDataOnEvents(rid) {
    eventsPerObject.delete(rid);
    awaitRetEvtTypes.delete(rid);
}

// Create the type of event that await returns
function createAwaitRetEvtType(rid, hid) {
    if (mode >= 5) return "";
    rid = rid.karousos_x ? rid.karousos_x : rid;
    var name = hid.toString() + '_await';
    if (awaitRetEvtTypes.get(rid).has(name)) {
        var ret = name + awaitRetEvtTypes.get(rid).get(name).toString();
        awaitRetEvtTypes.get(rid).set(name, awaitRetEvtTypes.get(rid).get(name) + 1);
        return ret;
    } else {
        var ret = name;
        awaitRetEvtTypes.get(rid).set(name, 1);
        return ret;
    }
}

// Get all listeners associated with arg
function getListeners(arg, method, objID) {
    var myListeners = [];
    if (arg && arg._events && arg._events[method]) {
        if (arg._events[method] instanceof Array) {
            arg._events[method].forEach((listener) => {
                assert(!(listener instanceof Array));
                assert((listener["listener"] || listener).objID);
                if ((listener["listener"] || listener).objID == objID) {
                    myListeners.push(listener["listener"] || listener);
                }
            })
        } else {
            assert((arg._events[method]["listener"] || arg._events[method]).objID);
            if ((arg._events[method]["listener"] || arg._events[method]).objID == objID) {
                myListeners = [(arg._events[method]["listener"] || arg._events[method])];
            }
            assert(myListeners.length < 2)
            return myListeners.length > 0 ? myListeners[0] : null;
        }
    }
    return null;
}

// Get all object ids of the events associated with arg
// You are not expected to understand this 
function getEmitterEvents(arg, rid, hid, method) {
    if (mode >= 4) return [];
    rid = rid.karousos_x ? rid.karousos_x : rid;
    var names = [];
    if (arg && arg._events && arg._events[method]) {
        if (arg._events[method] instanceof Array) {
            arg._events[method].forEach((listener) => {
                assert(!(listener instanceof Array));
                assert((listener["listener"] || listener).objID);
                names.push(
                    (listener["listener"] || listener).objID.toString() +
                    ":" +
                    method
                );
            })
        } else {
            assert((arg._events[method]["listener"] || arg._events[method]).objID);
            names = [
                (arg._events[method]["listener"] || arg._events[method]).objID.toString() +
                ":" +
                method
            ];
        }
        return names;
    }
    return [];
}