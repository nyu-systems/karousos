/**********************************************/
/*******************Requires*******************/
/**********************************************/

const debug = require('debug')('server-lib');
const assert = require('assert');
const asyncHooks = require('async_hooks');
const fs = require('fs');
const {
    ConcurrentAccessDetector
} = require('./concurrent-access-detector')
const {
    transformFunction
} = require(process.env.KAR_HOME + '/src/compiler/compile_functions')
const origCwd = require('process').cwd
const EventEmitter = require('events');
const jsonStringify = require('json-cycle').stringify;
const crypto = require('crypto');
const {
    PrimitiveWrapper,
    getValueOf
} = require('./src/wrappers');
const Buffer = require('buffer');
const util = require('util');
const {
    cloneDeep
} = require("lodash");
const {
    markTheResRejFunctions,
    functionType,
    getSuperFunctionType,
    getSuperMethodFunctionType,
    builtins,
    commonClasses,
    reportCollectionActivated,
    reportCollectionDeactivated,
    createAwaitRetEvtType,
    initAwaitRetEvtType,
    shouldSkip,
    isNativePromise,
    setThen,
    pushContext,
    popContext,
    newFunction,
    handleRequire,
    saveFunctionInitType,
    createPromiseObject,
    isPromiseSuperObject,
    checkNotPromise,
    makeUid,
    uidHasRid,
    defineProperty,
    assignProperty,
    hasOwnProperty,
    getHandlerIDforObjectID,
    setHandlerIDforObjectID,
    initGeneratorHelpers,
    deleteGeneratorHelpers,
    initPromiseMethodsForRid,
    deletePromiseMethodsForRid,
    flushDataOnEvents,
    flushObjNums,
    addPromiseMethod,
    getAllEventsForFinally,
    getAllEventsForCatch,
    getAllEventsForThen,
    findLastThenPriorToCatch,
    exportContents,
    initObjNumForHid,
    initObjNumForRid,
    createObjectID,
    initEventsForObject,
    newEventForObject,
    getEmitterEvents,
    getListeners,
    findLength,
    setObjIDsAppropriately,
    toEventStr,
    getRequestID,
    maybeReturnPromise,
    mapToObject
} = require("../karousos_utils");

const isPrimitiveType = builtins.isPrimitiveType;
const commonDetSyncCallToJsBuiltIn = builtins.commonDetSyncCallToJsBuiltIn
const globalHandler = commonClasses.globalHandler;
// save this module as the serverLib
const serverLib = this;

var Measurements = require(process.env.KAR_HOME + '/src/measurements');

/**********************************************/
/**Export the functions that are the same in **/
/********* prover, verifier********************/
/**********************************************/

exports.markTheResRejFunctions = markTheResRejFunctions;
exports.getSuperFunctionType = getSuperFunctionType;
exports.getSuperMethodFunctionType = getSuperMethodFunctionType;
exports.functionType = functionType;
exports.newFunction = newFunction;
exports.createAwaitRetEvtType = createAwaitRetEvtType;
exports.shouldSkip = shouldSkip;
exports.isNativePromise = isNativePromise;
exports.setThen = setThen;
exports.pushContext = pushContext;
exports.popContext = popContext;
exports.handleRequire = handleRequire;
exports.createPromiseObject = function(rid, hid) {
    return createPromiseObject(rid, hid, this.assignObjectID);
}
exports.isPromiseSuperObject = isPromiseSuperObject;
exports.checkNotPromise = checkNotPromise;
exports.getHandlerIDforObjectID = getHandlerIDforObjectID;
exports.setHandlerIDforObjectID = function(rid, hid, obj) {
    return setHandlerIDforObjectID(rid, hid, obj, this.assignObjectID)
}
exports.exportContents = exportContents;
exports.findLength = findLength;
exports.getRequestID = getRequestID;
exports.maybeReturnPromise = function(requestID, handlerID, retEventTypes, arg, success) {
    return maybeReturnPromise(
        requestID,
        handlerID,
        retEventTypes,
        arg,
        success,
        serverLib.SetReturnEventTypes,
        serverLib.EmitAll
    )
}

/**********************************************/
/**************Global Declarations*************/
/**********************************************/

// what parts of advice collection are turned off
const mode = parseInt(process.env.ADVICE_MODE || 0);
// Prime used to compute the control flow tags per handler (like Orochi)
var p = 179424691;

// Map from each requestID to control flow info
var cfg = new Map();
var cfgOrochi = new Map();
// Handler logs, they have handler ops and non det ops
var hls = new Map();
// Initialize the handler logs for init where we save non-deterministic ops made during initialization
hls.set(-1, []);
// Number of operations issued so far per rid per hid
var opcounts = new Map();
// Initialize the number of handler operations issued by init
opcounts.set(-1, new Map())
opcounts.set(-2, new Map())
// Transaction logs per rid per tx id
var txls = new Map();
//Events that have been emitted so far
var emittedEvents = new Map();
// Map from rid to map from events to their dependent events
// and who will emit them
var dependentEvents = new Map();
// Initialize the dependent events from initialization
dependentEvents.set(-1, new Map());
// Kepp track of the dependent events that are emitted. This is used because sometimes
// we optimistically emit a success event before we know if the operation succeeded
// and if it turns out that the operation had an error, we change the type of the event to fail
var emittedDepEvts = new Map();
// Map from rid to map from events to set of dependant events S s.t. the event is emitted when all
// Events in S are emitted with success = success or if one of them is emitted with success = fail
var all = new Map();
all.set(-1, new Map());
// Map from rid to map from events to set of dependant events S s.t. the event is emitted when all
// Events in S are emitted with success = fail or if one of them is emitted with success = success
var race = new Map();
race.set(-1, new Map())
// Map from rids to the handler ids that are currently executed. Used to handle express
// calls to get(), set() etc
var curHandler = new Map();
curHandler.set(-1, '')
// Map from rids to (hid, opnum) s.t. response was emitted from hid after opnum ops were executed
var responseEmittedBy = new Map();
// Map from rid to map from timer events to the number of times they have been emitted
var timerEvents = new Map();
// A function registered for an event type can be activated multiple times by different events
// So we keep a map from rid to map from event types and function to the emit operation of the
// that could activate the function
var seenEvents = new Map();
seenEvents.set(-1, new Map());
// Map rid => (Map handlerName => (Map evt type => location of register op in the logs))
var registeredHandlers = new Map();
// Number of emit operations emitted by initialization so far
var globalOpcounts = new Map();
//Save the prototypes for functions to use them in callFunction
var generatorFuncProto = Object.getPrototypeOf(function*() {});
var asyncFuncProto = Object.getPrototypeOf(async function() {});

// Initialize the types of awaits for the initialization procedure and the Deactivated code
initAwaitRetEvtType(-1);
initAwaitRetEvtType(-2);

// Initialize a new concurrent access detector
var accessDetector = new ConcurrentAccessDetector();
accessDetector.newRid(-1);
accessDetector.newRid(-2);
var accessDetectorOrochiJs = new ConcurrentAccessDetector( /* for Orochi JS */ true);
accessDetectorOrochiJs.newRid(-1);
accessDetectorOrochiJs.newRid(-2);

// Initialize the global and deactivated handlers:
initNewHandler(-1, globalHandler, undefined);
initNewHandler(-2, globalHandler, undefined);

// Wrapper for function that unwraps an object if it is wrapped
exports.getValueOf = function(obj, unpack_array, unpack_obj) {
    if (mode >= 2) {
        return obj;
    }
    let ret = getValueOf(obj, unpack_array, unpack_obj);
    return ret;
}

// Save the handler id and the most recent opnum prior to emitting the response for rid
// The opnum is the current value of opcounts
exports.saveResponseEmittedBy = function(rid, hid) {
    if (mode >= 1) return;
    rid = rid.karousos_x ? rid.karousos_x : rid;
    responseEmittedBy.set(rid, {
        "hid": hid.toString(),
        "opnum": opcounts.get(rid).get(hid.toString())
    })
}

// Tries to assign new_object to old_object taking care or any wrappers that karousos introduces
// and returns the new new_object
function sync(
    old_obj,
    new_obj,
    isObject,
    isArray,
    rid,
    hid,
    isSaveMemberInVariable,
    object,
    property
) {
    if (mode >= 4) return new_obj;
    // Special case if the function is a Register/Unregister/Emit
    if (new_obj instanceof Function && builtins.EventEmitterMethods.has(new_obj)) {
        return new_obj
    }
    // The original code just does x = t.method. We don't need to do anything
    if (isSaveMemberInVariable) {
        return new_obj;
    }
    // Recursively sync objects and arrays
    if (isObject) {
        var res = {};
        for (const property in old_obj) {
            res[property] = sync(old_obj[property], new_obj[property], false, false);
        }
        return res;
    }
    if (isArray) {
        var res = [];
        for (let i = 0; i < old_obj.length; i++) {
            res[i] = sync(old_obj[i], new_obj[i], false, false)
        }
        return res;
    }

    // Return the new_object if the old object is undefined or not wrapped.
    // Do not modify Object.prototype (this is special-case hack)
    if (old_obj == undefined || old_obj.objID == undefined || new_obj == Object.prototype) {
        return new_obj;
    }
    // Modify the old object by assigning to it the value of the new object. Take care or primitives
    // and their wrappers
    let prev_objID = old_obj.objID;
    let prev_isLoggable = old_obj.isLoggable;
    if (mode < 2) {
        if (new_obj instanceof PrimitiveWrapper) {
            old_obj = new PrimitiveWrapper(new_obj.karousos_x, prev_objID);
        } else if (isPrimitiveType(new_obj)) {
            old_obj = new PrimitiveWrapper(new_obj, prev_objID);
        } else {
            old_obj = new_obj;
        }
    } else {
        old_obj = new_obj;
    }
    // If it is a property of an object, assign the new value at the property of the object
    if (object != undefined) {
        object[property.karousos_x ? property.karousos_x : property] = old_obj;
    }
    // Make sure that the object id of the object we are returning is the one of old object
    if (old_obj != undefined && old_obj.objID != prev_objID && old_obj != Object.prototype && !isPrimitiveType(old_obj)) {
        assignProperty(old_obj, 'objID', prev_objID, rid, hid);
    }
    if (old_obj != undefined && !isPrimitiveType(old_obj)) {
        // Mark the returned object as loggable if the original object was loggable
        defineProperty(old_obj, 'isLoggable', prev_isLoggable);
    }
    return old_obj;
}

exports.sync = sync;

