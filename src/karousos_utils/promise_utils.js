"use strict";

const {
    reportCollectionDeactivated
} = require('./general');
const builtins = require('./builtins');
const mode = parseInt(process.env.ADVICE_MODE || 0) //what advice to collect;

// Used to keep track of what events each promise method is waiting for
// Maps each request id to a map that maps the promises object ids to the 
// object ids of the promises that depend on them (e.g. p1 = p2.then())
var promiseMethods = new Map();
promiseMethods.set(-1, new Map()); //initialize it

module.exports = {
    createPromiseObject,
    isPromiseSuperObject,
    checkNotPromise,
    isNativePromise,
    setThen,
    initPromiseMethodsForRid,
    addPromiseMethod,
    deletePromiseMethodsForRid,
    getAllEventsForFinally,
    getAllEventsForCatch,
    getAllEventsForThen,
    findLastThenPriorToCatch,
    exportContents,
}

// Creates a promise object that has request id, handler id, object id, and retEventTypes fields
// retEventTypes contains the events that are emitted upon fulfillment/rejection of the request
function createPromiseObject(rid, hid, assignObjectID) {
    rid = rid.karousos_x ? rid.karousos_x : rid;
    var retEventTypes;
    var superObj = Promise.resolve();
    superObj.handlerID = hid;
    superObj.requestID = rid;
    var superObj = assignObjectID(superObj, rid, hid, false);
    superObj.retEventTypes = [superObj.objID];
    return superObj;
}

// Check if this is a promise wrapper object
function isPromiseSuperObject(object) {
    if (mode >= 5) return false;
    return object && object.karContents != undefined;
}

// Check that the input object is not a promise/thenable
function checkNotPromise(object) {
    if (mode >= 5) return;
    if (object && typeof object.then == 'Function') {
        throw new Error('promise inside await after transformation');
    }
}

// Check if the input object is a native promise
function isNativePromise(arg) {
    if (mode >= 5) return true;
    return builtins.isNativePromise(arg);
}

// Gets as input a promise wrapper and sets it then, catch and finally methods to 
// the methods of the enclosed promise
function setThen(p) {
    if (mode >= 5) return true;
    p.then = p.karContents.then;
    p.catch = p.karContents.catch;
    p.finally = p.karContents.finally;
    p.constructor = p.karContents.constructor;
}

// Returns the wrapped promise from the obj, if the object is a promise wrapper
function exportContents(obj) {
    if (mode >= 5) return obj;
    if (obj != undefined && obj != null && obj.karContents != undefined) {
        return obj.karContents;
    }
    return obj;
}

function initPromiseMethodsForRid(rid) {
    promiseMethods.set(rid, new Map());
}

function deletePromiseMethodsForRid(rid) {
    promiseMethods.delete(rid);
}

// Sets promiseMethods[rid][pMethod.objID] = {p.objID, type}. Takes care of prior methods
function addPromiseMethod(rid, p, pMethod, type) {
    if (mode >= 4) return;
    rid = rid.karousos_x ? rid.karousos_x : rid;
    if (reportCollectionDeactivated(rid)) return;
    var t = [];
    var objID = p.objID;
    var objIDm = pMethod.objID;
    if (promiseMethods.get(rid).has(objIDm)) {
        let old = promiseMethods.get(rid).get(objIDm);
        t = old.types;
        if (t.length > 1 || t[0] === type || old.promise !== objID) {
            throw new Error('we have added this promise method before.. something is wrong');
        }
    }
    t.push(type);
    promiseMethods.get(rid).set(objIDm, {
        promise: objID,
        types: t
    });
}

// Gets all object ids of the promises that can emit the event that finally listens to
function getAllEventsForFinally(rid, pName) {
    if (mode >= 4) return [];
    rid = rid.karousos_x ? rid.karousos_x : rid;
    if (reportCollectionDeactivated(rid)) return [];
    var p = pName.objID;
    var res = [];
    var seen = [];
    if (promiseMethods.get(rid).has(p)) {
        while (promiseMethods.get(rid).has(p)) {
            let pOr = promiseMethods.get(rid).get(p);
            var newTypes = false;
            pOr.types.forEach(t => {
                if (!seen.includes(t)) {
                    seen.push(t);
                    newTypes = true;
                }
            });
            if (newTypes) {
                //we add them from most recent to less recent
                res.push(p);
            }
            if (pOr.types.includes('finally') || seen.length == 3) {
                break;
            }
            p = pOr.promise;
        }
    } else {
        res = [p];
    }
    return res;
}

// get all the object ids of the promises that can emit the event that catch depends on
// These are all the promises in the chain after the most recent catch 
function getAllEventsForCatch(rid, pName) {
    if (mode >= 4) return [];
    rid = rid.karousos_x ? rid.karousos_x : rid;
    if (reportCollectionDeactivated(rid)) return [];
    var p = pName.objID;
    var res = [p];
    while (promiseMethods.get(rid).has(p)) {
        let pOr = promiseMethods.get(rid).get(p);
        if (pOr.types.includes('catch')) {
            break;
        }
        res.push(pOr.promise);
        p = pOr.promise;
    }
    return res;
}

//Thens listens for the first then prior to it and all catches in between
function getAllEventsForThen(rid, pName) {
    if (mode >= 4) return [];
    rid = rid.karousos_x ? rid.karousos_x : rid;
    if (reportCollectionDeactivated(rid)) return [];
    var p = pName.objID;
    var res = [p];
    while (promiseMethods.get(rid).has(p)) {
        let pOr = promiseMethods.get(rid).get(p);
        if (pOr.types.includes('then')) {
            break;
        }
        res.push(pOr.promise);
        p = pOr.promise;
    }
    return res;
}

function findLastThenPriorToCatch(evtStart, rid) {
    if (mode >= 4) return [];
    var isCatch = (evt) => {
        return promiseMethods.has(rid) &&
            promiseMethods.get(rid).has(evt) &&
            promiseMethods.get(rid).get(evt).types.includes('catch')
    }
    var findLastThen = (evt) => {
        while (isCatch(evt)) {
            evt = promiseMethods.get(rid).get(evt).promise
        }
        return evt || []
    }
    var thens = []
    if (isCatch(evtStart)) {
        thens.push(findLastThen(evtStart))
    }
    return thens;
}