// saves the reports/advice collected for request with id requestID in directory dir.
// and flushes the advice that are flushed from memory.
// Takes as input whether it should write to disk synchronously or not: sometimes we want to write
// them asynchronously to let the handler that calls this to finish before we save.
exports.saveReportsForRid = function(requestID, synchronously) {
    if (mode >= 5 || process.env.IS_PROVER == "false") return;

    requestID = requestID.karousos_x ? requestID.karousos_x : requestID;

    var reports_file = process.env.ADVICE_DIR + process.env.REPORTS_LOC;
    var reports_file_orochi_js = process.env.ADVICE_DIR_OROCHI_JS + process.env.REPORTS_LOC;

    function save() {
        try {
            var cft = cfg.get(requestID);
            // Compute the cft by hashing the entries in the cft alphabetically
            if (cft != undefined && cft instanceof Map) {
                cft = hashCode(JSON.stringify(mapToObject(new Map([...cft.entries()].sort()))));
            }

            // Save the advice in an external file
            if (mode < 1) {
                var reports = {
                    'cft': cft != undefined ? mapToObject(cft) : undefined,
                    'hls': mapToObject(hls.get(requestID)),
                    'txls': mapToObject(txls.get(requestID)),
                    'opcounts': mapToObject(opcounts.get(requestID)),
                    'responseEmittedBy': responseEmittedBy.get(requestID),
                }
                if (fs.appendFileSync(reports_file, requestID + "//" + JSON.stringify(reports) + "\n")) {
                    process.exit()
                }
                if (process.env.COLLECT_OROCHI_JS_ADVICE == "true") {
                    reports.cft = cfgOrochi.get(requestID);
                    if (fs.appendFileSync(reports_file_orochi_js, requestID + "//" + JSON.stringify(reports) + "\n")) {
                        process.exit()
                    }
                    cfgOrochi.delete(requestID);
                }
                // If the initialization procedure finished, save its object ols = variable logs
                if (requestID != -1) {
                    accessDetector.saveObjectOls(requestID);
                    if (process.env.COLLECT_OROCHI_JS_ADVICE == "true") {
                        accessDetectorOrochiJs.saveObjectOls(requestID);
                    }
                }
            }
            // Flush the memory
            cfg.delete(requestID);
            hls.delete(requestID);
            txls.delete(requestID);
            opcounts.delete(requestID);
            responseEmittedBy.delete(requestID);
            all.delete(requestID);
            race.delete(requestID);
            dependentEvents.delete(requestID);
            dependentEvents.delete(-1);
            dependentEvents.delete(-2);
            for (let [k, _] of emittedDepEvts) {
                if (uidHasRid(k, requestID) || uidHasRid(k, "-2") || uidHasRid(k, "-1")) {
                    emittedDepEvts.delete(k);
                }
            }
            flushDataOnEvents(requestID);
            flushObjNums(requestID);

            if (requestID != -1) {
                accessDetector.eraseRid(requestID);
                if (process.env.COLLECT_OROCHI_JS_ADVICE == "true") {
                    accessDetectorOrochiJs.eraseRid(requestID);
                }
            }
            deletePromiseMethodsForRid(requestID);
            deleteGeneratorHelpers(requestID);
            for (let [evt, _] of emittedEvents) {
                if (uidHasRid(evt, requestID)) emittedEvents.delete(evt);
                if (uidHasRid(evt, "-1")) emittedEvents.delete(evt);
                if (uidHasRid(evt, "-2")) emittedEvents.delete(evt);
            }
            registeredHandlers.delete(requestID);
            registeredHandlers.delete(-2);
            curHandler.delete(requestID);
            timerEvents.delete(requestID);
            seenEvents.delete(requestID);
        } catch (err) {
            console.log(err);
            process.exit();
        }
    }
    if (synchronously) {
        save()
    } else {
        setImmediate(save);
    }
}

// Saves the variable logs in disk and flushes the memory
exports.saveObjectOls = function(synchronously) {
    if (mode >= 5) return;

    function save() {
        let prev = serverLib.popContext();
        serverLib.pushContext(-2, globalHandler, [], "")
        accessDetector.saveObjectOls(-1);
        if (process.env.COLLECT_OROCHI_JS_ADVICE == "true") {
            accessDetectorOrochiJs.saveObjectOls(-1);
        }
        serverLib.pushContext(prev[0], prev[1], prev[2], prev[3]);
    }
    if (synchronously) {
        save()
    } else {
        setImmediate(save);
    }
}

// Checks if an object is undefined or if it is a wrapper of an undefined object
exports.isUndefined = function(obj) {
    return serverLib.getValueOf(obj) == undefined;
}

// Updates the control flow tag by updating the tag of the input handler id
exports.updateTag = function(rid, hid, op) {
    if (mode >= 3) return;
    rid = rid.karousos_x ? rid.karousos_x : rid;
    try {
        if (!reportCollectionActivated(rid)) return;
        if (!(typeof op === 'string' || op instanceof String)) {
            throw new Error('Invalid type of op');
        }
        if (!cfg.has(rid)) {
            throw new Error('requestID does not exist', rid);
        }
        if (!cfg.get(rid).has(hid)) {
            throw new Error('handlerID does not exist');
        }
        var hash = cfg.get(rid).get(hid);
        var newHash = Number((BigInt(hash) * BigInt(p) + BigInt(op)) % BigInt(Number.MAX_SAFE_INTEGER));
        cfg.get(rid).set(hid, newHash);
        if (process.env.COLLECT_OROCHI_JS_ADVICE == "true") {
            if (!cfgOrochi.has(rid)) {
                throw new Error('requestID does not exist', rid);
            }

            var hashOrochi = cfgOrochi.get(rid);
            var newHashOrochi = Number((BigInt(hashOrochi) * BigInt(p) + BigInt(op)) % BigInt(Number.MAX_SAFE_INTEGER));
            cfgOrochi.set(rid, newHashOrochi);
        }
    } catch (err) {
        console.log(err);
        process.exit()
    }
}

// Called whenever an access may be r-concurrent.
// It assigns an object id to the object and then calls the concurrent access detector
function recordAccess(obj, rid, hid, isRead, isNewObject, parentObject, method) {
    if (mode >= 2) {
        return obj;
    }
    rid = rid.karousos_x ? rid.karousos_x : rid;
    // Do not assign object ids on object methods because they are assigned to the prototype
    // and this creates bugs
    if (obj != undefined && builtins.EventEmitterMethods.has(obj)) return obj;
    // Do not assign object ids to functions that might be defined by karousos
    if (
        obj != undefined &&
        obj instanceof Function &&
        (parentObject != undefined || obj.karousosMaybeMethod)
    ) {
        defineProperty(obj, 'karousosMaybeMethod', true);
        return obj;
    }
    assert(isRead != undefined);

    // The obj is a new primitive wrapper. We need to wrap it and assign a new object id to it
    if (isNewObject && obj instanceof PrimitiveWrapper) {
        var objID = createObjectID(rid, hid, isRead, recordAccess, parentObject, method);
        obj = new PrimitiveWrapper(obj.karousos_x, objID);
    }
    // If it is a primitive, wrap it and assign an object id to it
    if (isPrimitiveType(obj)) {
        var objID = createObjectID(rid, hid, isRead, recordAccess, parentObject, method);
        obj = new PrimitiveWrapper(obj, objID);
    }
    //Do Not assign objID to global object.prototype lodash tries to do this...
    if (
        obj == Object.prototype ||
        obj == Array.prototype ||
        obj == Function.prototype ||
        obj == EventEmitter.prototype
    ) {
        return obj;
    }
    // We cannot assign object ids to non extensible objects
    if ((obj instanceof Object || typeof obj === 'object') && !Object.isExtensible(obj)) return obj;
    //Do not change the poolsize of buffer because it is used internally
    if (method == 'poolSize' && parentObject == Buffer) {
        return obj
    }
    // if the object already has an objectID and
    // we are not trying to change the objectID to a one associated with a parentObject
    // then do not add a reference between the object ids
    if (
        hasOwnProperty(obj, 'objID') &&
        parentObject != undefined &&
        parentObject.objID != undefined &&
        parentObject.objID != obj.objID.parentObjID &&
        reportCollectionActivated(rid)
    ) {
        var objID = createObjectID(rid, hid, isRead, recordAccess, parentObject, method);
        addReference(rid, hid, obj, objID, isRead);
        return obj;
    }
    // Assign an object id to the object if it does not have one. Also, assign a request id
    if (!hasOwnProperty(obj, 'objID')) {
        var objID = createObjectID(rid, hid, isRead, recordAccess, parentObject, method);
        defineProperty(obj, 'objID', objID);
        defineProperty(obj, 'requestID', rid);
        // Because obj does not have an object id, we deduce that this is the first access to the
        // object
        isRead = false;
    }
    //now record the access
    if (!reportCollectionDeactivated(rid)) {
        defineProperty(obj, 'isLoggable', true);
        accessObject_safe(rid, hid, obj.objID, obj, isRead, undefined);
    }
    // Arrays need to be cloned.
    if (obj instanceof Array) {
        return cloneDeep(obj);
    } else if (obj.karousos_x instanceof Array) {
        let obj2 = obj;
        obj2.karousos_x = cloneDeep(obj.karousos_x);
        return obj2;
    }
    return obj;
}

exports.recordAccess = recordAccess;

// Assign a new object id to obj
function assignObjectID(obj, rid, hid, isRead, isNewObject, parentObject, method, print) {
    if (mode >= 4) return obj;
    // Only assign object ids to functions, errors, and promises
    if (obj && !(obj instanceof Function) && !(obj instanceof Error) && !(obj instanceof Promise) && !(obj.isLoggable)) {
        return obj;
    }
    // Do not assign ids to primitives
    if (isPrimitiveType(obj)) {
        return obj;
    }
    // Sanity check that requests don't access objects created by other requests
    if (
        reportCollectionActivated(rid) &&
        hasOwnProperty(obj, 'objID') &&
        obj.objID.requestID != undefined &&
        obj.objID.requestID != rid &&
        reportCollectionActivated(obj.objID.requestID)
    ) {
        console.log(
            "ERROR: request ",
            rid,
            " accesses object belonging to request ",
            obj.objID.requestID
        );
        console.trace();
        process.exit();
    }
    //Do not assign object ids on object methods because they are assigned to the prototype
    //and this creates bugs
    if (obj != undefined && builtins.EventEmitterMethods.has(obj)) return obj;
    // Do not assign object ids to functions that might be defined by karousos
    if (
        obj != undefined &&
        obj instanceof Function &&
        (parentObject != undefined || obj.karousosMaybeMethod)
    ) {
        defineProperty(obj, 'karousosMaybeMethod', true);
        return obj;
    }
    assert(isRead != undefined);
    //Do not assign objID to global object.prototype lodash tries to do this...
    if (
        obj == Object.prototype ||
        obj == Array.prototype ||
        obj == Function.prototype ||
        obj == EventEmitter.prototype
    ) {
        return obj;
    }
    // We cannot assign object ids to non extensible objects
    if ((obj instanceof Object || typeof obj === 'object') && !Object.isExtensible(obj)) return obj;
    // Do not change the poolsize of buffer because it is used internally
    if (method == 'poolSize' && parentObject == Buffer) {
        return obj
    }
    // Assign an object id to the object if it does not have one. Also, assign a request id
    if (!hasOwnProperty(obj, 'objID')) {
        var objID = createObjectID(rid, hid, isRead, assignObjectID, parentObject, method);
        defineProperty(obj, 'objID', objID);
        defineProperty(obj, 'requestID', rid);
    }
    if (obj.isLoggable) {
        accessObject_safe(rid, hid, obj.objID, obj, isRead, undefined);
        // Arrays need to be cloned.
        if (obj instanceof Array) {
            return cloneDeep(obj);
        } else if (obj.karousos_x instanceof Array) {
            let obj2 = obj;
            obj2.karousos_x = cloneDeep(obj.karousos_x);
            return obj2;
        }
    }
    return obj;
}

exports.assignObjectID = assignObjectID;

//Initialize the structures for a new request
exports.newRequestID = function(rid, reqHandler) {
    rid = rid.karousos_x ? rid.karousos_x : rid;
    initAwaitRetEvtType(rid);
    opcounts.set(rid, new Map());
    txls.set(rid, new Map());
    hls.set(rid, []);
    dependentEvents.set(rid, new Map());
    all.set(rid, new Map());
    race.set(rid, new Map());
    initGeneratorHelpers(rid);
    initPromiseMethodsForRid(rid);
    initObjNumForRid(rid);
    // Initialize the control flow tag for a handler
    cfg.set(rid, new Map());
    if (process.env.COLLECT_OROCHI_JS_ADVICE == "true") {
        cfgOrochi.set(rid, 0);
    }
    seenEvents.set(rid, new Map());
    registeredHandlers.set(rid, new Map())
    initEventsForObject(rid);
    let hid = new commonClasses.handlerID(reqHandler, '');
    accessDetector.newRid(rid);
    if (process.env.COLLECT_OROCHI_JS_ADVICE == "true") {
        accessDetectorOrochiJs.newRid(rid);
    }
    initNewHandler(rid, hid, undefined);
    initNewHandler(rid, globalHandler, undefined);
    return hid;
}

// Initializes a new handler id
exports.newHandlerID = function(rid, handlerName) {
    if (mode >= 5) return;
    rid = rid.karousos_x ? rid.karousos_x : rid;
    // Check if the request has been initialized. If not, initialize it
    if (!opcounts.has(rid)) {
        return serverLib.newRequestID(rid, handlerName);
    }
    var [ridPoped, hidPoped, _, _] = this.popContext();
    if (ridPoped == rid) {
        return hidPoped;
    }
    var hid = new commonClasses.handlerID(handlerName, '');
    initNewHandler(rid, hid, undefined);
    return hid;
}

// Initializes structures for a new handler
function initNewHandler(rid, hid, parentHid) {
    if (mode >= 5) return;
    rid = rid.karousos_x ? rid.karousos_x : rid;
    try {
        let hidHash = hid.toString();
        if (reportCollectionDeactivated(rid)) return;
        // Sanity check hat this handler has not been activated before
        if (opcounts.get(rid).has(hidHash)) {
            console.log('double handler', hidHash, hid.eid, hid.fname)
            console.trace();
            process.exit()
        }
        opcounts.get(rid).set(hidHash, 0);
        accessDetector.newHandlerID(rid, hid, parentHid);
        if (process.env.COLLECT_OROCHI_JS_ADVICE == "true") {
            accessDetectorOrochiJs.newHandlerID(rid, hid, parentHid);
        }
        if (!reportCollectionActivated(rid)) return;
        initObjNumForHid(rid, hid);
        // Initialize the control flow tag for the handler
        if (process.env.COLLECT_OROCHI_JS_ADVICE == "true") {
            // This is K-naive-batch: so update the tag of the request
            cfgOrochi.set(rid, (cfgOrochi.get(rid) * p + hashCode(hid.toString())) % Number.MAX_SAFE_INTEGER)
        }
        cfg.get(rid).set(hid, 0);
        setCurrentHandler(rid, hid);
    } catch (err) {
        console.log(err);
        process.exit();
    }
}

// Sets the promise's rid, hid, and retEventTypes to the input ones
exports.updatePromiseObject = function(promise, rid, hid, retEventTypes) {
    if (mode >= 5) return;
    rid = rid.karousos_x ? rid.karousos_x : rid;
    promise.requestID = rid;
    promise.handlerID = hid;
    promise.retEventTypes = retEventTypes;
}

// Records a transaction operation
exports.recordStateOp = function(rid, hid, optype, opcontents, txId, sql, key, table) {
    if (mode >= 3) {
        // If we do not record transaction operations, return dummy values of the correct form
        var txId = new commonClasses.TxID(hid, 0);
        if (optype == "tx_start") {
            //if it is a txstart return the computed txId
            return txId
        } else if (optype == "read") {
            return opcontents
        } else {
            //return the number of operations the transaction has done so far
            return [rid.toString(), txId.toString(), txnum]
        }
    }
    //if opcontents is not of the form [keys, values] convert it to this form
    if (optype == "write" && !(opcontents instanceof Array)) {
        var keys = [],
            values = [];
        for (let k in opcontents) {
            if (k != 'objID') {
                keys.push(k);
                values.push(getValueOf(opcontents[k], false, true));
            }
        }
        keys = keys.concat(['ionRequestID', 'ionTxID', 'ionTxNum']);
        opcontents = [keys, values];
    }
    try {
        function computeTxId(hid, stateOpNum) {
            return new commonClasses.TxID(hid, stateOpNum);
        }

        opcontents = getValueOf(opcontents, false, true, true);
        //HACK for stackTrace
        if (optype == "write" && opcontents[0].includes("id_hash")) {
            key = opcontents[1][opcontents[0].indexOf("id_hash")];
        }

        // Do not record operations during init
        if (!reportCollectionActivated(rid)) return;
        // Get the current opnum
        var opnum = opcounts.get(rid).get(hid.toString());
        //If it is a txStart compute the txId from opnum and hid and add a new entry in txls
        if (optype == "tx_start") {
            assert(txId == undefined || txId == null);
            txId = computeTxId(hid.toString(), opnum);
            txls.get(rid).set(txId.toString(), []); //add a new op in txls
        }
        // The entries that are recorded
        var produced_entries = []
        // If it is a PUT operation further convert opcontents
        if (optype == 'write') {
            // Opcontents should be two arrays: one that is the name of the columns and one with the
            // corresponding value
            assert(opcontents.length == 2 && opcontents[0].length == opcontents[1].length + 3);
            var new_opcontents = {};
            for (let i = 0; i < opcontents[1].length; i++) {
                new_opcontents[opcontents[0][i]] = opcontents[1][i]
            }
            opcontents = new_opcontents;
        }
        var txnum; // the index of this operation within the transaction
        var log; // the log we are going to update
        var isOpNotInTx = (optype == "read" || optype == "write") &&
            (txId == undefined || txId == null);
        if (isOpNotInTx) {
            // If it is a read or write that is not inside a tx
            // we wrap it in a transaction, and write tx_start, op, tx_end to the logs
            txId = computeTxId(hid.toString(), opnum);
            txls.get(rid).set(txId.toString(), []);
            log = [];
            let startTxOp = new commonClasses.stateOp("tx_start", null, hid.toString(), opnum);
            let stateOp = new commonClasses.stateOp(optype, opcontents, hid.toString(), opnum + 1, key);
            let endTxOp = new commonClasses.stateOp("tx_commit", null, hid.toString(), opnum + 2);
            opcounts.get(rid).set(hid.toString(), opnum + 3);
            produced_entries = produced_entries.concat([startTxOp, stateOp, endTxOp]);
            txnum = 1;
        } else {
            let stateOp = new commonClasses.stateOp(optype, opcontents, hid.toString(), opnum, key);
            produced_entries = [stateOp]
            opcounts.get(rid).set(hid.toString(), opnum + 1);
            log = txls.get(rid).get(txId.toString());
            txnum = log.length;
        }
        txls.get(rid).set(txId.toString(), log.concat(produced_entries));
        if (optype == "tx_start") {
            //if it is a txstart return the computed txId
            return txId
        } else if (optype == "read") {
            // Return the opcontents
            return serverLib.getValueOf(opcontents, false, true)
        } else {
            //return the number of operations the transaction has done so far
            return [rid.toString(), txId.toString(), txnum]
        }
    } catch (err) {
        console.log(err);
        console.log(opcontents);
        console.log(txId, key);
        process.exit()
    }

}

// Record the result of the non-deterministic operation in hid
exports.recordNonDetOp = function(rid, hid, result) {
    if (mode >= 3) return;
    rid = rid.karousos_x ? rid.karousos_x : rid;
    try {
        if (reportCollectionDeactivated(rid)) return;
        var opnum = opcounts.get(rid).get(hid.toString());
        hls.get(rid).push(new commonClasses.nonDetOp(hid.toString(), opnum, result));
        opcounts.get(rid).set(hid.toString(), opnum + 1)
        return;
    } catch (err) {
        console.log(err);
        process.exit()
    }
}

// Record the inspect handler operation
exports.recordCheckOp = function(rid, hid, eventEmitter, fname, args) {
    if (mode >= 3) return;
    rid = rid.karousos_x ? rid.karousos_x : rid;
    try {
        if (!reportCollectionActivated(rid)) return;
        var opnum = opcounts.get(rid).get(hid.toString());
        let entry = new commonClasses.checkEvents(
            hid.toString(),
            opnum,
            eventEmitter.objID,
            fname,
            args);
        hls.get(rid).push(entry);
    } catch (err) {
        console.log(err);
        process.exit()
    }
}

// This function gets as input the requestID, the handlerName and the type of event
// and adds a register operation in the handler log. It also updates the registered handlers
exports.Register = function(rid, hid, fname, eTypes, success, forAlreadyEmitted) {
    if (mode >= 4) return;
    rid = rid.karousos_x ? rid.karousos_x : rid;
    try {
        if (!(eTypes instanceof Array)) {
            eTypes = [eTypes];
        }
        if (!reportCollectionActivated(rid)) return;
        //Add the register op to the log
        let opnum = opcounts.get(rid).get(hid.toString());
        opcounts.get(rid).set(hid.toString(), opnum + 1);
        let entry = new commonClasses.register(hid, opnum, fname, eTypes, success, forAlreadyEmitted);
        hls.get(rid).push(entry);
        // Update the registered handlers
        var info = hls.get(rid).length - 1
        if (eTypes instanceof Array) {
            eTypes.forEach(e => {
                var evtStr = toEventStr(e, success);
                if (!registeredHandlers.get(rid).has(fname.toString())) {
                    registeredHandlers.get(rid).set(fname.toString(), new Map());
                }
                registeredHandlers.get(rid).get(fname.toString()).set(evtStr, info);
            })
        } else {
            var evtStr = toEventStr(eTypes, success);
            if (!registeredHandlers.get(rid).has(fname.toString())) {
                registeredHandlers.get(rid).set(fname.toString(), new Map())
            }
            registeredHandlers.get(rid).get(fname.toString()).set(evtStr, info)
        }
    } catch (err) {
        console.log(err);
        process.exit()
    }
}

// Record an unregister operation
exports.Unregister = function(rid, hid, fname, eType, success) {
    if (mode >= 3) return;
    rid = rid.karousos_x ? rid.karousos_x : rid;
    try {
        if (!reportCollectionActivated(rid)) return;
        //Add the unregister op to the log
        let opnum = opcounts.get(rid).get(hid.toString());
        opcounts.get(rid).set(hid.toString(), opnum + 1);
        let entry = new commonClasses.unregister(hid, opnum, fname, eType, success);
        hls.get(rid).push(entry);
        debug('unregister', entry);
    } catch (err) {
        console.log(err);
        process.exit()
    }
}

// Record an UnregisterAll operation
exports.UnregisterAll = function(rid, hid, eType, success) {
    if (mode >= 3) return;
    rid = rid.karousos_x ? rid.karousos_x : rid;
    try {
        if (!reportCollectionActivated(rid)) return;
        //Add the unregister event to the list
        let opnum = opcounts.get(rid).get(hid.toString());
        opcounts.get(rid).set(hid.toString(), opnum + 1);
        let entry = new commonClasses.unregisterAll(hid, opnum, eType, success);
        hls.get(rid).push(entry);
    } catch (err) {
        console.log(err);
        process.exit()
    }
}

// Emits all events and returns the emitted events
exports.EmitAll = function(rid, hid, eTypes, success) {
    if (mode >= 4) return;
    rid = rid.karousos_x ? rid.karousos_x : rid;
    if (reportCollectionDeactivated(rid)) return;
    var eventsEmitted = [];
    eTypes.forEach(t => {
        eventsEmitted = eventsEmitted.concat(serverLib.Emit(rid, hid, t, success));
    })
    return eventsEmitted;
}


// Record the emit operation and update the internal state we keep on emitted events
exports.Emit = function(rid, hid, eType, success) {
    if (mode >= 4) return;
    rid = rid.karousos_x ? rid.karousos_x : rid;
    eType = cloneDeep(eType);
    try {
        var emittedNow = []; //the events that are emitted now
        eType = commonClasses.turnToError(eType);
        if (reportCollectionDeactivated(rid)) return;
        // Below, info contains the type of the event and information on the handler and operation
        // that emits it
        if (reportCollectionActivated(rid)) {
            // If it is called from a request, record the emitted event, and update emittedNow
            let opnum = opcounts.get(rid).get(hid.toString());
            opcounts.get(rid).set(hid.toString(), opnum + 1);
            var entry = new commonClasses.emit(hid, opnum, eType, success);
            hls.get(rid).push(entry);
            var info = {
                type: success,
                hid: hid,
                opnum: opnum,
                idx: hls.get(rid).length - 1,
                eType
            };
            emittedNow = emittedNow.concat([info]);
        } else {
            // Update the global opcounts
            var index = globalOpcounts.get(hid) || 0;
            globalOpcounts.set(hid, index + 1);
            assert(hid != undefined && success != undefined)
            var info = {
                type: success,
                hid: hid,
                idx: index,
                opnum: index,
                eType
            }
        }
        // Update emitted events, emit all dependent events, and update emittedDepEvts
        var prev = emittedEvents.get(makeUid(rid, eType)) || [];
        var currentIndex = prev.length;
        emittedEvents.set(makeUid(rid, eType), prev.concat([info]));
        emittedNow = emittedNow.concat(
            this.emitAllDependentEvents(rid, hid, eType, success, currentIndex)
        );
        emittedDepEvts.set(makeUid(rid, eType), emittedNow);
        return emittedNow;
    } catch (err) {
        console.log(err, rid, hid);
        process.exit()
    }
}

// Gets as input an event and a type, the parameters of the handler that emits the event,
// and emits all dependent events (the events that are automatically emitted when this event
// is emitted)
exports.emitAllDependentEvents = function(rid, hid, eType, success, currentIndex) {
    if (mode >= 4) return;
    rid = rid.karousos_x ? rid.karousos_x : rid;
    var eventsEmitted = [];
    // Check if this event has any events that are emitted when it is emitted (dependent)
    if (dependentEvents.has(rid) && dependentEvents.get(rid).has(eType.toString())) {
        // Iterate over all dependent events
        dependentEvents.get(rid).get(eType.toString()).forEach((depEventInfo) => {
            var depEvent = depEventInfo.dependentEvent
            // If the dependent event is an event that is successfyl iff all events
            // that it depends on should are successfull
            if (all.get(rid).has(depEvent)) {
                // If the events on which depEvent depends on is a set,
                // Check if the event needs to be emitted
                let otherEvents = all.get(rid).get(depEvent);
                let newVal = null;
                if (otherEvents instanceof Set) {
                    serverLib.checkIfNeedToEmit(rid, depEvent, otherEvents, 'fail', 'success', hid);
                    return;
                }
                // Check if all events that this event depends on are already emitted with
                // type = success
                let allEmitted = success != 'success' || otherEvents.every(evt => {
                    var evts = emittedEvents.get(makeUid(rid, evt));
                    if (emittedEvents.has(makeUid(rid, evt)) && evts.length > currentIndex) {
                        if (evts[currentIndex].type != undefined) {
                            if (evts[currentIndex].type == 'success') return true;
                            return false
                        }
                        let idx = evts[currentIndex].idx
                        if (hls.get(rid)[idx].success == 'success') {
                            return true;
                        }
                    }
                    return false;
                });
                // If so, emit the event
                if (allEmitted) {
                    eventsEmitted = eventsEmitted.concat(this.Emit(rid, hid, depEvent, success));
                }
            }
            if (race.get(rid).has(depEvent)) {
                let otherEvents = race.get(rid).get(depEvent);
                let newVal = [];
                // Check if at least one of the events has been emitted with type = success
                let allEmitted = success == 'success' || otherEvents.every(evt => {
                    if (emittedEvents.has(makeUid(rid, evt))) {
                        let evts = emittedEvents.get(makeUid(rid, evt));
                        if (evts[currentIndex].type != undefined) {
                            if (evts[currentIndex].type != 'success') return true;
                            return false;
                        }
                        let idx = evts[currentIndex].idx
                        if (hls.get(rid)[idx].success != 'success') {
                            return true;
                        }
                    }
                    return false;
                });
                // If so, emit success
                if (allEmitted) {
                    eventsEmitted = eventsEmitted.concat(this.Emit(rid, hid, depEvent, success));
                }
            }
        })
    }
    return eventsEmitted;
}

exports.checkIfNeedToEmit = function(rid, dependentEvent, evts, type1, type2, hidInit) {
    if (mode >= 4) return;
    rid = rid.karousos_x ? rid.karousos_x : rid;
    var hid = undefined,
        allEmitted = evts.length > 0,
        foundType = false;
    if (evts instanceof Set) {
        //this can only happen if we are in the .all case
        //check all arrays of events in the set
        var emittedNum = 0;
        var hid;
        evts.forEach((evtArray) => {
            var allFailed = true;
            var updated = false;
            evtArray.forEach((evt) => {
                if (emittedEvents.has(makeUid(rid, evt))) {
                    var emitted = emittedEvents.get(makeUid(rid, evt));
                    var successOfDep = emitted[emitted.length - 1].type
                    let idx = emitted[emitted.length - 1].idx
                    //if one of them failed for the first time we need to emit the event
                    if (successOfDep == 'success') {
                        if (!updated) emittedNum += 1;
                        updated = true;
                        assert(emitted[emitted.length - 1].hid != undefined);
                        debug('setting hid');
                        hid = emitted[emitted.length - 1].hid;
                        allFailed = false;
                    }
                    hid = emitted[emitted.length - 1].hid;
                } else {
                    allFailed = false;
                }
            })
            //all the emitted events in this group have failed so emit a fail event and return
            if (allFailed) {
                this.EmitAll(rid, hidInit || hid, [dependentEvent], 'fail');
                return;
            }
        })
        //all have been emitted
        if (emittedNum == evts.size) {
            this.EmitAll(rid, hidInit || hid, [dependentEvent], 'success');
        }
        return;
    }

    var foundEvt;
    //if we have reached this point, evts is an array
    evts.forEach(evt => {
        try {
            debug('event is', evt, evts)
            if (emittedEvents.has(makeUid(rid, evt))) {
                var emitted = emittedEvents.get(makeUid(rid, evt));
                var successOfDep = emitted[emitted.length - 1].type
                let idx = emitted[emitted.length - 1].idx
                //if one of them failed for the first time we need to emit the event
                if (successOfDep == type1 && !foundType) {
                    foundType = true;
                    assert(emitted[emitted.length - 1].hid != undefined)
                    debug('setting hid')
                    hid = emitted[emitted.length - 1].hid;
                    foundEvt = emitted[emitted.length - 1];
                } else if (!foundType) {
                    hid = emitted[emitted.length - 1].hid
                }
            } else {
                allEmitted = false;
                debug('setting hid', type1)
                assert(evts[evts.length - 1].hid != undefined)
                hid = evts[evts.length - 1].hid
            }
        } catch (err) {
            console.log(err, evts)
            process.exit()
        }
    });
    if (allEmitted || foundType) {
        debug(evts.length)
        try {
            assert(hid != undefined)
        } catch (err) {
            console.trace();
            process.exit()
        }

        var emitted = this.EmitAll(rid, hidInit || hid, [dependentEvent], foundType ? type1 : type2);
        if (evts.length == 1) {
            let prevDepEmitted = emittedDepEvts.get(makeUid(rid, evts[0])) || [];
            emittedDepEvts.set(makeUid(rid, evts[0]), prevDepEmitted.concat(emitted));
        }
    }
}

// Searches the event that activates fname and returns it
exports.SearchEventOfType = function(rid, eTypes, success, fname, isThen) {
    if (mode >= 4) return;
    try {
        rid = rid.karousos_x ? rid.karousos_x : rid;
        if (rid == undefined) {
            throw new Error('rid undefined');
        }
        var res = [{
                idx: -1
            },
            []
        ];
        eTypes.forEach(t => {
            t = commonClasses.turnToError(t);
            // If the event is emitted, then the event that activates the handler
            // is the first one that appears after the handler registration and has not
            // activated a handler yet
            if (emittedEvents.has(makeUid(rid, t)) && emittedEvents.get(makeUid(rid, t)).length > 0) {
                let evtI = seenEvents.get(rid).get(fname.toString() + ':' + t.toString())
                var handlerRegisteredAt = -1;
                let evtStr = toEventStr(t, success);
                if (
                    registeredHandlers.has(rid) &&
                    registeredHandlers.get(rid).has(fname.toString())
                ) {
                    handlerRegisteredAt = registeredHandlers.get(rid).get(fname.toString()).get(evtStr)
                    if (hls.get(rid)[handlerRegisteredAt].forAlreadyEmitted) {
                        handlerRegisteredAt = -1;
                    }
                }
                var evts = emittedEvents.get(makeUid(rid, t))
                if (!evtI || evts.length > evtI) {
                    if (!evtI || evts[evtI].idx < handlerRegisteredAt) {
                        let evtsGreaterThan = evts.filter(e => e.idx > handlerRegisteredAt);
                        evtI = evts.length - evtsGreaterThan.length
                    }
                    var info = evts[evtI]
                    if (!isThen) {
                        seenEvents.get(rid).set(fname.toString() + ':' + t.toString(), evtI + 1)
                    }
                    if (info.type != undefined) {
                        if (info.type == success || success == 'any') {
                            res = [info, [info]]
                        }
                    } else if (hls.get(rid)[info.idx].success == success || success == 'any') {
                        debug(hls.get(rid)[info.idx])
                        if (res[0].idx == -1) res = [info, [info]];
                        debug('now res');
                    }
                }
            } else if (
                emittedEvents.has(makeUid(-1, t)) &&
                emittedEvents.get(makeUid(-1, t)).length > 0
            ) {
                // Special case: the event is emitted by init
                var info = emittedEvents.get(makeUid(-1, t))[0];
                res = [info, [info]];
            }
        })
    } catch (err) {
        console.log(err);
        process.exit();
    }
    return res;
}

// Computes the new hanlder id for function with id fname
exports.GetHandlerID = function(rid, eTypes, fname, success, isThen) {
    if (mode >= 4) return globalHandler;
    rid = rid.karousos_x ? rid.karousos_x : rid;
    if (reportCollectionDeactivated(rid)) return globalHandler;
    var ret = this.SearchEventOfType(rid, eTypes, success, fname, isThen);
    var info = ret[0];
    var indexes = ret[1];
    if (info.idx == -1) {
        console.log('could not find event of type', success, makeUid(rid, eTypes[0]));
        eTypes.forEach(e => console.log(e.toString()));
        console.trace();
        process.exit();
    }
    assert(info.eType != undefined)
    let hid = new commonClasses.handlerID(
        fname,
        new commonClasses.eventID(info.hid, info.opnum, info.eType)
    );
    initNewHandler(rid, hid, info.hid);
    this.pushContext(rid, hid, [], '');
    return hid;
}

// Used by then/catch/finally functions. Computes the handler id and unregisters the handler
exports.GetAndUpdateHandlerID = function(rid, hidPrev, eTypes, fname, success) {
    if (mode >= 4) return globalHandler;
    rid = rid.karousos_x ? rid.karousos_x : rid;
    if (reportCollectionDeactivated(rid)) return globalHandler;
    var ret = this.SearchEventOfType(rid, eTypes, success, fname, true);
    var info = ret[0];
    var indexes = ret[1];
    if (info.idx == -1 || !info.hid) {
        console.log(eTypes[0].toString(), info, success)
        debug('could not find event of type ' + eTypes[0].toString());
        console.trace();
        process.exit();
    }
    assert(info.eType != undefined)
    let hid = new commonClasses.handlerID(
        fname,
        new commonClasses.eventID(info.hid, info.opnum, info.eType)
    );
    initNewHandler(rid, hid, info.hid);
    serverLib.Unregister(rid, hid, fname, eTypes, success);
    return hid;
}

// Set all evts in the list to failed in the logs and in emitted
function eventsFailed(rid, eType) {
    if (mode >= 4) return;
    rid = rid.karousos_x ? rid.karousos_x : rid;
    try {
        var evts = emittedDepEvts.get(makeUid(rid, eType));
        evts.forEach(info => {
            hls.get(rid)[info.idx].success = "fail";
            var prevEmitted = emittedEvents.get(makeUid(rid, info.eType));
            prevEmitted.forEach(evt => evt.type = "fail");
            emittedEvents.set(makeUid(rid, info.eType), prevEmitted);
        })
    } catch (err) {
        console.log(err);
        process.exit();
    }
}

// Marks the dependent event as dependent on the dependant events
exports.SetReturnEventTypes = function(rid, dependantEvts, dependentEvts, isPromiseAll, hid2) {
    if (mode >= 4) return;
    rid = rid.karousos_x ? rid.karousos_x : rid;
    var fnToApply = (evt) => {
        serverLib.setReturnEventTypes(rid, dependantEvts, evt, isPromiseAll, hid2)
    }

    if (Array.isArray(dependentEvts)) {
        if (dependantEvts.length == 0) {
            this.EmitAll(rid, hid2, dependentEvts, 'success');
        } else if (
            dependantEvts.length == 1 &&
            dependantEvts[0] instanceof commonClasses.objectID &&
            dependantEvts[0].requestID == -2
        ) {
            this.EmitAll(rid, hid2, dependentEvts, 'success');
        }
        dependentEvts.forEach(fnToApply)
    } else {
        fnToApply(dependentEvts)
    }
}

// Marks the dependent event as dependent on the dependant events
exports.setReturnEventTypes = function(rid, dependantEvts, dependentEvt, isPromiseAll, hid2) {
    if (mode >= 4) return;
    try {
        var ret = [];
        dependantEvts.forEach(evt => {
            if (Array.isArray(evt)) {
                ret = ret.concat(evt);
            } else {
                ret.push(evt);
            }
        });
        var myThens = [];
        ret.forEach((e) => {
            myThens = myThens.concat(findLastThenPriorToCatch(e, rid))
        })
        var allEvents = ret;
        if (myThens.length > 0 && isPromiseAll == true) {
            if (ret.length > 1) {
                allEvents = new Set();
                ret.forEach((e) => {
                    thens = findLastThenPriorToCatch(e);
                    allEvents.add(thens.concat([e]))
                })
            } else {
                isPromiseAll = false;
            }
            ret = ret.concat(myThens);
        }

        if (!reportCollectionActivated(rid) && !dependentEvents.has(rid)) {
            dependentEvents.set(rid, new Map())
            all.set(rid, new Map())
            race.set(rid, new Map())
        }
        //fill dependent events map from dependant events to dependent events
        ret.forEach(elem => {
            //save who will emit the event (if different than the dependant event)
            var prevDepEvts = dependentEvents.get(rid).get(elem.toString()) || [];
            if (prevDepEvts.every((e) => e.dependentEvent != dependentEvt)) {
                dependentEvents.get(rid).set(elem.toString(), prevDepEvts.concat([{
                    "dependentEvent": dependentEvt,
                    "requestID": rid,
                    "handlerID": hid2
                }]));
            }
        });
        // Check if we need to emit the event already
        if (isPromiseAll) {
            all.get(rid).set(dependentEvt, allEvents);
            serverLib.checkIfNeedToEmit(rid, dependentEvt, allEvents, 'fail', 'success', hid2);
        } else {
            race.get(rid).set(dependentEvt, ret);
            serverLib.checkIfNeedToEmit(rid, dependentEvt, allEvents, 'success', 'fail', hid2);
        }
    } catch (err) {
        console.log(err);
        process.exit();
    }
}

// Either add dependent events (if result is a promise), or emit the event
exports.SetOrEmit = function(rid, hid, result, thisPromise, success) {
    if (mode >= 4) return;
    rid = rid.karousos_x ? rid.karousos_x : rid;
    if (reportCollectionDeactivated(rid)) return [];
    assert(result == undefined || !(result instanceof Promise) || result.karContents != undefined)
    if (result && result.karContents instanceof Promise) {
        this.SetReturnEventTypes(
            rid,
            result.retEventTypes.concat([result.objID]),
            thisPromise.retEventTypes,
            false
        );
    } else {
        this.EmitAll(rid, hid, thisPromise.retEventTypes, success);
    }
}

// Functions to get and set the current handler
exports.getCurrentHandler = function(rid) {
    if (mode >= 4) return globalHandler;
    rid = rid.karousos_x ? rid.karousos_x : rid;
    if (reportCollectionDeactivated(rid)) return globalHandler;
    if (!curHandler.has(rid)) {
        throw new Error('no current handlerID');
    }
    return curHandler.get(rid);
}

function setCurrentHandler(rid, hid) {
    if (mode >= 4) return;
    rid = rid.karousos_x ? rid.karousos_x : rid;
    curHandler.set(rid, hid);
}

exports.setCurrentHandler = setCurrentHandler;

// assign an object id and a request id to the input obj
exports.setObjectIDandRequestID = function(obj, rid, hid) {
    if (mode >= 4) return obj;
    rid = rid.karousos_x ? rid.karousos_x : rid;
    if (!obj || hasOwnProperty(obj, 'objID')) {
        return obj;
    }
    if (typeof obj !== "boolean" && !(obj instanceof Boolean) &&
        typeof obj !== "string" && !(obj instanceof String) &&
        typeof obj !== "array" && !(obj instanceof Array) &&
        typeof obj !== "number" && !(obj instanceof Number)) {
        serverLib.assignObjectID(obj, rid, hid, false);
        if (rid != undefined) {
            defineProperty(obj, 'requestID', rid);
        }
    }
}

// add the requst id and handler id to obj if it is a thenable but not a native function
exports.addRidHidIfNeeded = function(obj, requestID, handlerID) {
    if (mode >= 4) return obj;
    //if it is a thenable but not a native promise save the requestID and handlerID
    if (obj && typeof obj.then === 'function' && !(obj instanceof Promise)) {
        defineProperty(obj, 'requestID', requestID);
        defineProperty(obj, 'handlerID', handlerID);
        serverLib.assignObjectID(obj, requestID, handlerID, false);
        defineProperty(obj, 'retEventTypes', []);
    }
    return obj;
}

// The main function wrapper
exports.callFunction = function(
    isNew,
    fn,
    thisArg,
    method,
    requestID,
    handlerID,
    retEventTypes,
    initArgs,
    print
) {
    requestID = requestID.karousos_x ? requestID.karousos_x : requestID;
    var thisArgOriginal = thisArg;
    thisArg = serverLib.getValueOf(thisArg);
    method = serverLib.getValueOf(method);
    var thisArgNotNull = thisArg != undefined && thisArg != null;
    if (mode >= 5) {
        //Just do the call
        return isNew ?
            new fn(...initArgs) :
            (
                thisArgNotNull && thisArg[method] instanceof Function ?
                thisArg[method](...initArgs) :
                fn(...initArgs)
            );
    }
    // If fn is undefined try to reconstruct it from thisArg and method
    thisArg = serverLib.getValueOf(thisArg);
    method = serverLib.getValueOf(method);
    if (fn == undefined && thisArg != undefined) {
        fn = thisArg[serverLib.getValueOf(method)];
    }
    assert(fn != undefined);
    // Functions to retrieve and modify arguments for general functions
    var getArgs = () => {
        return initArgs
    };

    var setArgs = (newArgs) => {
        return newArgs
    };
    var getThis = () => {
        return thisArg
    };
    // The underlying function whose type we check for, and accordingly make the call
    var toTest = fn;
    assert(toTest != undefined);
    if (fn == Function.prototype.call) {
        // Functions to retrieve and modify arguments for Function.call
        getArgs = () => {
            return initArgs.slice(1)
        };
        setArgs = (newArgs) => {
            return [initArgs[0]].concat(newArgs)
        };
        getThis = () => {
            return initArgs[0]
        };
        // The funciton that we test if the fn in fn.call
        toTest = thisArg;
    } else if (fn == Function.prototype.apply) {
        // Functions to retrieve and modify arguments for Function.apply
        getArgs = () => {
            return serverLib.getValueOf(initArgs[1]) || []
        };
        setArgs = (newArgs) => {
            return [initArgs[0], newArgs]
        };
        getThis = () => {
            return initArgs[0]
        };
        // The funciton that we test if the fn in fn.apply
        toTest = thisArg;
    } else if (fn == Reflect.apply) {
        // Functions to retrieve and modify arguments for Reflect.apply
        getArgs = () => {
            return initArgs[2] || []
        };
        setArgs = (newArgs) => {
            return [initArgs[0], initArgs[1], newArgs]
        };
    }
    var concatArgs = (newArgs) => {
        return setArgs(newArgs.concat(getArgs()))
    };
    // Save the current hid and request id as context
    serverLib.pushContext(requestID, handlerID, retEventTypes, '');
    // make sure the the underlying function toTest is undefined
    assert(toTest != undefined);
    var fType = functionType(toTest, initArgs, isNew, thisArg, method);
    // Unwrap the arguments. If this is a call to a user-defined function there is no
    // need to unwrap all arrays in the arguments
    if (fType != 1) {
        var argsNew = [];
        for (let arg of initArgs) {
            if (arg && arg.isLoggable) {
                assignObjectID(arg, requestID, handlerID, true);
            }
            argsNew.push(serverLib.getValueOf(arg, true))
        }
        initArgs = argsNew;
    } else {
        var argsNew = [];
        for (let arg of initArgs) {
            argsNew.push(serverLib.getValueOf(arg))
        }
        initArgs = argsNew;
    }
    var args = getArgs();
    switch (fType) {
        case 0: //call we can't handle
            return new Error('call we cannot handle');
        case 1: //our call, might return a thenable. so in any case emit an event...
            var rid = requestID,
                hid = handlerID;
            var initRetEventTypesLength = retEventTypes.length;
            // asynchronous function should see retEventTypes.length > 0 so that they return promises
            // so create an object id an assign it to it
            if (fn.constructor == asyncFuncProto.constructor) {
                var objID = createObjectID(requestID, handlerID, false, assignObjectID)
                retEventTypes = retEventTypes.concat([objID])
            }
            var newArgs = concatArgs([requestID, handlerID, retEventTypes, objID]);
            // Call the function on the new arguments
            if (fn.isNewFunction && thisArg != undefined) {
                var obj = thisArg[method](...newArgs);
            } else {
                var obj = isNew ?
                    new fn(...newArgs) :
                    (
                        thisArgNotNull && thisArg[method] instanceof Function ?
                        thisArg[method](...newArgs) :
                        fn(...newArgs)
                    );
            }
            // Unwrap the promise
            if (obj && obj.karContents && obj.karContents instanceof Promise) {
                return obj;
            }
            // Otherwise wrap the thenable
            if (obj && typeof obj.then === 'function' && !(obj instanceof Promise)) {
                obj.requestID = requestID;
                obj.handlerID = handlerID;
                obj.retEventTypes = [];
            }
            // the function called might be an asynchronous function: wrap the promise and
            // emit a success event for the returned promise. If the promise fails,
            // update the event to fail
            if (obj instanceof Promise && !obj.karContents && initRetEventTypesLength == 0) {
                var prom = serverLib.createPromiseObject(requestID, handlerID);
                serverLib.EmitAll(requestID, handlerID, prom.retEventTypes, 'success');
                prom.karContents = obj.catch((err) => {
                    console.log(err);
                    eventsFailed(requestID, prom.retEventTypes);
                    throw err;
                });
                serverLib.setThen(prom);
                return prom;
            }
            return serverLib.getValueOf(obj);
        case 2: //new Promise
            assert(
                fn != Reflect.apply &&
                fn != Function.prototype.call &&
                fn != Function.prototype.apply
            );
            // Save a global variable promisename and set it to x.
            var x = serverLib.createPromiseObject(requestID, handlerID);
            global[args[0].promiseName] = x;
            x.karContents = new Promise(args[0].fromPromiseInternal);
            serverLib.setThen(x);
            return x;
        case 3: //Promise.prototype.then
            assert(fn != Reflect.apply);
            if (fn == Function.prototype.call || fn == Function.prototype.apply) {
                thisArg = getThis();
            }
            var t = true;
            if (thisArg.karContents == undefined) {
                throw new Error('thisArg.karContents undefined');
            }
            // Wrap the new promise
            var p = serverLib.createPromiseObject(requestID, handlerID);
            if (args.length == 0) {
                args[0] = function emptyThen(x) {
                    return x;
                };
            };
            var newFns = [null, null]
            // Handle each of the callbacks:
            // update promise menthods. Assign an object id to each of the functions
            // And register them as listeners to the promise's events
            // Wrap the callbacks, to retrieve the handler id and request id when they start
            // executing
            if (
                args.length == 2 &&
                serverLib.getValueOf(args[1]) != undefined &&
                serverLib.getValueOf(args[1]) != null
            ) {
                assert(args[1] instanceof Function);
                serverLib.assignObjectID(args[1], requestID, handlerID, true);
                if (!reportCollectionDeactivated(rid)) {
                    addPromiseMethod(requestID, thisArg, p, 'catch');
                    p.inFailEventTypes = getAllEventsForCatch(requestID, thisArg);
                }
                serverLib.Register(
                    requestID,
                    handlerID,
                    (args[1].objID || "").toString(),
                    p.inFailEventTypes,
                    'fail',
                    true
                );
                var catchFn = (res) => {
                    var requestID = p.requestID;
                    var handlerID = serverLib.GetHandlerID(
                        requestID,
                        p.inFailEventTypes,
                        args[1].objID.toString(),
                        "fail",
                        true
                    );
                    var retEventTypes = p.retEventTypes;
                    let fType = functionType(args[1], re);
                    if (fType == 1) {
                        return args[1](requestID, handlerID, retEventTypes, "", res);
                    } else {
                        assert(fType == 100)
                        return args[1](res)
                    }
                }
                newFns[1] = catchFn;
            }
            if (
                args.length > 0 &&
                serverLib.getValueOf(args[0]) != undefined &&
                serverLib.getValueOf(args[0]) != null
            ) {
                assert(args[0] instanceof Function);
                serverLib.assignObjectID(args[0], requestID, handlerID, true);
                if (!reportCollectionDeactivated(rid)) {
                    addPromiseMethod(requestID, thisArg, p, 'then');
                    p.inSuccessEventTypes = getAllEventsForThen(requestID, thisArg);
                }
                var fname = args[0].objID ? args[0].objID.toString() : "";
                serverLib.Register(
                    requestID,
                    handlerID,
                    fname,
                    p.inSuccessEventTypes,
                    'success',
                    true
                );
                var thenFn = (res) => {
                    var requestID = p.requestID;
                    var handlerID = serverLib.GetHandlerID(
                        requestID,
                        p.inSuccessEventTypes,
                        fname,
                        "success",
                        true
                    );
                    var retEventTypes = p.retEventTypes;
                    var fType = functionType(args[0], res);
                    if (fType == 1) {
                        return args[0](requestID, handlerID, retEventTypes, "", res);
                    } else {
                        assert(fType == 100);
                        return args[0](res)
                    }
                }
                newFns[0] = thenFn;
            }
            // Now call the function
            if (fn == Function.prototype.apply) {
                p.karContents = thisArg.karContents.then.apply(thisArg.karContents, newFns)
            } else if (fn == Function.prototype.call) {
                p.karContents = thisArg.karContents.then.call(thisArg.karContents, ...newFns);
            } else {
                p.karContents = thisArg.karContents.then(...newFns)
            }
            // Make the wrapper object and thenable
            serverLib.setThen(p);
            return p;

        case 4: //Promise.prototype.catch: Handled as case 3
            assert(
                fn != Reflect.apply &&
                fn != Function.prototype.call &&
                fn != Function.prototype.apply
            );
            if (thisArg.karContents == undefined) {
                throw new Error('thisArg.karContents undefined');
            }
            var myArg = getThis();
            thisArg = myArg;
            var p = serverLib.createPromiseObject(requestID, handlerID);
            assert(args.length > 0);
            assert(args[0] instanceof Function);
            serverLib.assignObjectID(args[0], requestID, handlerID, true);
            addPromiseMethod(requestID, myArg, p, 'catch');
            p.inEventTypes = getAllEventsForCatch(requestID, myArg);
            var fname = args[0].objID ? args[0].objID.toString() : "";
            serverLib.Register(requestID, handlerID, fname, p.inEventTypes, 'fail', true);
            p.karContents = myArg.karContents.catch((res) => {
                var requestID = p.requestID;
                var handlerID = serverLib.GetHandlerID(requestID, p.inEventTypes, fname, "fail", true);
                var retEventTypes = p.retEventTypes;
                return args[0](requestID, handlerID, retEventTypes, "", res);
            });
            serverLib.setThen(p);
            return p;
        case 5: //promise.prototype.finally: Handled as case 3
            assert(
                fn != Reflect.apply &&
                fn != Function.prototype.call &&
                fn != Function.prototype.apply
            );
            assert(fn != Reflect.apply);
            var myArg = thisArg;
            if (thisArg.karContents == undefined) {
                throw new Error('thisArg.karContents undefined');
            }
            thisArg = myArg;
            var p = serverLib.createPromiseObject(requestID, handlerID);
            assert(args.length > 0);
            assert(args[0] instanceof Function);
            serverLib.assignObjectID(args[0], requestID, handlerID, true);
            addPromiseMethod(requestID, myArg, p, 'finally');
            p.inEventTypes = getAllEventsForFinally(requestID, myArg);
            serverLib.Register(
                requestID,
                handlerID,
                args[0].objID.toString(),
                p.inEventTypes,
                'any',
                true
            );
            p.karContents = myArg.karContents.finally((res) => {
                var requestID = p.requestID;
                var handlerID = serverLib.GetHandlerID(
                    requestID,
                    p.inEventTypes,
                    args[0].objID.toString(),
                    "any",
                    true
                );
                var retEventTypes = p.retEventTypes;
                let ret = args[0](requestID, handlerID, retEventTypes, "", res);
                serverLib.Unregister(requestID, handlerID, args[0].name, p.inEventTypes, 'any');
                return ret
            })
            serverLib.setThen(p);
            return p;
        case 6: //promise.all or promise.race
            assert(
                fn != Reflect.apply &&
                fn != Function.prototype.call &&
                fn != Function.prototype.apply
            );
            assert(fn != Reflect.apply);
            var p = serverLib.createPromiseObject(requestID, handlerID);
            var myArgs = [],
                myArgsEvents = [];
            for (let i = 0; i < args[0].length; i++) {
                let arg = args[0][i];
                // Emit all events if the arguments are not promises
                if (arg == undefined || !(arg instanceof Promise)) {
                    var myArg = serverLib.createPromiseObject(requestID, handlerID);
                    myArg.karContents = arg;
                    serverLib.EmitAll(requestID, handlerID, myArg.retEventTypes, 'success');
                    args[0][i] = myArg;
                    arg = myArg;
                }
                myArgs.push(arg.karContents);
                myArgsEvents.push(arg.retEventTypes);
            }
            // Make the resolve/reject events of this promise depend on the argument promises
            serverLib.SetReturnEventTypes(
                requestID,
                myArgsEvents,
                p.retEventTypes,
                fn == Promise.all,
                handlerID
            );
            p.karContents = fn == Promise.all ? Promise.all(myArgs) : Promise.race(myArgs);
            serverLib.setThen(p);
            return p;
        case 7: //promise.reject of promise.resolve
            assert(
                fn != Reflect.apply &&
                fn != Function.prototype.call &&
                fn != Function.prototype.apply
            );
            // Emit a success event. If the promise ends up rejecting, change its type
            var p = serverLib.createPromiseObject(requestID, handlerID);
            var arg = (args[0] && args[0].karContents) ? args[0].karContents : args[0];
            p.karContents = fn == Promise.resolve ? Promise.resolve(arg) : Promise.reject(arg);
            serverLib.EmitAll(requestID, handlerID, p.retEventTypes, "success");
            p.karContents = p.karContents.catch((err) => {
                console.log(err)
                eventsFailed(requestID, p.retEventTypes);
                throw err;
            })
            serverLib.setThen(p);
            return p;
        case 9: //bind
            assert(fn != Reflect.apply && fn != Function.prototype.call);
            // Save the function init type. wrap the binded function to retrieve the context
            var myFunc = getThis();
            if (fn == Function.prototype.apply) {
                assert(args.length < 2)
                var res = thisArg.apply(...initArgs);
            } else {
                if (args.length > 1) {
                    myFunc = function(...funcArgs) {
                        var fType = functionType(thisArg);
                        if (fType == 1) {
                            return thisArg(...(serverLib.popContext().concat(funcArgs)));
                        } else if (fType == 23) {
                            var [requestID, handlerID, retEventTypes, objID] = serverLib.popContext();
                            return serverLib.callFunction(
                                false,
                                this.emit,
                                this,
                                'emit',
                                requestID,
                                handlerID,
                                retEventTypes,
                                funcArgs
                            )
                        } else {
                            assert(fType == 100);
                            return thisArg(...funcArgs);
                        }
                    }
                }
                var res = myFunc.bind(...args);
            }
            saveFunctionInitType(res, myFunc)
            return res;
        case 10: //Function constructor: Parse the function
            assert(fn != Reflect.apply && fn != Function.prototype.call)
            if (fn != Function.prototype.apply) {
                assert(getThis() == null)
            }
            return newFunction(...[
                fn == generatorFuncProto.constructor,
                fn == asyncFuncProto.constructor
            ].concat(getArgs().map(serverLib.getValueOf)))
        case 11: //eval: transform the function and execute it
            assert(
                fn != Reflect.apply &&
                fn != Function.prototype.call &&
                fn != Function.prototype.apply
            );
            var code = args[0].map(serverLib.getValueOf);
            var codeTranspiled = transformFunction(code, false, false, true);
            return eval(codeTraspiled);
        case 12:
            //generator next: set the handler id prior to the call and retrieve it after the call
            assert(
                fn != Reflect.apply &&
                fn != Function.prototype.call &&
                fn != Function.prototype.apply
            );
            setHandlerIDforObjectID(requestID, handlerID, thisArg, serverLib.assignObjectID);
            var res = thisArg.next(...args);
            handlerID = getHandlerIDforObjectID(
                requestID,
                handlerID,
                thisArg,
                serverLib.assignObjectID
            );
            serverLib.setCurrentHandler(requestID, handlerID);
            serverLib.setObjectIDandRequestID(res, requestID, handlerID);
            return res;
        case 13: //JSON.parse or JSON.stringify: wrap the callback to retrieve the context
            assert(
                fn != Reflect.apply &&
                fn != Function.prototype.call &&
                fn != Function.prototype.apply
            );
            if (args.length < 2 || args[1] == null || args[1] == undefined) {
                return fn(...args.map(serverLib.getValueOf));
            }
            var myFunction = function(...funcArgs) {
                try {
                    assert(functionType(args[1]) == 1);
                } catch (err) {
                    console.log('ERROR', err);
                    process.exit();
                }
                return args[1](...[requestID, handlerID, retEventTypes, ''].concat(
                    funcArgs.map(serverLib.getValueOf)
                ));
            }
            return fn(...[args[0], myFunction].concat(args.slice(2)));
        case 14: //assertRejectOrThrow: wrap the callback to retrieve the context
            assert(
                fn != Reflect.apply &&
                fn != Function.prototype.call &&
                fn != Function.prototype.apply
            );
            var myFunction = function() {
                try {
                    assert(functionType(args[0]) == 1);
                } catch (err) {
                    console.log('ERROR', err);
                    process.exit();
                }
                args[0](requestID, handlerID, retEventTypes, '');
            }
            return fn(...[myFunction].concat(args.slice(1)));
        case 15: //non deterministic call to node core: do the call and save the result in the advice
            assert(
                fn != Reflect.apply &&
                fn != Function.prototype.call &&
                fn != Function.prototype.apply
            );
            var res =
                isNew ?
                new fn(...args.map(x => serverLib.getValueOf(x))) :
                fn(...args.map(x => serverLib.getValueOf(x)));
            serverLib.recordNonDetOp(requestID, handlerID, res);
            if (fn == crypto.randomFillSync) {
                // record the access if this args[0] is modified
                assignObjectID(args[0], requestID, handlerID, false)
            }
            return res;
        case 16: //deterministic call to node core with callback
            // There is no callback. so just make the call
            if (!(args[args.length - 1] instanceof Function)) {
                return isNew ?
                    (
                        thisArgNotNull ?
                        new thisArg[method](...args.map(x => serverLib.getValueOf(x))) :
                        fn(...args.map(x => serverLib.getValueOf(x)))
                    ) :
                    (
                        thisArgNotNull ?
                        thisArg[method](...args.map(x => serverLib.getValueOf(x))) :
                        fn(...args.map(x => serverLib.getValueOf(x)))
                    );
            }
            // Otherwise, assign an object id to the function, register the callback, and
            // activate it before making the call. Wrap the callback in a function to
            // retrieve the context
            var objID = createObjectID(requestID, handlerID, false, assignObjectID);
            fn = serverLib.assignObjectID(fn, requestID, handlerID, true, false);
            var fname = mode < 4 ? fn.objID.toString() : "";
            serverLib.Register(requestID, handlerID, fname, [objID], 'success');
            serverLib.EmitAll(requestID, handlerID, [objID], 'success');
            var rid = requestID;
            var hid = handlerID;
            var objID2 = objID;
            var retEventTypes2 = [objID];
            var myFunction = function(...funcArgs) {
                var requestID = rid;
                var handlerID = serverLib.GetHandlerID(requestID, [objID2], fname, 'success');
                serverLib.Unregister(requestID, handlerID, fname, [objID2], 'success');
                var objID = '';
                var retEventTypes = [];
                try {
                    assert(functionType(args[args.length - 1]) == 1);
                } catch (err) {
                    throw err;
                }
                return args[args.length - 1](...[requestID, handlerID, retEventTypes, objID2].concat(
                    funcArgs
                ));
            }
            var newArgs = setArgs(
                args.slice(0, args.length - 1).map(x => serverLib.getValueOf(x))
                .concat([myFunction])
            );
            try {
                res = thisArgNotNull ? thisArg[method](...newArgs) : fn(...newArgs);
            } catch (err) {
                throw err;
            }
            return res;
        case 17: //non deterministic call to node core with callback: Combine cases 16 and 15
            assert(
                fn != Reflect.apply &&
                fn != Function.prototype.call &&
                fn != Function.prototype.apply
            );
            if (!(args[args.length - 1] instanceof Function)) {
                var res = isNew ? new fn(...args) : fn(...args);
                if (reportCollectionActivated(requestID))
                    serverLib.recordNonDetOp(requestID, handlerID, res);
                return res;
            }
            var objID = createObjectID(requestID, handlerID, false, assignObjectID);
            serverLib.Register(requestID, handlerID, fn.name, [objID], 'success');
            serverLib.EmitAll(requestID, handlerID, [objID], 'success');
            var rid = requestID;
            var hid = handlerID;
            var objID2 = objID;
            var retEventTypes2 = [objID];
            var myFunction = function(...funcArgs) {
                var requestID = rid;
                var handlerID = serverLib.GetHandlerID(requestID, [objID2], fn.name, 'success');
                var objID = '';
                var retEventTypes = [];
                var fType = functionType(args[args.length - 1]);
                try {
                    assert(fType == 1 || fType == 100);
                } catch (err) {
                    console.log('ERROR', err);
                    process.exit();
                }
                if (reportCollectionActivated(requestID)) {
                    serverLib.recordNonDetOp(requestID, handlerID, args);
                }
                if (fType == 1) {
                    return args[args.length - 1](
                        ...[requestID, handlerID, objID, retEventTypes].concat(funcArgs)
                    );
                } else {
                    return args[args.length - 1](...funcArgs);
                }
            }
            return fn(
                ...args.slice(0, args.length - 1).map(serverLib.getValueOf).concat([myFunction])
            );
        case 18: //Array iterator
            // If there is no callback just make the call
            if (args[0] == undefined) {
                assert(
                    fn != Reflect.apply &&
                    fn != Function.prototype.call &&
                    fn != Function.prototype.apply
                );
                return thisArgNotNull ?
                    thisArg[method](...args.map(serverLib.getValueOf)) :
                    fn(...args.map(serverLib.getValueOf));
            }
            // Wrap the callback to retrieve the context
            var myFunc = function(...funcArgs) {
                var fType = functionType(args[0], funcArgs);
                try {
                    assert(fType == 1 || fType == 100);
                } catch (err) {
                    console.log('ERROR', err);
                    process.exit();
                }
                if (fType == 1) {
                    if (args[1] != undefined) {
                        var res = args[0].apply(
                            this,
                            [requestID, handlerID, retEventTypes, ''].concat(funcArgs)
                        )
                    } else {
                        var res = args[0](
                            ...[requestID, handlerID, retEventTypes, ''].concat(funcArgs)
                        );
                    }
                } else {
                    var res = args[0](...funcArgs);
                }
                return serverLib.getValueOf(res)
            }
            var newArgs = setArgs([myFunc].concat(args.slice(1)));
            return thisArgNotNull ? thisArg[method](...newArgs) : fn(...newArgs);
        case 19: //deterministic call to node core that returns a promise
            // Wrap the result and emit an event. If the promise fails later, we change the entry
            // in the logs
            assert(
                fn != Reflect.apply &&
                fn != Function.prototype.call &&
                fn != Function.prototype.apply
            );
            var res = serverLib.createPromiseObject(requestID, handlerID);
            serverLib.EmitAll(requestID, handlerID, res.retEventTypes, 'success');
            res.karContents = fn(...args.map(serverLib.getValueOf)).catch(err => {
                eventsFailed(requestID, res.retEventTypes);
                throw err;
            });
            serverLib.setThen(res);
            return res;
        case 20: //non deterministic call to node core that returns a promise: similar to 19
            assert(
                fn != Reflect.apply &&
                fn != Function.prototype.call &&
                fn != Function.prototype.apply
            );
            var res = serverLib.createPromiseObject(requestID, handlerID);
            res.karContents = fn(...args.map(serverLib.getValueOf)).then(() => {
                serverLib.EmitAll(requestID, handlerID, res.retEventTypes, 'success');
                serverLib.recordNonDetOp(requestID, handlerID, arg);
                return arguments;
            }).catch(() => {
                serverLib.recordNonDetOp(requestID, handlerID, err);
                serverLib.EmitAll(requestID, handlerID, res.retEventTypes, 'fail');
                throw arguments;
            });
            serverLib.setThen(res);
            return res;
        case 21: //Events add listener
            assert(fn != Reflect.apply && fn != Function.prototype.apply);
            var isAddListenerOnce = builtins.registerOnceFns.has(toTest);
            try {
                serverLib.assignObjectID(args[1], requestID, handlerID, false);
            } catch (err) {
                console.log(err);
                process.exit();
            }
            var fname = args[1].objID ? args[1].objID.toString() : "";
            var events = [fname + ":" + args[0]];
            var rid = requestID,
                hid = handlerID;
            serverLib.Register(rid, hid, fname, events, 'success');
            var myFunctionObjectID = createObjectID(requestID, handlerID, false, assignObjectID);
            var myFunction = function(...funcArgs) {
                debug('function called eventEmitter', args, rid)
                var requestID = rid;
                if (
                    builtins.isInternalEvent(toTest, thisArg, getArgs()[0]) &&
                    (!funcArgs[0] || funcArgs[0].karRid == undefined)
                ) {
                    if (args[0] == 'connection') {
                        requestID = -2;
                    }
                    // if not emitted by us
                    // this is treated as a new objectID
                    // create a new handlerID that was triggered by internal event
                    handlerID = new commonClasses.handlerID(
                        newEventForObject(requestID, myFunctionObjectID).toString(),
                        newEventForObject(requestID, myFunctionObjectID)
                    );
                    initNewHandler(requestID, handlerID, hid);
                } else {
                    requestID = funcArgs[0].karRid;
                    funcArgs = funcArgs.slice(1);
                    var handlerID = serverLib.GetHandlerID(requestID, events, fname, 'success');
                }
                var retEventTypes = [];
                var objID = '';
                let fnType = functionType(getArgs()[1]);
                if (fnType == 100) {
                    return getArgs()[1](...funcArgs)
                }
                try {
                    assert(fnType == 1);
                } catch (err) {
                    console.log(getArgs()[1].toString())
                    console.log('ERROR', err, getArgs()[1]);
                    process.exit();
                }
                let isArrowFunction = (fn) => {
                    return fn.toString() != undefined && fn.toString().includes('=>')
                }
                var res =
                    isArrowFunction(getArgs()[1]) ?
                    getArgs()[1](requestID, handlerID, retEventTypes, objID, ...funcArgs) :
                    getArgs()[1].call(this, requestID, handlerID, retEventTypes, objID, ...funcArgs);
                if (isAddListenerOnce) {
                    serverLib.Unregister(requestID, handlerID, fname, events, 'success');
                }
                return res;
            }
            //assign the same objectID to my function and args[1].objID
            assignProperty(myFunction, 'objID', args[1].objID, requestID, handlerID);
            var newArgs = setArgs([serverLib.getValueOf(args[0]), myFunction]);
            if (fn != Reflect.apply && fn != Function.prototype.call && fn != Function.prototype.apply) {
                var r = thisArgNotNull ? thisArg[method](...newArgs) : fn(...newArgs);
            } else {
                var r = toTest.call(...newArgs);
            }
            return r;
        case 22: //events remove listener
            assert(
                fn != Reflect.apply &&
                fn != Function.prototype.call &&
                fn != Function.prototype.apply
            );
            var eventName = getEmitterEvents(thisArg, requestID, handlerID, args[0]);
            //Jeffery: console.log(builtins);
            if (builtins.unregisterFns.has(fn)) {
                serverLib.UnregisterAll(requestID, handlerID, eventName, 'success');
                return thisArg[method](...args);
            }
            assert(args[1].objID != undefined);
            serverLib.Unregister(requestID, handlerID, args[1].objID, eventName, 'success');
            var listener = getListeners(thisArg, args[0], args[1].objID);
            return thisArgNotNull ?
                thisArg[method](serverLib.getValueOf(args[0]), listener) :
                fn(serverLib.getValueOf(args[0]), listener);
        case 23: //eventEmitter.emit
            assert(
                fn != Reflect.apply &&
                fn != Function.prototype.call &&
                fn != Function.prototype.apply
            );
            serverLib.assignObjectID(getThis(), requestID, handlerID, true);
            var eventNames = getEmitterEvents(
                thisArg,
                requestID,
                handlerID,
                serverLib.getValueOf(args[0])
            );
            var myArgs = [{
                'karRid': requestID
            }].concat(args.slice(1));
            serverLib.EmitAll(requestID, handlerID, eventNames, 'success');
            assert(thisArgNotNull == true);
            return thisArg.myEmit(...([serverLib.getValueOf(args[0])].concat(myArgs)));
        case 24: //check events. We are putting this is the handler logs
            assert(
                fn != Reflect.apply &&
                fn != Function.prototype.call &&
                fn != Function.prototype.apply
            );
            serverLib.assignObjectID(getThis(), requestID, handlerID, false);
            serverLib.recordCheckOp(requestID, handlerID, thisArg, fn.name, args);
            return thisArgNotNull ?
                thisArg[method](...args.map(serverLib.getValueOf)) :
                fn(...args.map(serverLib.getValueOf));
        case 25: //events once
            assert(
                fn != Reflect.apply &&
                fn != Function.prototype.call &&
                fn != Function.prototype.apply
            );
            var eventNames = getEmitterEvents(thisArg, requestID, handlerID, args[0]);
            var rid = requestID,
                hid = handlerID;
            var res = serverLib.buildPromiseObject(requestID, handlerID);
            res.karContents = fn(...args.map(serverLib.getValueOf)).then((a) => {
                if (builtins.isInternalEvent(args[0], args[1])) {
                    serverLib.EmitAll(rid, hid, eventNames, 'success');
                }
                return a;
            });
            serverLib.SetReturnEventTypes(requestID, eventNames, res.retEventTypes, 'true');
            return res;
        case 26: //is the resolve/reject function
            assert(
                fn != Reflect.apply &&
                fn != Function.prototype.call &&
                fn != Function.prototype.apply
            );
            return callTheResolveOrRejectFunction(requestID, handlerID, fn, args[0]);
        case 27: //schedule timer
            var timerObjID = createObjectID(requestID, handlerID, false, assignObjectID);
            if (toTest != setInterval) {
                serverLib.Register(
                    requestID,
                    handlerID,
                    timerObjID,
                    [timerObjID.toString()],
                    'success'
                );
                serverLib.EmitAll(requestID, handlerID, [timerObjID.toString()], 'success');
            }
            var rid = requestID;
            var hid = handlerID;
            var myFunction = function(requestID, handlerID, retEventTypes, objID, ...funcArgs) {
                if (toTest != setInterval) {
                    handlerID = serverLib.GetHandlerID(
                        requestID,
                        [timerObjID.toString()],
                        timerObjID,
                        'success'
                    );
                } else {
                    handlerID = new commonClasses.handlerID(
                        newEventForObject(requestID, timerObjID),
                        newEventForObject(requestID, timerObjID)
                    );
                    initNewHandler(requestID, handlerID, hid);
                    if (reportCollectionActivated(requestID)) {
                        accessDetector.newHandlerID(requestID, handlerID, hid);
                        if (process.env.COLLECT_OROCHI_JS_ADVICE == "true") {
                            accessDetectorOrochiJs.newHandlerID(requestID, handlerID, hid);
                        }
                    }
                }
                try {
                    let fType = functionType(args[0]);
                    assert(fType == 1 || fType == 26);
                } catch (err) {
                    console.log('ERROR', err);
                    process.exit();
                }
                if (functionType(args[0]) == 26) {
                    return callTheResolveOrRejectFunction(requestID, handlerID, args[0], funcArgs[0]);
                }
                return args[0].apply(
                    this,
                    [requestID, handlerID, retEventTypes, objID].concat(funcArgs)
                );
            }
            var newArgs = setArgs([myFunction, requestID, handlerID, [], ''].concat(
                getArgs().slice(1)
            ));
            if (builtins.scheduleTimerNoDelayFns.has(toTest)) {
                var newArgs = setArgs(
                    [myFunction, requestID, handlerID, [], '']
                    .concat(args.slice(1))
                );
            } else {
                var newArgs = setArgs(
                    [myFunction, serverLib.getValueOf(args[1]), requestID, handlerID, [], '']
                    .concat(args.slice(2))
                );
            }
            var res = thisArgNotNull ? thisArg[method](...newArgs) : fn(...newArgs);
            if (res) res.objID = timerObjID;
            //don't allow anyone to setInterval and do not allow the initialization to set setTimeout
            if (toTest == setInterval) {
                clearInterval(res);
            }
            if (toTest == setTimeout && !reportCollectionActivated(requestID)) {
                clearTimeout(res);
            }
            return res;
        case 28: //String.replace with function
            var rid = requestID,
                hid = handlerID;
            var myFunc = function(...funcArgs) {
                try {
                    assert(functionType(args[args.length - 1]) == 1);
                } catch (err) {
                    console.log('ERROR', err);
                    process.exit();
                }
                return args[args.length - 1](...[rid, hid, [], ''].concat(funcArgs));
            }
            var newArgs = setArgs(
                args.slice(0, args.length - 1).map(serverLib.getValueOf)
                .concat([myFunc])
            );
            return fn.apply(thisArg, newArgs);
        case 29: //clear timer
            assert(args[0] == undefined || args[0].objID);
            if (args[0] != undefined) {
                serverLib.Unregister(
                    requestID,
                    handlerID,
                    args[0].objID,
                    [args[0].objID.toString()],
                    'success'
                );
            }
            return thisArgNotNull ?
                thisArg[method](...initArgs.map(x => serverLib.getValueOf(x))) :
                fn(...initArgs.map(x => serverLib.getValueOf(x)));
        case 30: //Object.keys (don't return the objID)
            var data = Object.assign({}, args[0]);
            if (!(args[0] instanceof EventEmitter)) {
                delete data.objID;
                delete data.requestID;
            }
            return Object.keys(data).filter(k => serverLib.getValueOf(data[k]) != undefined);
        case 31: //Require
            return fn(serverLib.handleRequire(...initArgs))
        case 32: //util.debugLog
            var ret = fn(...initArgs);
            defineProperty(ret, 'isDebugLog', true);
            return ret;
        case 33: //util.promisify
            if ([16, 27].includes(functionType(initArgs[0]))) {
                var ret = fn(...initArgs)
                ret.promisified = true
                return ret
            } else {
                assert(functionType(initArgs[0]) == 1) //ourCall
                //This is the promisify function
                function promisify(original) {
                    // Names to create an object from in case the callback receives multiple
                    // arguments, e.g. ['bytesRead', 'buffer'] for fs.read.
                    return function fn(requestID, handlerID, objID, retEventTypes, ...args) {
                        var prom = serverLib.createPromiseObject(requestID, handlerID);
                        if (args[0] instanceof Object) {
                            global[args[0].promiseName] = prom
                        }
                        prom.karContents = new Promise((resolve, reject) => {
                            if (functionType(original) == 1) {
                                original.call(
                                    this,
                                    requestID,
                                    handlerID,
                                    objID,
                                    retEventTypes,
                                    ...args,
                                    (requestID, handlerID, objID, retEventTypes, err, ...values) => {
                                        if (err) {
                                            serverLib.EmitAll(
                                                requestID,
                                                handlerID,
                                                prom.retEventTypes,
                                                'fail'
                                            )
                                            return reject(err);
                                        }
                                        serverLib.EmitAll(
                                            requestID,
                                            handlerID,
                                            prom.retEventTypes,
                                            'success'
                                        );
                                        resolve(values[0]);
                                    });
                            } else {
                                original.call(this, ...args, (err, ...values) => {
                                    var requestID = prom.requestID;
                                    var handlerID = prom.handlerID;
                                    if (err) {
                                        serverLib.EmitAll(
                                            requestID,
                                            handlerID,
                                            prom.retEventTypes,
                                            'fail'
                                        );
                                        return reject(err);
                                    }
                                    serverLib.EmitAll(
                                        requestID,
                                        handlerID,
                                        prom.retEventTypes,
                                        'success'
                                    );
                                    resolve(values[0]);
                                })
                            }
                        });
                        return prom;
                    }
                }
                return promisify(initArgs[0])
            }
        case 34:
            assert(
                fn != Reflect.apply &&
                fn != Function.prototype.call &&
                fn != Function.prototype.apply
            );
            //Express function should only be called from the server in the beginning
            assert(!reportCollectionActivated(requestID))

            //first find the indexes that need to be modified
            var fnIndexes = builtins.isCallToExpressMethod(fn, args);
            var newArgs = args;
            //it is static with set headers
            if (fnIndexes.length > 0 && fnIndexes[0] == builtins.isStatic) {
                if (args[1].setHeaders.length != 3) {
                    newArgs[1].setHeaders = (req, res, next) => {
                        var requestID = req.headers['x-request-id'];
                        var handlerID = serverLib.newHandlerID(requestID, args[1].setHeaders.name);
                        var retEventTypes = [];
                        var objID = '';
                        return args[1].setHeaders(
                            requestID,
                            handlerID,
                            retEventTypes,
                            objID,
                            err,
                            req,
                            res,
                            next
                        );
                    }
                } else {
                    assert(functionType(args[1].setHeaders) == 100);
                }
                return fn(...newArgs);
            }
            for (let i = 0; i < fnIndexes.length; i++) {
                var index = fnIndexes[i];
                let thisFn = args[index];
                if (thisFn.length == 8) {
                    newArgs[index] = (err, req, res, next) => {
                        var requestID = req.headers['x-request-id'];
                        var handlerID = serverLib.newHandlerID(requestID, thisFn.name);
                        var retEventTypes = [];
                        var objID = '';
                        return thisFn(
                            requestID,
                            handlerID,
                            retEventTypes,
                            objID,
                            err,
                            req,
                            res,
                            next
                        );
                    }
                } else if (thisFn.length == 7) {
                    newArgs[index] = (req, res, next) => {
                        var requestID = req.headers['x-request-id'];
                        var handlerID = serverLib.newHandlerID(requestID, thisFn.name);
                        var retEventTypes = [];
                        var objID = '';
                        return thisFn(requestID, handlerID, retEventTypes, objID, req, res, next);
                    }
                } else if (thisFn.length == 6) {
                    newArgs[index] = (req, res) => {
                        var requestID = req.headers['x-request-id'];
                        var handlerID = serverLib.newHandlerID(requestID, thisFn.name);
                        var retEventTypes = [];
                        var objID = '';
                        thisFn(requestID, handlerID, retEventTypes, objID, req, res);
                        //Save the reports and the measurement
                        res.on('finish', () => {
                            serverLib.saveReportsForRid(requestID, true);
                            Measurements.requestEnds(requestID);
                        })
                    };
                } else {
                    //make sure that it is not our function
                    assert(args[index].length < 4 && functionType(thisFn) == 100)
                }
            }
            return thisArg[method](...newArgs)
        case 35: //it is _implicitHeader
            assert(
                fn != Reflect.apply &&
                fn != Function.prototype.call &&
                fn != Function.prototype.apply
            );
            if (functionType(thisArg.writeHead) == 1) { //our call
                var prev = thisArg.writeHead;
                thisArg.writeHead = function(...funcArgs) {
                    var [requestID, handlerID, retEventTypes, objID] = serverLib.popContext();
                    return prev.call(this, requestID, handlerID, retEventTypes, objID, ...funcArgs)
                }
            }
            return thisArg._implicitHeader(...args.map(serverLib.getValueOf))
        case 100: //native sync call
            if (fn == Object.defineProperties) {
                var prop = Object.assign(initArgs[1]);
                if (!(initArgs[1] instanceof EventEmitter)) {
                    delete prop.objID;
                }
                delete prop.requestID;
                return Object.defineProperties(initArgs[0], prop);
            }
            if (fn == Object.__defineGetter__) {
                assert(
                    fn != Reflect.apply &&
                    fn != Function.prototype.call &&
                    fn != Function.prototype.apply
                );
                myFunc = () => {
                    if (functionType(args[1]) == 1) {
                        var [requestID, handlerID, retEventTypes, objID] = serverLib.popContext();
                        return args[1](requestID, handlerID, retEventTypes, objID);
                    } else {
                        assert(functionType(args[1]) == 100)
                        return args[1]();
                    }
                }
                return thisArg[method](args[0], myFunc);
            }
            if (fn == Object.getOwnPropertyNames) {
                var res = Object.getOwnPropertyNames(...initArgs);
                res.splice('objID');
                res.splice('requestID');
                return res;
            }
            if (fn == Object.getOwnPropertyDescriptors) {
                var res = Object.getOwnPropertyDescriptors(...initArgs);
                delete res.objID;
                delete res.requestID;
                return res;
            }
            if (
                fn == Map.prototype.get ||
                fn == Map.prototype.set ||
                fn == Map.prototype.has ||
                fn == Array.prototype.includes ||
                fn == Array.prototype.slice ||
                fn == Array.prototype.push
            ) {
                thisArg = serverLib.assignObjectID(thisArgOriginal, requestID, handlerID, true)
            }
            let result = isNew ?
                new fn(...initArgs) :
                (
                    thisArgNotNull ?
                    serverLib.getValueOf(thisArg)[method](...initArgs) :
                    fn(...initArgs)
                );
            if (fn == Array.prototype.push || fn == Map.prototype.set) {
                serverLib.assignObjectID(thisArgOriginal, requestID, handlerID, false)
            }
            // If we are creating a new object, remove any object ids in the new object
            // that are inheritted from the prototype. We don't need to do this when the
            // prototype is a Node.js native prototype such as Buffer's prototype.
            if (fn == Object.create && initArgs[0] != Buffer.Buffer.prototype) {
                for (var prop in result) {
                    if (hasOwnProperty(result[prop], 'objID')) {
                        delete result[prop].objID
                    }
                }
            }
            if (hasOwnProperty(result, 'objID'))
                result = serverLib.assignObjectID(result, requestID, handlerID, false);
            setObjIDsAppropriately(requestID, handlerID, fn, thisArg, initArgs, this.assignObjectID);
            if (obj instanceof Promise && !obj.karContents && retEventTypes.length == 0) {
                var prom = serverLib.createPromiseObject(requestID, handlerID);
                prom.karContents = result;
                serverLib.setThen(prom);
                serverLib.EmitAll(requestID, handlerID, prom.retEventTypes, 'success');
                return prom;
            }
            return result
    }
}

// Emits the event the resolve/reject event associated with the promise and calls the function
function callTheResolveOrRejectFunction(requestID, handlerID, fn, arg) {
    if (fn.resolveEvent) {
        serverLib.EmitAll(requestID, handlerID, fn.resolveEvent, 'success');
    } else {
        serverLib.EmitAll(requestID, handlerID, fn.rejectEvent, 'fail');
    }
    return fn(arg && arg.karContents ? arg.karContents : arg);
}

// Wrapper to accessDetector.accessObject that makes sure that the current rid and hid
// are not modified
function accessObject_safe(rid, hid, objID, value, isRead, doubleValue) {
    let info = serverLib.popContext();
    serverLib.pushContext(-2, globalHandler, [], "");
    var opnum = opcounts.get(rid).get(hid.toString());
    opcounts.get(rid).set(hid.toString(), opnum + 1);
    accessDetector.accessObject(rid, hid, opnum, objID, value, isRead, doubleValue);
    if (process.env.COLLECT_OROCHI_JS_ADVICE == "true") {
        accessDetectorOrochiJs.accessObject(rid, hid, opnum, objID, value, isRead, doubleValue);
    }
    serverLib.pushContext(info[0], info[1], info[2], info[3])
}

// Computes a hash of the input string
function hashCode(str) {
    var hash = 0;
    for (var i = 0; i < str.length; i++) {
        var character = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + character;
        hash = hash & hash; // Convert to 32bit integer
    }
    return hash % Number.MAX_SAFE_INTEGER;
}