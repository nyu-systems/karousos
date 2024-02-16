"use strict";

/**********************************************/
/*******************Requires*******************/
/**********************************************/
const {
    Graph
} = require('./src/graph');
const debug = require('debug')('verifier-lib');
const assert = require('assert');
const asyncHooks = require('async_hooks');
const fs = require('fs');
const Buffer = require('buffer');

const {
    transformFunction
} = require(process.env.KAR_HOME + '/src/compiler/compile_functions');
const origCwd = require('process').cwd;
const {
    PrimitiveWrapper,
    Multivalue,
    areMultivalues,
    isMultivalue,
    createMultivalue,
    executeCall,
    getIthElementInMultivalue,
    getValueOf,
} = require('./src/wrappers');
const EventEmitter = require('events');
const {
    ConcurrentAccessDetector
} = require('./concurrent-access-detector');
const crypto = require('crypto');
const {
    isEqual,
    cloneDeep
} = require('lodash');
const Measurements = require(process.env.KAR_HOME + '/src/measurements');
const {
    loadIgnoredReqs,
    loadReports,
    preprocess,
    isolationLvl
} = require("./src/cov");
const jsonParse = require('json-cycle').parse;
const {
    isUndefined,
    my_merge,
} = require('./src/utils');
const {
    initSeenFns,
    markTheResRejFunctions,
    functionType,
    getSuperFunctionType,
    getSuperMethodFunctionType,
    builtins,
    commonClasses,
    reportCollectionActivated,
    reportCollectionDeactivated,
    createAwaitRetEvtType,
    flushDataOnEvents,
    flushObjNums,
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
    defineProperty,
    assignProperty,
    hasOwnProperty,
    getHandlerIDforObjectID,
    setHandlerIDforObjectID,
    initGeneratorHelpers,
    deleteGeneratorHelpers,
    initPromiseMethodsForRid,
    deletePromiseMethodsForRid,
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
} = require(process.env.KAR_HOME + "/src/karousos_utils");
const isPrimitiveType = builtins.isPrimitiveType;
const commonDetSyncCallToJsBuiltIn = builtins.commonDetSyncCallToJsBuiltIn
const isOfType = builtins.isOfType;
const globalHandler = commonClasses.globalHandler;
var globH = require('./src/globalHandlers');
// save this module as the serverLib
var verifierLib = this;

// Whether we need to collect measurements on the size of the state (variable) logs
const record_statelog_size = parseInt(process.env.ONLY_STATE_LOG || 0);

/**********************************************/
/**Export the functions that are the same in **/
/********* prover, verifier********************/
/**********************************************/
exports.newFunction = newFunction;
exports.markTheResRejFunctions = markTheResRejFunctions;
exports.getSuperFunctionType = getSuperFunctionType;
exports.getSuperMethodFunctionType = getSuperMethodFunctionType;
exports.functionType = functionType;
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
exports.reportCollectionActivated = reportCollectionActivated;
exports.getHandlerIDforObjectID = getHandlerIDforObjectID;
exports.setHandlerIDforObjectID = function(rid, hid, obj) {
    return setHandlerIDforObjectID(rid, hid, obj, this.assignObjectID)
}
exports.exportContents = exportContents;
// Wrap find length. In case the input is mutltivalue, it returns a multivalue
exports.findLength = function(obj) {
    if (obj instanceof Multivalue || obj.karousos_value) {
        let lens = obj.karousos_value.map(x => findLength(x));
        return createMultivalue(lens);
    }
    return findLength(obj);
}
exports.getRequestID = getRequestID;
exports.maybeReturnPromise = function(requestID, handlerID, retEventTypes, arg, success) {
    try {
        return maybeReturnPromise(
            requestID,
            handlerID,
            retEventTypes,
            arg,
            success,
            verifierLib.SetReturnEventTypes,
            verifierLib.EmitAll
        )
    } catch (err) {
        console.log(err);
        throw err
    }
}

/*********************************************************/
/*** Export items defined in other files in verifier-lib */
/*********************************************************/
exports.Multivalue = Multivalue;
exports.createMultivalue = createMultivalue;
exports.isolationLvl = isolationLvl;
exports.isUndefined = isUndefined;

/**********************************************/
/**************Global Declarations*************/
/**********************************************/

//Events that have been emitted so far
var emittedEvents = new Map();
// Map from rid to map from events to their dependent events
// and who will emit them
var dependentEvents = new Map();
dependentEvents.set(-1, new Map());
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
// Running counter of operations that happen during init
var globalOpcounts = new Map();
// mapping from tag id to control flow tag that server sent
var cftIDs = [];
//map from control flow ids to the requestIDs that belong in the group
var cfg = new Map();
// The advice
var reports;
// The number of non deterministic ops that init does
var globalNonDetOpCounter = 0;
// Graph used for consistent ordering verification
var graph = new Graph();
// Running counter of operations that each transaction has issued
var txcounts = new Map();
// The one defined in the main paper
var OpMap = new Map();
// Map from rid to map from handlerName to map from event types to
// events that presumably activate this handler
var activatedHandlers = new Map();
// number of total ops issued so far per rid per hid
var opcounts = new Map();
// opcounts for init are used to identify its registered handlers
opcounts.set(-1, new Map());
opcounts.set(-2, new Map());
// during consistent ordering verification save result of handler checkops in this map
var checkEventsRes = new Map();
// Map from each request id to the response in the trace
var ridToResponse = new Map();

//Save the prototypes for functions to use them in callFunction
var generatorFuncProto = Object.getPrototypeOf(function*() {});
var asyncFuncProto = Object.getPrototypeOf(async function() {});

// Initialize the types of awaits for the initialization procedure and the Deactivated code
initAwaitRetEvtType(-1);
initAwaitRetEvtType(-2);

// Initialize the global and deactivated handlers:
var accessDetector = new ConcurrentAccessDetector(graph);
accessDetector.newRid(-1);
accessDetector.newRid(-2);

// Initialize the global and deactivated handlers
initNewHandler(-1, globalHandler);
initNewHandler(-2, globalHandler);

// initialize all state of the verifier-lib
exports.initialize = function() {
    globH.initialize();
    initEventsForObject(-1);
    initEventsForObject(-2);
    initSeenFns();
    initPromiseMethodsForRid(-1);
    initGeneratorHelpers(-1)
    emittedEvents = new Map();
    dependentEvents = new Map();
    dependentEvents.set(-1, new Map());
    all = new Map();
    all.set(-1, new Map());
    race = new Map();
    race.set(-1, new Map());
    curHandler = new Map();
    verifierLib = this;
    globalOpcounts = new Map();
    cftIDs = []; //mapping from id to control flow tag that server sent
    cfg = new Map(); //map from control flow ids to the requestIDs that belong in the group
    reports = {
        'hls': {},
        'txls': {},
        'opcounts': {},
        'responseEmittedBy': {},
    }; //the reports
    graph = new Graph(); //Graph used for consistent ordering verification
    txcounts = new Map();
    activatedHandlers = new Map();
    opcounts = new Map(); //number of total ops issued so far per rid per hid, index in logs
    opcounts.set(-1, new Map());
    opcounts.set(-2, new Map());
    checkEventsRes = new Map();
    ridToResponse = new Map();
    initAwaitRetEvtType(-1);
    initAwaitRetEvtType(-2);
    accessDetector = new ConcurrentAccessDetector(graph);
    accessDetector.newRid(-1);
    accessDetector.newRid(-2);
    initNewHandler(-1, globalHandler);
    initNewHandler(-2, globalHandler);
}

// Read in the advice and the trace. Initialize reports, ridToResponse,
// accessDetector, cfg and cftID. Returns map from control flow ids
// to the requests and their data
exports.loadReports = async function(traceFile, reportsDir, inOrder) {
    try {
        var res = await loadReports(
            traceFile,
            reportsDir,
            inOrder,
            ridToResponse,
            reports,
            accessDetector,
            cfg,
            cftIDs
        );
        Measurements.saveGroups(res.cfg);
    } catch (err) {
        console.log(err);
    }
    return res;
}

// Run the preprocessing function, and initialize the graph in accessDetector
exports.preprocess = function(isolationLvl, writeLogFile) {
    graph = preprocess(isolationLvl, writeLogFile, reports, OpMap, activatedHandlers, cfg);
    accessDetector.setGraph(graph);
}

// Wrapper for getValueOf that maintains the context(request id, handler id, retEventTypes, objID)
exports.getValueOf = function(obj, full) {
    let prev = verifierLib.popContext();
    verifierLib.pushContext(-2, globalHandler, [], "")
    var ret = getValueOf(obj, full);
    verifierLib.pushContext(prev[0], prev[1], prev[2], prev[3]);
    return ret;
}

// Check that the cftID, hid, and current opnum corresponds to the last operation
// prior to emitting the response according to the advice
exports.saveResponseEmittedBy = function(cftID, hid) {
    cftID = cftID.karousos_x ? cftID.karousos_x : cftID;
    var responseEmittedBy = JSON.stringify({
        "hid": hid.toString(),
        "opnum": opcounts.get(cftID).get(hid.toString())
    });
    applyToAllRidsInGroup(cftID, (rid) => {
        assert(JSON.stringify(reports.responseEmittedBy[rid]) == responseEmittedBy);
    })
}

// Tries to assign new_object to old_object taking care or any wrappers that karousos introduces
// and returns the new new_object
function sync(
    old_obj,
    new_obj,
    isObject,
    isArray,
    cftID,
    hid,
    isSaveMemberInVariable,
    object,
    property,
) {
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
            res[property] = sync(old_obj[property], new_obj[i], false, false);
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
    // Modify the old object by assigning to it the value of the new object. Take care or multivalues,
    // primitives, and their wrappers
    let prev_objID = old_obj.objID;
    let prev_isLoggable = old_obj.isLoggable;
    if (
        typeof new_obj == "string" &&
        new_obj.includes("karousos_value") &&
        new_obj.includes("isPrimitive") &&
        new_obj.includes("collapsed")
    ) {
        // The following case is for when we send a json multivalue in the request's fields
        // It is a special-case hack
        let objParsed = JSON.parse(new_obj);
        var res = [];
        for (let i = 0; i < objParsed.length; i++) {
            let val = objParsed.karousos_value[i];
            res.push(JSON.stringify(val))
        }
        old_obj = new Multivalue(res);
    } else if (new_obj instanceof PrimitiveWrapper) {
        old_obj = new PrimitiveWrapper(new_obj.karousos_x);
    } else if (isPrimitiveType(new_obj)) {
        old_obj = new PrimitiveWrapper(new_obj);
    } else if (new_obj instanceof Multivalue && new_obj.isPrimitive) {
        old_obj = new Multivalue(new_obj.karousos_value);
    } else {
        old_obj = new_obj;
    }
    // If it is a property of an object, assign the new value at the property of the object
    if (object != undefined) {
        object[property] = old_obj;
    }
    // Make sure that the object id of the object we are returning is the one of old object
    if (old_obj.objID != prev_objID && old_obj != Object.prototype) {
        assignProperty(old_obj, 'objID', prev_objID, cftID, hid);
    }
    // Mark the returned object as loggable if the original object was loggable
    defineProperty(old_obj, 'isLoggable', prev_isLoggable);
    return old_obj;
}

exports.sync = sync;

// This is called when a group finishes executing; it checks that the advice match re-execution
// and flushes the state used for this group
exports.requestEnds = function(cftGroup, cftID) {
    // First check that we have activated all handlers and that
    // opcounts (number of operations issued) match the ones in the reports.
    cftID = cftID.karousos_x ? cftID.karousos_x : cftID;
    try {
        var rid;
        activatedHandlers.get(parseInt(cftID)).forEach((fnameMap, fname) => {
            fnameMap.forEach((evtArray, evt) => {
                assert(evtArray.length == 0);
            })
        })

        for (rid of cftGroup) {
            let hids = Object.keys(reports.opcounts[rid]);
            hids.forEach(hid => {
                assert(reports.opcounts[rid][hid] == opcounts.get(cftID).get(hid));
            })

            // Check that the server did not send any logs for handlers that were not re-executed
            for (let [k, v] of opcounts.get(cftID)) {
                if (reports.opcounts[rid][k] == undefined) {
                    assert(v == 0);
                }
            }
            // Delete internal state for requests
            delete reports.txls[rid];
            delete reports.opcounts[rid];
            delete reports.responseEmittedBy[rid];
        }
        //Now delete any internal state that is not needed anymore
        flushDataOnEvents(cftID);
        dependentEvents.delete(cftID);
        all.delete(cftID);
        race.delete(cftID);
        deleteGeneratorHelpers(cftID);
        deletePromiseMethodsForRid(cftID);
        flushObjNums(cftID);
        opcounts.delete(cftID);
        txcounts.delete(cft);
        OpMap.delete(parseInt(cftID))
    } catch (err) {
        console.log(err);
        process.exit()
    }
}

// Do nothing
exports.updateTag = function(cftID, hid, op) {
    return;
}

// Called whenever an access may be r-concurrent.
// It assigns an object id to the object and then calls the concurrent access detector
function recordAccess(obj, cftID, hid, isRead, isNewObject, parentObject, method) {
    cftID = cftID.karousos_x ? cftID.karousos_x : cftID;
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
    // The obj is a primitive wrapper or a multivalue.
    // We need to wrap it and assign a new object id to it
    if (
        isNewObject &&
        (
            obj instanceof PrimitiveWrapper ||
            (obj != undefined && obj.hasOwnProperty && obj.hasOwnProperty("karousos_x")) ||
            (obj instanceof Multivalue && obj.isPrimitive)
        )
    ) {
        if (obj instanceof Multivalue && obj.isPrimitive) {
            obj = createMultivalue(obj.karousos_value);
        } else {
            obj = new PrimitiveWrapper(obj.karousos_x);
        }
    }
    // If it is a primitive, wrap it and assign an object id to it
    if (isPrimitiveType(obj)) {
        obj = new PrimitiveWrapper(obj);
    }
    //Do Not assign objID to global object.prototype lodash tries to do this...
    if (obj == Object.prototype || obj == Array.prototype || obj == Function.prototype) {
        return obj;
    }
    // We cannot assign object ids to non extensible objects
    if ((obj instanceof Object || typeof obj === 'object') && !Object.isExtensible(obj)) {
        return obj;
    }
    //Do not change the poolsize of buffer because it is used internally
    if (method == 'poolSize' && parentObject == require('buffer')) {
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
        reportCollectionActivated(cftID)
    ) {
        var objID = createObjectID(cftID, hid, isRead, recordAccess, parentObject, method);
        addReference_safe(cftID, hid, obj, objID, isRead);
        return obj;
    }
    // Assign an object id to the object if it does not have one. Also, assign a request id
    if (!hasOwnProperty(obj, 'objID')) {
        // Copy the mutlivalue to a new object if it is a primitive
        if (obj instanceof Multivalue && obj.isPrimitive) {
            obj = new Multivalue(obj.karousos_value);
        }
        var objID = createObjectID(cftID, hid, isRead, recordAccess, parentObject, method);
        defineProperty(obj, 'objID', objID, cftID, hid);
        defineProperty(obj, 'requestID', cftID);
        // Because obj does not have an object id, we deduce that this is the first access to the
        // object
        isRead = false;
    }
    //now record the access
    defineProperty(obj, 'isLoggable', true);
    var obj2 = accessObject_safe(cftID, hid, obj.objID, obj, isRead, false);
    return obj2;
}

exports.recordAccess = recordAccess;

// Assign a new object id to obj
function assignObjectID(obj, cftID, hid, isRead, isNewObject, parentObject, method) {
    cftID = cftID.karousos_x ? cftID.karousos_x : cftID;
    // Only assign object ids to functions, errors, and promises
    if (obj && !(obj instanceof Function) && !(obj instanceof Error) && !(obj instanceof Promise) && !(obj.isLoggable)) {
        return obj;
    }
    // Do not assign ids to primitives
    if (isPrimitiveType(obj)) {
        return obj;
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
    if (obj == Object.prototype || obj == Array.prototype || obj == Function.prototype) {
        return obj;
    }
    // We cannot assign object ids to non extensible objects
    if ((obj instanceof Object || typeof obj === 'object') && !Object.isExtensible(obj)) {
        return obj;
    }
    // Do not change the poolsize of buffer because it is used internally
    if (method == 'poolSize' && parentObject == require('buffer')) {
        return obj
    }
    // Assign an object id to the object if it does not have one. Also, assign a request id
    if (!hasOwnProperty(obj, 'objID')) {
        // Create a new object if the object is an instance of a multivalue
        if (obj instanceof Multivalue && obj.isPrimitive) {
            obj = new Multivalue(obj.karousos_value);
        }
        var objID = createObjectID(cftID, hid, isRead, assignObjectID, parentObject, method);
        defineProperty(obj, 'objID', objID, cftID, hid);
        defineProperty(obj, 'requestID', cftID);
    }
    if (obj.isLoggable) {
        var obj2 = accessObject_safe(cftID, hid, obj.objID, obj, isRead, false);
        return obj2;
    }
    return obj;
}

exports.assignObjectID = assignObjectID;

// Initialize the structures for a new group of requests
// and read its variable logs
exports.newRequestID = function(cftID, reqHandler) {
    cftID = cftID.karousos_x ? cftID.karousos_x : cftID;
    try {
        var cft = getCFT(cftID);
        initAwaitRetEvtType(cftID);
        initEventsForObject(cftID);
        dependentEvents.set(cftID, new Map());
        all.set(cftID, new Map());
        race.set(cftID, new Map());
        initGeneratorHelpers(cftID);
        initPromiseMethodsForRid(cftID);
        initObjNumForRid(cftID);
        opcounts.set(cftID, new Map());
        txcounts.set(cftID, new Map());
        let hid = new commonClasses.handlerID(reqHandler, '');
        accessDetector.newRid(cftID);
        applyToAllRidsInGroup(cftID, (rid) => {
            var objOlsFile = process.env.ADVICE_DIR + process.env.OBJECT_OLS_LOC + "/" + rid.toString() + ".json";
            if (fs.existsSync(objOlsFile)) {
                var contents = fs.readFileSync(objOlsFile, 'utf-8');
                if (record_statelog_size) {
                    Measurements.add_to_statelog(contents);
                }
                Measurements.add_to_advice(contents);
                var lines = contents.split("//////");
                var objectOls = new Map();
                for (let line of lines) {
                    if (line == "") continue;
                    var [obj, accesses] = line.split("////");
                    var accesses = accesses.split("//");
                    if (!objectOls.has(obj)) {
                        objectOls.set(obj, new Map());
                    }
                    for (var i = 0; i < accesses.length; i += 2) {
                        var k = accesses[i];
                        var v = accesses[i + 1];
                        objectOls.get(obj).set(k, jsonParse(v))
                    }
                }
                accessDetector.setObjectOls(objectOls);
            }
        });
        initNewHandler(cftID, hid);
        initNewHandler(cftID, globalHandler);
        return hid;
    } catch (err) {
        console.log(err);
        process.exit();
    }
}

// Initializes a new handler id
exports.newHandlerID = function(cftID, handlerName) {
    cftID = cftID.karousos_x ? cftID.karousos_x : cftID;
    // Check if the group has been initialized. If not, initialize it
    if (!opcounts.has(cftID)) {
        return verifierLib.newRequestID(cftID, handlerName);
    }
    var [cftIDpoped, hidPoped, _, _] = this.popContext();
    if (cftIDpoped == cftID) {
        return hidPoped;
    }
    var hid = new commonClasses.handlerID(handlerName, '');
    if (opcounts.get(cftID).has(hid.toString())) {
        hid = new commonClasses.handlerID(handlerName + '2', '');
    }
    initNewHandler(cftID, hid);
    return hid;
}

// Initializes structures for a new handler
function initNewHandler(cftID, hid, invokedBy) {
    cftID = cftID.karousos_x ? cftID.karousos_x : cftID;
    try {
        accessDetector.newHandlerID(cftID, hid, invokedBy);
        if (reportCollectionDeactivated(cftID)) return;
        opcounts.get(cftID).set(hid.toString(), 0);
        var cft = getCFT(cftID);
        initObjNumForHid(cftID, hid);
        setCurrentHandler(cftID, hid);
    } catch (err) {
        console.log(err);
        process.exit();
    }
}

// Sets the promise's rid, hid, and retEventTypes to the input ones
exports.updatePromiseObject = function(promise, cft, hid, retEventTypes) {
    cft = cft.karousos_x ? cft.karousos_x : cft;
    var cft = getCFT(cftID);
    promise.requestID = cft;
    promise.handlerID = hid;
    promise.retEventTypes = retEventTypes;
}

// Records a transaction operation
exports.recordStateOp = function(cftID, hid, optype, opcontents, txId, sql, key, table) {
    try {
        // The key can be an array. Convert it to a multivalue
        if (key instanceof Array) {
            if (key.length == 1) {
                key = key[0];
            } else {
                key = createMultivalue(key);
            }
        }
        // if opcontents is not of the form [keys, values] convert it to this form
        if (optype == "write" && !(opcontents instanceof Array)) {
            var keys = [],
                values = [];
            for (let k in opcontents) {
                if (k != 'objID') {
                    keys.push(k);
                    values.push(verifierLib.getValueOf(opcontents[k]))
                }
            }
            keys = keys.concat(['ionRequestID', 'ionTxID', 'ionTxNum']);
            opcontents = [keys, values];
        }

        function computeTxId(hid, opnum) {
            return new commonClasses.TxID(hid, opnum);
        }

        opcontents = getValueOf(opcontents, false, true);
        //HACK for stackTrace
        if (optype == "write" && opcontents[0].includes("id_hash")) {
            key = opcontents[1][opcontents[0].indexOf("id_hash")];
        }

        // Delete the key's object id
        if (key && key.objID) delete key.objID;

        // checks that the produced state operation matches the one in advice
        function checkStateOp(rid, hid, opnum, optype, opcontents, txId, txnum, key) {
            var recOp = reports.txls[rid][txId.toString()][txnum];
            // Only check contents if this is a write
            var recOpContents = getValueOf(recOp.opcontents, false, true);
            if (optype == 'write') {
                assert(isEqual(recOpContents, opcontents));
            }
            let entry = new commonClasses.stateOp(
                optype,
                undefined,
                hid.toString(),
                opnum,
                (key && key.karousos_x) ? key.karousos_x : key
            );
            recOp = new commonClasses.stateOp(
                recOp.optype,
                undefined,
                recOp.hid,
                recOp.opnum,
                recOp.key && recOp.key.karousos_x ? recOp.key.karousos_x : recOp.key
            );
            if (entry.toString() != recOp.toString()) {
                console.log("Error in recorded state operation", entry, recOp);
                process.exit()
            }
            // returns the values that have the same type as in the server's function
            if (optype == "tx_start") {
                return txId;
            } else if (optype == "read") {
                return [Object.assign({}, recOpContents.result)];
            } else if (optype == "write") {
                return ["junk", "junk", 0];
            }
        }
        // Do not check anything if the advice is not activated
        if (!reportCollectionActivated(cftID)) return;
        var cft = getCFT(cftID);
        var idx = opcounts.get(cftID).get(hid.toString());

        //If it is a txStart compute the txId
        if (optype == "tx_start") {
            assert(txId == undefined || txId == null);
            txId = computeTxId(hid, idx);
            txcounts.get(cftID).set(txId.toString(), 0);
        }
        var isOpNotInTx = ["read", "write"].includes(optype) && (txId == undefined || txId == null);

        //If it is a read or write that is not inside a tx
        //compute the txId and check txstart, state op, txcommit operations in the logs.
        if (optype == 'write') {
            //opcontents should be two arrays: one that is the name of the columns and one with the
            //corresponding value
            assert(opcontents.length == 2 && opcontents[0].length == opcontents[1].length + 3);
            var new_opcontents = {};
            for (let i = 0; i < opcontents[1].length; i++) {
                new_opcontents[opcontents[0][i]] = opcontents[1][i]
            }
            opcontents = new_opcontents;
            opcontents.isMultivalue = true;
        }
        var toAppend = [];
        if (isOpNotInTx) {
            opcounts.get(cftID).set(hid.toString(), idx + 3);
            var res = applyToAllRidsInGroup(cftID, function(rid, contents, key) {
                txId = computeTxId(hid, idx);
                //check the txstart
                checkStateOp(rid, hid, idx, "tx_start", undefined, txId, 0);
                //the operation
                var ret = checkStateOp(rid, hid, idx + 1, optype, contents, txId, 1, key);
                //and the commit
                checkStateOp(rid, hid, idx + 2, "tx_commit", undefined, txId, 2);
                return ret;
            }, [opcontents, key]);
        } else {
            // only check the operation
            opcounts.get(cftID).set(hid.toString(), idx + 1);
            var txnum = txcounts.get(cftID).get(txId.toString());
            txcounts.get(cftID).set(txId.toString(), txnum + 1);
            var res = applyToAllRidsInGroup(cftID, function(rid, contents, key) {
                return checkStateOp(rid, hid, idx, optype, contents, txId, txnum, key);
            }, [opcontents, key]);
        }
        return res;
    } catch (err) {
        console.log(err);
        process.exit()
    }
}

// Read in the result of the non-deterministic operation from the advice
exports.recordNonDetOp = function(cftID, hid) {
    cftID = cftID.karousos_x ? cftID.karousos_x : cftID;
    try {
        if (reportCollectionDeactivated(cftID)) return;
        if (!reportCollectionActivated(cftID)) {
            // update the opcounts and globalNonDetOpCounter for init
            var opnum = opcounts.get(cftID).get(hid.toString());
            opcounts.get(cftID).set(hid.toString(), opnum + 1);
            var count = globalNonDetOpCounter++;
            return reports.hls[cftID][count].result;
        }
        // read from the advice. during preprocessing, the entry has been modified
        // to contain an array of all values across requests. Create a multivalue from these
        // values and return it
        var cft = getCFT(cftID);
        var opnum = opcounts.get(cftID).get(hid.toString());
        opcounts.get(cftID).set(hid.toString(), opnum + 1);
        var op = OpMap.get(parseInt(cftID)).get(hid.toString()).get(opnum);
        return createMultivalue(op.result);
    } catch (err) {
        console.log(err);
        process.exit();
    }

}

// Check that the server correctly records inspect handler operations and
// read in the result
exports.recordCheckOp = function(cftID, hid, eventEmitter, fname, args) {
    cftID = cftID.karousos_x ? cftID.karousos_x : cftID;
    try {
        if (!reportCollectionActivated(cftID)) return null;
        var cft = getCFT(cftID);
        var opnum = opcounts.get(cftID).get(hid.toString());
        opcounts.get(cftID).set(hid.toString(), opnum + 1);
        assert(OpMap.get(parseInt(cftID)).get(hid.toString()).has(opnum));
        var recOp = OpMap.get(parseInt(cftID)).get(hid.toString()).get(opnum);
        let entry = new commonClasses.checkEvents(hid, opnum, eventEmitter.objID, fname, args);
        recOp = new commonClasses.checkEvents(
            recOp.hid,
            recOp.opnum,
            recOp.eventEmitter,
            recOp.fn,
            recOp.args
        );
        // We currently only support listeners: read in the global handlers and the
        // handlers in preprocessing
        if (fname == 'listeners') {
            var res = checkEventsRes.get(recOp.opnum);
            var eTypes = getEmitterEvents(eventEmitter, cftID, hid, args[0]);
            if (eTypes.length > 0) {
                res = res.concat(globH.inspectActivatedHandlersForEvt(eTypes[0], 'success'));
            }
            return res;
        } else {
            throw new Error('We do not handle this case!');
        }
    } catch (err) {
        console.log(err);
        process.exit();
    }
}

// This function gets as input the requestID, the handlerName and the type of event
// and checks that these match the register operation in the handler log.
exports.Register = function(cftID, hid, fname, eType, success, forAlreadyEmitted) {
    cftID = cftID.karousos_x ? cftID.karousos_x : cftID;
    try {
        if (eType != undefined && !(eType instanceof Array)) {
            eType = [eType];
        }
        // Record this as a global handler
        if (!reportCollectionActivated(cftID)) {
            if (eType != undefined) {
                eType.forEach(evt => {
                    evt = commonClasses.turnToError(evt);
                    if (!reportCollectionDeactivated(cftID) || evt.idx != -1) {
                        globH.register(cftID, evt, success, fname, forAlreadyEmitted, emittedEvents);
                    }
                })
            }
            return eType && eType.length > 0 ? eType[0] : undefined;
        }
        var cft = getCFT(cftID);
        var opnum = opcounts.get(cftID).get(hid.toString());
        opcounts.get(cftID).set(hid.toString(), opnum + 1);
        assert(OpMap.get(parseInt(cftID)).get(hid.toString()).has(opnum));
        var recOp = OpMap.get(parseInt(cftID)).get(hid.toString()).get(opnum);
        var entry = new commonClasses.register(
            hid.toString(),
            opnum,
            fname,
            eType,
            success,
            forAlreadyEmitted
        );
        recOp = new commonClasses.register(
            recOp.hid,
            recOp.opnum,
            recOp.handlerName,
            recOp.events,
            recOp.success,
            recOp.forAlreadyEmitted
        );
        if (eType[0] == 'timerEvent') {
            assert(recOp.events[0].startsWith('timerEvent'));
            entry.events = recOp.events;
        }
        assert(entry.toString() == recOp.toString());
        return entry.events[0];
    } catch (err) {
        console.log(err);
        process.exit();
    }
}

// Checks that an unregister operation is recorded correctly.
exports.Unregister = function(cftID, hid, fname, eType, success) {
    cftID = cftID.karousos_x ? cftID.karousos_x : cftID;
    try {
        if (!reportCollectionActivated(cftID)) {
            if (eType != undefined) {
                if (eType instanceof Array) {
                    eType.forEach(evt => {
                        evt = commonClasses.turnToError(evt);
                    })
                }
            }
            return;
        }
        var cft = getCFT(cftID);
        var opnum = opcounts.get(cftID).get(hid.toString());
        assert(OpMap.get(parseInt(cftID)).get(hid.toString()).has(opnum));
        var recOp = OpMap.get(parseInt(cftID)).get(hid.toString()).get(opnum);
        let entry = new commonClasses.unregister(hid, opnum, fname, eType, success);
        recOp = new commonClasses.unregister(
            recOp.hid,
            recOp.opnum,
            recOp.handlerName,
            recOp.events,
            recOp.success
        );
        debug(entry, recOp);
        assert(entry.toString() == recOp.toString());
        opcounts.get(cftID).set(hid.toString(), opnum + 1);
        return;
    } catch (err) {
        console.log(err);
        console.trace();
        process.exit();
    }
}

// Checks that an UnregisterAll function is recorded correctly
exports.UnregisterAll = function(cftID, hid, eType, success) {
    cftID = cftID.karousos_x ? cftID.karousos_x : cftID;
    try {
        if (!reportCollectionActivated(cftID)) return;
        var cft = getCFT(cftID);
        var opnum = opcounts.get(cftID).get(hid.toString());
        assert(OpMap.get(parseInt(cftID)).get(hid.toString()).has(opnum));
        var recOp = OpMap.get(parseInt(cftID)).get(hid.toString()).get(opnum);
        let entry = new commonClasses.unregisterAll(hid, opnum, eType, success);
        recOp = new commonClasses.unregisterAll(recOp.hid, recOp.opnum, recOp.events, recOp.success);
        debug(entry, recOp);
        assert(entry.toString() == recOp.toString());
        opcounts.get(cftID).set(hid.toString(), opnum + 1);
        return;
    } catch (err) {
        console.log(err);
        process.exit();
    }
}

// Checks that all emits events are emitted correctly
exports.EmitAll = function(cftID, hid, eTypes, success, tryEmit) {
    cftID = cftID.karousos_x ? cftID.karousos_x : cftID;
    if (tryEmit) {
        assert(eTypes.length == 1);
        return this.Emit(cftID, hid, eTypes[0], success, tryEmit);
    }
    eTypes.forEach(t => verifierLib.Emit(cftID, hid, t, success));
}

// Checks that an emit operation is recorded correctly
exports.Emit = function(cftID, hid, eType, success, tryEmit) {
    cftID = cftID.karousos_x ? cftID.karousos_x : cftID;
    eType = cloneDeep(eType);
    if (reportCollectionDeactivated(cftID)) return;
    assert(success == 'fail' || success == 'success');
    var failed;
    eType = commonClasses.turnToError(eType);
    if (reportCollectionActivated(cftID)) {
        var cft = getCFT(cftID);
        var opnum = opcounts.get(cftID).get(hid.toString());
        assert(OpMap.get(parseInt(cftID)).get(hid.toString()).has(opnum));
        var recOp = OpMap.get(parseInt(cftID)).get(hid.toString()).get(opnum);
        let recOpSuccess = recOp.success;
        recOp = new commonClasses.emit(
            recOp.hid,
            recOp.opnum,
            recOp.eventType,
            tryEmit ? '' : recOp.success
        );
        if (eType instanceof String && eType.startsWith('timerEvent')) {
            eType = recOp.eventType;
        }
        let entry = new commonClasses.emit(hid, opnum, eType, tryEmit ? '' : success);
        if (entry.toString() !== recOp.toString()) {
            console.log(entry.toString(), recOp.toString())
            assert(entry.toString() == recOp.toString())
        };
        var info = {
            'hid': hid,
            'idx': opnum,
            'log_pos': idx,
            'eType': eType,
            'success': recOpSuccess
        };
        assert(info.hid != undefined);
        var prev = emittedEvents.get(makeUid(cftID, eType)) || [];
        emittedEvents.set(makeUid(cftID, eType), prev.concat([info]));
        assert(recOpSuccess == 'fail' || recOpSuccess == 'success');
        if (tryEmit) failed = (recOpSuccess != success);
        // activate any handlers in global handlers
        globH.emit(eType, success, info, cftID);
        // update opcounts in the end. sometimes this function is called to check if there is an event
        // from emitDependentEvents. So don't update the global opcounts unless there is no error
        opcounts.get(cftID).set(hid.toString(), opnum + 1);
    } else {
        // update global handlers and check if any dependent events are emitted
        var prev = emittedEvents.get(makeUid(cftID, eType)) || [];
        var idx = globalOpcounts.get(hid) || 0;
        globalOpcounts.set(hid, idx + 1);
        var info = {
            type: success,
            'hid': hid,
            'idx': idx,
            'eType': eType
        };
        emittedEvents.set(makeUid(cftID, eType), prev.concat([info]));
        globH.emit(eType, success, info, cftID);
    }
    verifierLib.emitAllDependentEvents(cftID, hid, eType, success);
    return failed;
}

// Checks if any of the dependent events are emitted
exports.emitAllDependentEvents = function(cftID, hid, eType, success) {
    cftID = cftID.karousos_x ? cftID.karousos_x : cftID;
    // It is possible that events are out of order. So, maybe not all dependant events are
    // emitted yet. Try to emit them
    if (dependentEvents.has(cftID) && dependentEvents.get(cftID).has(eType.toString())) {
        dependentEvents.get(cftID).get(eType.toString()).forEach((depEvent) => {
            if (all.get(cftID).has(depEvent)) {
                try {
                    this.Emit(cftID, hid, depEvent, success);
                } catch (err) {}
            } else if (race.get(cftID).has(depEvent)) {
                try {
                    this.Emit(cftID, hid, depEvent, success);
                } catch (err) {}
            }
        })
    }
}

// some of the events, we need to emit them as soon as we add the dependency...
exports.checkIfNeedToEmit = function(cftID, dependentEvent, evts, type1, type2, hid2) {
    cftID = cftID.karousos_x ? cftID.karousos_x : cftID;
    var hids = new Set(),
        allEmitted = evts.length > 0,
        foundType = false;
    if (evts instanceof Set) {
        //this can only happen if we are in the .all case
        //check all arrays of events in the set
        var emittedNum = 0;
        var needToEmitFail = false;
        evts.forEach(evtArray => {
            var allFailed = evtArray.length > 0;
            var updated = false;
            evtArray.forEach((evt) => {
                if (emittedEvents.has(makeUid(cftID, evt))) {
                    var emitted = emittedEvents.get(makeUid(cftID, evt));
                    var successOfDep = emitted[emitted.length - 1].success;
                    let idx = emitted[emitted.length - 1].idx;
                    //if one of them failed for the first time we need to emit the event
                    if (successOfDep == 'success') {
                        if (!updated) emittedNum += 1;
                        updated = true;
                        assert(emitted[emitted.length - 1].hid != undefined);
                        debug('setting hid');
                        hids.add([emitted[emitted.length - 1].hid]);
                        allFailed = false
                    }
                    hids.add([emitted[emitted.length - 1].hid]);
                } else {
                    allFailed = true;
                }
            })
            //all the emitted events in this group have failed so emit a fail event and return
            if (allFailed) {
                needToEmitFail = true;
            }
        })
        if (needToEmitFail) {
            hids.forEach((hid) => {
                try {
                    this.EmitAll(cftID, hid2 || hid, [dependentEvent], 'fail');
                } catch (err) {}
            })
        } else if (emittedNum == evts.size) {
            hids.forEach((hid) => {
                try {
                    this.EmitAll(cftID, hid2 || hid, [dependentEvent], 'success');
                } catch (err) {}
            })
        }
        return;
    }
    var hid;
    if (reportCollectionActivated(cftID)) {
        evts.forEach(evt => {
            if (emittedEvents.has(makeUid(cftID, evt))) {
                let evts = emittedEvents.get(makeUid(cftID, evt));
                let info = evts[evts.length - 1];
                let entry = OpMap.get(parseInt(cftID)).get(info.hid.toString()).get(info.idx);
                //if one of them failed for the first time we need to emit the event
                if (entry.success == type1 && !foundType) {
                    hid = info.hid;
                    foundType = true;
                } else if (!foundType) {
                    hid = info.hid;
                }
            } else {
                allEmitted = false;
            }
        })
    } else {
        //the report collection is not activated
        evts.forEach(evt => {
            if (emittedEvents.has(makeUid(cftID, evt))) {
                let evts = emittedEvents.get(makeUid(cftID, evt));
                var successOfDep = evts[evts.length - 1].type;
                let idx = evts[evts.length - 1].idx;
                //if one of them failed for the first time we need to emit the event
                if (successOfDep == type1 && !foundType) {
                    foundType = true;
                    assert(evts[evts.length - 1].hid != undefined);
                    debug('setting hid');
                    hid = evts[evts.length - 1].hid;
                } else if (!foundType) {
                    hid = evts[evts.length - 1].hid;
                }
            } else {
                allEmitted = false;
                debug('setting hid', type1);
                assert(evts[evts.length - 1].hid != undefined);
                hid = evts[evts.length - 1].hid;
            }
        })
    }
    if (allEmitted || foundType) {
        this.EmitAll(cftID, hid2 || hid, [dependentEvent], foundType ? type1 : type2);
    }
}

// Finds the handler id from the activated handlers
exports.SearchEventOfType = function(cftID, eTypes, fname, success, isThen) {
    var info = null;
    var arg = null;
    var inGlobal = false;
    eTypes.forEach(evt => {
        evt = commonClasses.turnToError(evt);
        try {
            var infoArray = activatedHandlers
                .get(parseInt(cftID))
                .get(fname.toString())
                .get(evt.toString());
            var inf;
            for (let x of infoArray) {
                if (opcounts.get(cftID).has(x.hid)) {
                    inf = x;
                };
            }
            assert(inf != undefined);
        } catch (err) {
            //it's not in the activated handlers
            //so check the global handlers.
            var inf = globH.getActivatedHandler(evt, success, fname, isThen);
            if (inf) {
                inGlobal = true;
            }
        }
        if (inf) {
            // Create a new handler id, and remove the handler from activated handlers
            assert(!info);
            info = [
                new commonClasses.handlerID(
                    fname,
                    new commonClasses.eventID(inf.hid, inf.idx, inf.eType)), inf.hid
            ];
            if (!inGlobal)
                activatedHandlers
                .get(parseInt(cftID))
                .get(fname.toString())
                .get(evt.toString())
                .splice(infoArray.findIndex(x => x == inf), 1);
        }
    })
    return info;
}

// Reads in the new hanlder id for function with id fname
exports.GetHandlerID = function(cftID, eTypes, fname, success, isThen) {
    cftID = cftID.karousos_x ? cftID.karousos_x : cftID;
    if (reportCollectionDeactivated(cftID)) return globalHandler;
    try {
        var cft = reportCollectionActivated(cftID) ? getCFT(cftID) : cftID;
        debug('get handler ID, eType:', eTypes);
        var [hid, invokedBy] = this.SearchEventOfType(cftID, eTypes, fname, success, isThen);
        if (!hid) {
            throw new Error('could not find event of type' + eTypes);
        }
        if (hid instanceof Multivalue) {
            throw new Error('handlerId is multivalue', cft, hid);
        }
        initNewHandler(cftID, hid, invokedBy);
        this.pushContext(cftID, hid, [], '');
        return hid;
    } catch (err) {
        console.log(err);
        process.exit();
    }
}

// Used by then/catch/finally functions. Computes the handler id and unregisters the handler
exports.GetAndUpdateHandlerID = function(cftID, hidPrev, eTypes, fname, success) {
    try {
        cftID = cftID.karousos_x ? cftID.karousos_x : cftID;
        if (reportCollectionDeactivated(cftID)) return globalHandler;
        var [hid, invokedBy] = this.SearchEventOfType(cftID, eTypes, fname, success, true);
        if (!hid) {
            debug('could not find event of type' + eTypes);
            throw new Error('could not find event of type' + eTypes.toString());
        }
        if (hid instanceof Multivalue) {
            throw new Error('handlerId is multivalue', cftID, hid);
        }
        initNewHandler(cftID, hid, invokedBy);
        verifierLib.Unregister(cftID, hid, fname, eTypes, success);
        return hid;
    } catch (err) {
        console.log(err);
        process.exit();
    }
}

// Set all evts in the list to failed in the logs and in emitted
exports.SetReturnEventTypes = function(cftID, dependantEvents, dependentEvents, isPromiseAll, hid2) {
    cftID = cftID.karousos_x ? cftID.karousos_x : cftID;
    var fnToApply = (evt) => {
        assert(evt != undefined);
        verifierLib.setReturnEventTypes(cftID, dependantEvents, evt, isPromiseAll, hid2);
    }
    if (Array.isArray(dependentEvents)) {
        if (dependantEvents.length == 0) {
            this.EmitAll(cftID, hid2, dependentEvents, 'success');
        } else if (
            dependantEvents.length == 1 &&
            dependantEvents[0] instanceof commonClasses.objectID &&
            dependantEvents[0].requestID == -2
        ) {
            this.EmitAll(cftID, hid2, dependentEvents, 'success');
        }
        dependentEvents.forEach(fnToApply);
    } else {
        fnToApply(dependentEvents);
    }
}

// Marks the dependent event as dependent on the dependant events
exports.setReturnEventTypes = function(cftID, dependantEvents, dependentEvent, isPromiseAll, hid2) {
    cftID = cftID.karousos_x ? cftID.karousos_x : cftID;
    var ret = [];
    dependantEvents.forEach(evt => {
        assert(evt != undefined);
        if (Array.isArray(evt)) {
            ret = ret.concat(evt);
        } else {
            ret.push(evt);
        }
    });

    var myThens = [];
    ret.forEach((e) => {
        myThens = myThens.concat(findLastThenPriorToCatch(e), cftID)
    });
    var allEvents = ret;
    if (myThens.length > 0 && isPromiseAll == true) {
        if (ret.length > 1) {
            //all events is a set of arrays.
            allEvents = new Set();
            ret.forEach((e) => {
                var thens = findLastThenPriorToCatch(e);
                allEvents.add(thens.concat([e]))
            })
        } else {
            isPromiseAll = false;
        }
        ret = ret.concat(myThens);
    }

    if (!reportCollectionActivated(cftID) && !dependentEvents.has(cftID)) {
        dependentEvents.set(cftID, new Map());
        all.set(cftID, new Map());
        race.set(cftID, new Map());
    }
    ret.forEach(elem => {
        //save who will emit the event (if different than the dependant event)
        var prevDepEvts = dependentEvents.get(cftID).get(elem.toString()) || [];
        if (!prevDepEvts.includes(dependentEvent)) {
            dependentEvents.get(cftID).set(elem.toString(), prevDepEvts.concat([
                dependentEvent
            ]));
        }
    });
    if (isPromiseAll) {
        all.get(cftID).set(dependentEvent, ret);
        //check if all of them are already emitted
        verifierLib.checkIfNeedToEmit(cftID, dependentEvent, allEvents, 'fail', 'success', hid2);
    } else {
        race.get(cftID).set(dependentEvent, ret);
        verifierLib.checkIfNeedToEmit(cftID, dependentEvent, allEvents, 'success', 'fail', hid2);
    }
}

// Either add dependent events (if result is a promise), or emit the event
exports.SetOrEmit = function(cftID, hid, result, thisPromise, success) {
    cftID = cftID.karousos_x ? cftID.karousos_x : cftID;
    if (reportCollectionDeactivated(cftID)) return;
    assert(result == undefined || !(result instanceof Promise) || result.karContents != undefined);
    if (result && result.karContents) { //it is a promise
        this.SetReturnEventTypes(
            cftID,
            result.retEventTypes.concat([result.objID]),
            thisPromise.retEventTypes,
            false
        );
    } else {
        this.EmitAll(cftID, hid, thisPromise.retEventTypes, success, result);
    }
}

// Functions to get and set the current handler
exports.getCurrentHandler = function(cftID) {
    cftID = cftID.karousos_x ? cftID.karousos_x : cftID;
    if (reportCollectionDeactivated(cftID)) return '';
    if (!curHandler.has(cftID)) {
        throw new Error('no current handlerID');
    }
    return curHandler.get(cftID);
}

function setCurrentHandler(cftID, hid) {
    cftID = cftID.karousos_x ? cftID.karousos_x : cftID;
    curHandler.set(cftID, hid);
}

exports.setCurrentHandler = setCurrentHandler;

// assign an object id and a request id to the input obj
exports.setObjectIDandRequestID = function(obj, cftID, hid) {
    cftID = cftID.karousos_x ? cftID.karousos_x : cftID;
    if (!obj || hasOwnProperty(obj, 'objID')) {
        return;
    }
    if (typeof obj !== "boolean" && !(obj instanceof Boolean) &&
        typeof obj !== "string" && !(obj instanceof String) &&
        typeof obj !== "array" && !(obj instanceof Array) &&
        typeof obj !== "number" && !(obj instanceof Number)) {
        verifierLib.assignObjectID(obj, cftID, hid, false);
        if (cftID != undefined) {
            defineProperty(obj, 'requestID', cftID);
        }
    }
}

// add the requst id and handler id to obj if it is a thenable but not a native function
exports.addRidHidIfNeeded = function(obj, cftID, handlerID) {
    cftID = cftID.karousos_x ? cftID.karousos_x : cftID;
    //if it is a thenable but not a native promise save the requestID and handlerID
    if (obj && typeof obj.then === 'function' && !(obj instanceof Promise)) {
        defineProperty(obj, 'requestID', cftID);
        defineProperty(obj, 'handlerID', handlerID);
        verifierLib.assignObjectID(obj, cftID, handlerID, false);
        defineProperty(obj, 'retEventTypes', []);
    }
    return obj;
}


// Get a member/property of the input object. Both object and member can be multivalues
exports.getMember = function(obj, member) {
    if ((obj instanceof Multivalue)) {
        if (!(member instanceof Multivalue)) {
            return createMultivalue(obj.karousos_value.map((x) => x[member]));
        } else {
            assert(obj.length == member.length);
            return createMultivalue(obj.karousos_value.map((x, i) => x[member[i]]));
        }
    };
    if (!(member instanceof Multivalue)) {
        return obj[member]
    }
    if (member.collapsed) return obj[member.karousos_value]
    return createMultivalue(member.karousos_value.map((x) => obj[x]))
}

// The main function wrapper
exports.callFunction = function(
    isNew,
    fn,
    thisArg,
    method,
    cftID,
    handlerID,
    retEventTypes,
    initArgs,
) {
    cftID = cftID.karousos_x ? cftID.karousos_x : cftID;
    var thisArgOriginal = thisArg;
    thisArg = verifierLib.getValueOf(thisArg);
    method = verifierLib.getValueOf(method);
    // If fn is undefined try to reconstruct it from thisArg and method
    if (fn == undefined && thisArg != undefined && thisArg != null) {
        if (thisArg instanceof Multivalue) {
            fn = thisArg.karousos_value[0][method];
        } else {
            fn = thisArg[method];
        }
    }
    assert(fn != undefined);
    // Functions to retrieve and modify arguments for general functions
    var thisArgNotNull = thisArg != undefined && thisArg != null;
    var getArgs = () => {
        return initArgs
    };
    var setArgs = (newArgs) => {
        return newArgs
    };
    var concatArgs = (newArgs) => {
        return setArgs(newArgs.concat(getArgs()))
    };
    var getThis = () => {
        return thisArg
    };
    // The underlying function whose type we check for, and accordingly make the call
    var toTest = fn;
    assert(toTest != undefined);
    if (fn == Function.prototype.call) {
        getArgs = () => {
            return initArgs.slice(1)
        };
        setArgs = (newArgs) => {
            return [initArgs[0]].concat(newArgs)
        };
        getThis = () => {
            return initArgs[0]
        };
        toTest = thisArg;
    } else if (fn == Function.prototype.apply) {
        getArgs = () => {
            return verifierLib.getValueOf(initArgs[1]) || []
        };
        setArgs = (newArgs) => {
            return [initArgs[0], newArgs]
        };
        getThis = () => {
            return initArgs[0]
        };
        toTest = thisArg;
    } else if (fn == Reflect.apply) {
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
    verifierLib.pushContext(cftID, handlerID, retEventTypes, '');

    // Unwrap the arguments. If this is a call to a user-defined function there is no
    // need to unwrap all arrays in the arguments
    var fType = functionType(toTest, initArgs, isNew, thisArg, method);
    if (fType != 1) {
        var argsNew = [];
        for (let arg of initArgs) {
            if (arg && arg.isLoggable) {
                arg = assignObjectID(arg, cftID, handlerID, true);
            }
            argsNew.push(verifierLib.getValueOf(arg, true))
        }
        initArgs = argsNew;
    } else {
        var argsNew = [];
        for (let arg of initArgs) {
            argsNew.push(verifierLib.getValueOf(arg))
        }
        initArgs = argsNew;
    }
    var args = getArgs();
    switch (fType) {
        case 0: //call we can't handle
            return new Error('call we cannot handle');
        case 1: //our call, might return a thenable. so in any case emit an event...
            var rid = cftID,
                hid = handlerID;
            var initRetEventTypesLength = retEventTypes.length;
            // asynchronous function should see retEventTypes.length > 0 so that they return promises
            // so create an object id an assign it to it
            if (fn.constructor == asyncFuncProto.constructor) {
                var objID = createObjectID(cftID, handlerID, false, assignObjectID);
                retEventTypes = retEventTypes.concat([objID]);
            }
            var newArgs = concatArgs([cftID, handlerID, retEventTypes, objID]);
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
                obj.requestID = cftID;
                obj.handlerID = handlerID;
                obj.retEventTypes = [];
            }
            // the function called might be an asynchronous function: wrap the promise and
            // emit a success event for the returned promise. If the promise fails,
            // update the event to fail
            if (obj instanceof Promise && !obj.karContents && initRetEventTypesLength == 0) {
                var prom = verifierLib.createPromiseObject(cftID, handlerID);
                var failed = verifierLib.EmitAll(
                    cftID,
                    handlerID,
                    prom.retEventTypes,
                    'success',
                    true
                );
                prom.karContents = obj.then((res) => {
                    if (failed != undefined && failed) {
                        console.log('prover falsely claimed that a promise failed', failed);
                        console.trace();
                        process.exit();
                    }
                    return res;
                }, (err) => {
                    console.log(err);
                    assert(failed == undefined || failed == true);
                    throw err;
                });
                verifierLib.setThen(prom);
                return prom;
            }
            return verifierLib.getValueOf(obj);
        case 2: //new Promise
            assert(
                fn != Reflect.apply &&
                fn != Function.prototype.call &&
                fn != Function.prototype.apply
            );
            var x = verifierLib.createPromiseObject(cftID, handlerID);
            // Save a global variable promisename and set it to x.
            global[args[0].promiseName] = x;
            x.karContents = new Promise(args[0].fromPromiseInternal);
            verifierLib.setThen(x);
            return x;
        case 3: //Promise.prototype.then
            assert(fn != Reflect.apply);
            assert(args.length < 3);
            if (fn == Function.prototype.call || fn == Function.prototype.apply) {
                thisArg = getThis();
            }
            var t = true;
            if (thisArg.karContents == undefined) {
                throw new Error('myArg.karContents undefined');
            }
            // Wrap the new promise
            var p = verifierLib.createPromiseObject(cftID, handlerID);
            if (args.length == 0) {
                args[0] = function emptyThen(x) {
                    return x;
                };
            };
            // Handle each of the callbacks:
            // update promise menthods. Assign an object id to each of the functions
            // And register them as listeners to the promise's events
            // Wrap the callbacks, to retrieve the handler id and request id when they start
            // executing
            var newFns = [null, null];
            if (
                args.length == 2 &&
                getValueOf(args[1]) != undefined &&
                getValueOf(args[1]) != null
            ) {
                assert(args[1] instanceof Function);
                verifierLib.assignObjectID(args[1], cftID, handlerID, true);
                if (!reportCollectionDeactivated(cftID)) {
                    addPromiseMethod(cftID, thisArg, p, 'catch');
                    p.inFailEventTypes = getAllEventsForCatch(cftID, thisArg);
                }
                verifierLib.Register(
                    cftID,
                    handlerID,
                    args[1].objID.toString(),
                    p.inFailEventTypes,
                    'fail',
                    true
                );
                var catchFn = (res) => {
                    var requestID = p.requestID;
                    var handlerID = verifierLib.GetHandlerID(
                        requestID,
                        p.inFailEventTypes,
                        args[1].objID.toString(),
                        "fail",
                        true
                    );
                    var retEventTypes = p.retEventTypes;
                    if (functionType(args[1], res) == 1) {
                        return args[1](requestID, handlerID, retEventTypes, "", res);
                    } else {
                        assert(functionType(args[1], res) == 100);
                        return args[1](res);
                    }
                };
                newFns[1] = catchFn;
            }
            if (
                args.length > 0 &&
                verifierLib.getValueOf(args[0]) != undefined &&
                verifierLib.getValueOf(args[0]) != null
            ) {
                assert(args[0] instanceof Function);
                verifierLib.assignObjectID(args[0], cftID, handlerID, true);
                if (!reportCollectionDeactivated(cftID)) {
                    addPromiseMethod(cftID, thisArg, p, 'then');
                    p.inSuccessEventTypes = getAllEventsForThen(cftID, thisArg);
                }
                verifierLib.Register(
                    cftID,
                    handlerID,
                    args[0].objID.toString(),
                    p.inSuccessEventTypes,
                    'success',
                    true
                );
                var thenFn = (res) => {
                    var requestID = p.requestID;
                    var handlerID = verifierLib.GetHandlerID(
                        requestID,
                        p.inSuccessEventTypes,
                        args[0].objID.toString(),
                        "success",
                        true
                    );
                    var retEventTypes = p.retEventTypes;
                    if (functionType(args[0], res) == 1) {
                        return args[0](requestID, handlerID, retEventTypes, "", res);
                    } else {
                        assert(functionType(args[0], res) == 100);
                        return args[0](res);
                    }
                }
                newFns[0] = thenFn;
            }
            // Now call the function
            if (fn == Function.prototype.apply) {
                p.karContents = thisArg.karContents.then.apply(thisArg.karContents, newFns);
            } else if (fn == Function.prototype.call) {
                p.karContents = thisArg.karContents.then.call(thisArg.karContents, ...newFns);
            } else {
                p.karContents = thisArg.karContents.then(...newFns);
            }
            // make the object a thenable
            verifierLib.setThen(p);
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
            var p = verifierLib.createPromiseObject(cftID, handlerID);
            assert(args.length > 0);
            assert(args[0] instanceof Function);
            verifierLib.assignObjectID(args[0], cftID, handlerID, true);
            addPromiseMethod(cftID, thisArg, p, 'catch');
            p.inEventTypes = getAllEventsForCatch(cftID, thisArg);
            verifierLib.Register(
                cftID,
                handlerID,
                args[0].objID.toString(),
                p.inEventTypes,
                'fail',
                true
            );
            p.karContents = thisArg.karContents.catch((res) => {
                console.log(res);
                var requestID = p.requestID;
                var handlerID = verifierLib.GetHandlerID(
                    requestID,
                    p.inEventTypes,
                    args[0].objID.toString(),
                    "fail",
                    true
                );
                var retEventTypes = p.retEventTypes;
                return args[0](requestID, handlerID, retEventTypes, "", res);
            });
            verifierLib.setThen(p);
            return p;
        case 5: //promise.prototype.finally: Handled as case 3
            assert(
                fn != Reflect.apply &&
                fn != Function.prototype.call &&
                fn != Function.prototype.apply
            );
            if (thisArg.karContents == undefined) {
                throw new Error('thisArg.karContents undefined');
            }
            var p = verifierLib.createPromiseObject(cftID, handlerID);
            assert(args.length > 0);
            assert(args[0] instanceof Function);
            verifierLib.assignObjectID(args[0], cftID, handlerID, true);
            addPromiseMethod(cftID, thisArg, p, 'finally');
            p.inEventTypes = getAllEventsForFinally(cftID, thisArg);
            verifierLib.Register(
                cftID,
                handlerID,
                args[0].objID.toString(),
                p.inEventTypes,
                'any',
                true
            );
            p.karContents = thisArg.karContents.finally((res) => {
                var requestID = p.requestID;
                var handlerID = verifierLib.GetHandlerID(
                    requestID,
                    p.inEventTypes,
                    args[0].objID.toString(),
                    "any",
                    true
                );
                var retEventTypes = p.retEventTypes;
                verifierLib.Unregister(requestID, handlerID, args[0].name, p.inEventTypes, 'any');
                return args[0](requestID, handlerID, retEventTypes, "", res);
            })
            verifierLib.setThen(p);
            return p;
        case 6: //promise.all or promise.race
            assert(
                fn != Reflect.apply &&
                fn != Function.prototype.call &&
                fn != Function.prototype.apply
            );
            var p = verifierLib.createPromiseObject(cftID, handlerID);
            var myArgs = [],
                myArgsEvents = [];
            for (let i = 0; i < args[0].length; i++) {
                let arg = args[0][i];
                // Emit all events if the arguments are not promises
                if (arg == undefined || !(arg instanceof Promise)) {
                    var myArg = verifierLib.createPromiseObject(cftID, handlerID);
                    myArg.karContents = arg;
                    verifierLib.EmitAll(cftID, handlerID, myArg.retEventTypes, 'success');
                    args[0][i] = myArg;
                    arg = myArg;
                }
                myArgs.push(arg.karContents);
                myArgsEvents.push(arg.retEventTypes);
            }

            // Make the resolve/reject events of this promise depend on the argument promises
            verifierLib.SetReturnEventTypes(
                cftID,
                myArgsEvents,
                p.retEventTypes,
                fn == Promise.all,
                handlerID
            );
            p.karContents = fn == Promise.all ? Promise.all(myArgs) : Promise.race(myArgs);
            verifierLib.setThen(p);
            return p;
        case 7: //promise.reject of promise.resolve
            assert(
                fn != Reflect.apply &&
                fn != Function.prototype.call &&
                fn != Function.prototype.apply
            );
            // Emit a success event. If the promise ends up rejecting, change its type
            var p = verifierLib.createPromiseObject(cftID, handlerID);
            var arg = (args[0] && args[0].karContents) ? args[0].karContents : args[0];
            p.karContents = fn == Promise.resolve ? Promise.resolve(arg) : Promise.reject(arg);
            var failed = verifierLib.EmitAll(cftID, handlerID, p.retEventTypes, "success");
            p.karContents = p.karContents.then((res) => {
                if (failed != undefined && failed) {
                    console.log('prover claimed that a promise failed but it did not');
                    console.trace();
                    process.exit();
                }
                return res;
            }, (err) => {
                assert(failed == undefined || failed == true);
                throw err;
            });
            verifierLib.setThen(p);
            return p;
        case 9: //bind
            assert(fn != Reflect.apply && fn != Function.prototype.call);
            // Save the function init type. wrap the binded function to retrieve the context
            var myFunc = getThis();
            if (fn == Function.prototype.apply) {
                assert(args.length < 2);
                var res = thisArg.apply(...initArgs);
            } else {
                if (args.length > 1) {
                    myFunc = function(...funcArgs) {
                        if (functionType(thisArg) == 1) {
                            return thisArg(...(verifierLib.popContext().concat(funcArgs)));
                        } else if (functionType(thisArg) == 23) {
                            var [
                                requestID,
                                handlerID,
                                retEventTypes,
                                objID
                            ] = verifierLib.popContext();
                            return verifierLib.callFunction(
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
                            assert(functionType(thisArg) == 100);
                            return thisArg(...funcArgs);
                        }
                    }
                }
                var res = myFunc.bind(...args);
            }
            saveFunctionInitType(res, myFunc);
            return res;
        case 10: //Function constructor: Parse the function
            assert(fn != Reflect.apply && fn != Function.prototype.call)
            if (fn != Function.prototype.apply) {
                assert(getThis() == null);
            }
            return verifierLib.newFunction(...[
                fn == generatorFuncProto.constructor,
                fn == asyncFuncProto.constructor
            ].concat(getArgs().map(x => verifierLib.getValueOf(x))))
        case 11: //eval: transform the function and execute it
            assert(
                fn != Reflect.apply &&
                fn != Function.prototype.call &&
                fn != Function.prototype.apply
            );
            var code = getValueOf(args[0]);
            var codeTranspiled = transformFunction(code, false, true, true);
            return eval(codeTranspiled);
        case 12:
            //generator next: set the handler id prior to the call and retrieve it after the call
            assert(
                fn != Reflect.apply &&
                fn != Function.prototype.call &&
                fn != Function.prototype.apply
            );
            setHandlerIDforObjectID(cftID, handlerID, thisArg, verifierLib.assignObjectID);
            var res = thisArg.next(...args);
            handlerID = getHandlerIDforObjectID(cftID, handlerID, thisArg, verifierLib.assignObjectID);
            verifierLib.setCurrentHandler(cftID, handlerID);
            verifierLib.setObjectIDandRequestID(res, cftID, handlerID);
            return res;
        case 13: //JSON.parse or JSON.stringify: wrap the callback to retrieve the context
            assert(
                fn != Reflect.apply &&
                fn != Function.prototype.call &&
                fn != Function.prototype.apply
            );
            if (args.length < 2 || args[1] == null || args[1] == undefined) {
                return applyToAllRidsInGroup(cftID, (rid, args) => {
                    return fn(...args.map(x => verifierLib.getValueOf(x)));
                }, [args]);
            }

            var myFunction = function(...funcArgs) {
                try {
                    assert(functionType(args[1]) == 1);
                } catch (err) {
                    console.log('ERROR', err);
                    process.exit();
                }
                return args[1](...[cftID, handlerID, retEventTypes, '']
                    .concat(funcArgs.map(x => verifierLib.getValueOf(x))));
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
                args[0](cftID, handlerID, retEventTypes, '');
            }
            return fn(...[myFunction].concat(args.slice(1)));
        case 15:
            // non deterministic call to node core: read from advice
            // and convert to appropriate type
            assert(
                fn != Reflect.apply &&
                fn != Function.prototype.call &&
                fn != Function.prototype.apply
            );
            if (!reportCollectionDeactivated(cftID)) {
                var recRet = verifierLib.recordNonDetOp(cftID, handlerID, res);
                if (fn == Date.prototype.constructor) {
                    return executeCall(
                        true,
                        false,
                        undefined,
                        '',
                        Date,
                        [recRet],
                        createMultivalue,
                    );
                }
                if (fn == crypto.randomFillSync) {
                    var res = new Uint8Array(Object.keys(recRet).length);
                    for (let i in recRet) {
                        initArgs[0][i] = recRet[i]
                    }
                    // check that the written value matches the one in variable logs
                    assignObjectID(initArgs[0], cftID, handlerID, false)
                    return;
                }
                if (fn == Math.random) {
                    return recRet;
                }
                if (fn == Date.now) {
                    return recRet
                }
                console.log("Unrecognized ", fn);
                console.trace();
                process.exit();
                return res;
            } else {
                return isNew ?
                    new fn(...initArgs) :
                    (
                        thisArgNotNull ?
                        thisArg[method](...initArgs.map(x => verifierLib.getValueOf(x))) :
                        fn(...initArgs.map(x => verifierLib.getValueOf(x)))
                    );
            }
        case 16: //deterministic call to node core with callback
            // There is no callback. so just make the call
            if (!(args[args.length - 1] instanceof Function)) {
                return executeCall(
                    isNew,
                    thisArgNotNull,
                    thisArg,
                    method,
                    fn,
                    initArgs,
                    createMultivalue,
                );
            }
            // Otherwise, assign an object id to the function, register the callback, and
            // activate it before making the call. Wrap the callback in a function to
            // retrieve the context
            var objID = createObjectID(cftID, handlerID, false, assignObjectID);
            fn = verifierLib.assignObjectID(fn, cftID, handlerID, true, false);
            verifierLib.Register(cftID, handlerID, fn.objID.toString(), [objID], 'success');
            verifierLib.EmitAll(cftID, handlerID, [objID], 'success');
            var rid = cftID;
            var hid = handlerID;
            var objID2 = objID;
            var retEventTypes2 = [objID];
            var myFunction = function(...funcArgs) {
                var requestID = rid;
                var handlerID = verifierLib.GetHandlerID(
                    requestID,
                    [objID2],
                    fn.objID.toString(),
                    'success',
                    funcArgs
                );
                verifierLib.Unregister(cftID, hid, fn.objID.toString(), objID2, 'success');
                var objID = '';
                var retEventTypes = [];

                try {
                    assert(functionType(args[args.length - 1]) == 1);
                } catch (err) {
                    throw err;
                }
                return args[args.length - 1](
                    ...[requestID, handlerID, retEventTypes, objID2].concat(funcArgs)
                );
            }
            var newArgs = setArgs(
                args.slice(0, args.length - 1)
                .map(x => verifierLib.getValueOf(x)).concat([myFunction])
            );
            try {
                res = thisArgNotNull ? thisArg[method](...newArgs) : fn(...newArgs);
            } catch (err) {
                throw err;
            }
            return res;
        case 17: //non deterministic call to node core with callback: Combine cases 15 and 16
            assert(
                fn != Reflect.apply &&
                fn != Function.prototype.call &&
                fn != Function.prototype.apply
            );
            if (!(args[args.length - 1] instanceof Function)) {
                var res2 = verifierLib.recordNonDetOp(cftID, handlerID, res);
                if (fn == crypto.randomBytes) {
                    return Buffer.from(res2);
                }
                var res = isNew ? new fn(...args) : fn(...args);
                if (reportCollectionActivated(cftID)) {
                    res = Object.assign(res, res2);
                }
                return res;
            }
            var objID = createObjectID(cftID, handlerID, false, assignObjectID);
            verifierLib.Register(cftID, handlerID, fn.name, [objID], 'success');
            verifierLib.EmitAll(cftID, handlerID, [objID], 'success');
            var rid = cftID;
            var hid = handlerID;
            var objID2 = objID;
            var retEventTypes2 = [objID];
            var myFunction = function(...funcArgs) {
                var requestID = rid;
                var handlerID = verifierLib.GetHandlerID(
                    requestID,
                    [objID2],
                    fn.name,
                    'success',
                    funcArgs
                );
                var objID = '';
                var retEventTypes = [];
                var fType = functionType(args[args.length - 1]);
                try {
                    assert([1, 100].includes(fType));
                } catch (err) {
                    console.log('ERROR', err);
                    process.exit();
                }
                if (reportCollectionActivated(cftID)) {
                    verifierLib.recordNonDetOp(requestID, handlerID, args);
                }
                if (fType == 1) {
                    return args[args.length - 1](...[requestID, handlerID, objID, retEventTypes]
                        .concat(funcArgs));
                } else {
                    return args[args.length - 1](...funcArgs);
                }
            }
            return fn(...args.slice(0, args.length - 1).concat([myFunction]));
        case 18: //Array iterator
            // If there is no callback just make the call
            if (args[0] == undefined) {
                assert(
                    fn != Reflect.apply &&
                    fn != Function.prototype.call &&
                    fn != Function.prototype.apply
                );
                return thisArgNotNull ?
                    thisArg[method](...args.map(x => verifierLib.getValueOf(x))) :
                    fn(...args.map(verifierLib.getValueOf(x)));
            }
            // Wrap the callback to retrieve the context
            var myFunc = function(...funcArgs) {
                var fType = functionType(args[0]);
                try {
                    assert([1, 100].includes(fType));
                } catch (err) {
                    console.log('ERROR', err);
                    process.exit();
                }
                if (fType == 1) {
                    if (args[1] != undefined) {
                        var res = args[0].apply(
                            this,
                            [cftID, handlerID, retEventTypes, ''].concat(funcArgs)
                        );
                    } else {
                        var res = args[0](...[cftID, handlerID, retEventTypes, '']
                            .concat(funcArgs)
                        );
                    }
                } else {
                    var res = args[0](...funcArgs);
                }
                return getValueOf(res);
            }
            var newArgs = setArgs([myFunc].concat(args.slice(1)));
            return executeCall(
                isNew,
                thisArgNotNull,
                thisArg,
                method,
                fn,
                newArgs,
                createMultivalue,
            );
        case 19: //deterministic call to node core that returns a promise
            // Wrap the result and emit an event. If the promise fails later, we change the entry
            // in the logs
            assert(
                fn != Reflect.apply &&
                fn != Function.prototype.call &&
                fn != Function.prototype.apply
            );
            var res = verifierLib.createPromiseObject(cftID, handlerID);
            var failed = verifierLib.EmitAll(
                cftID,
                handlerID,
                res.retEventTypes,
                'success',
                true
            );
            res.karContents = fn(...args.map(x => verifierLib.getValueOf(x))).then((val) => {
                if (failed) {
                    console.log('prover claimed that a promise failed but it did not');
                    console.trace();
                    process.exit();
                }
                return val;
            }, (err) => {
                if (failed != undefined && !failed) {
                    console.log('Prover claimed that there was no error but error is', err);
                    console.trace();
                    process.exit();
                };
                throw err;
            })
            verifierLib.setThen(res);
            return res;
        case 20: //non deterministic call to node core that returns a promise: similar to 19
            assert(
                fn != Reflect.apply &&
                fn != Function.prototype.call &&
                fn != Function.prototype.apply
            );
            var res = verifierLib.createPromiseObject(cftID, handlerID);
            res.karContents = fn(...args).then(() => {
                verifierLib.EmitAll(cftID, handlerID, res.retEventTypes, 'success');
                verifierLib.recordNonDetOp(cftID, handlerID, arg);
                return arguments;
            }).catch(() => {
                verifierLib.recordNonDetOp(cftID, handlerID, err);
                verifierLib.EmitAll(cftID, handlerID, res.retEventTypes, 'fail');
                throw arguments;
            });
            verifierLib.setThen(res);
            return res;
        case 21: //Events add listener
            assert(fn != Reflect.apply && fn != Function.prototype.apply);
            var isAddListenerOnce = builtins.registerOnceFns.has(toTest);
            try {
                verifierLib.assignObjectID(args[1], cftID, handlerID, false);
            } catch (err) {
                console.log(err)
                process.exit()
            }
            var fname = args[1].objID.toString();
            var events = [fname + ":" + args[0]];
            var rid = cftID,
                hid = handlerID;
            verifierLib.Register(rid, hid, fname, events, 'success');
            var myFunctionObjectID = createObjectID(cftID, handlerID, false, assignObjectID);
            var err = new Error();
            var myFunction = function(...funcArgs) {
                var requestID = rid;
                if (
                    builtins.isInternalEvent(toTest, thisArg, getArgs()[0]) ||
                    (!funcArgs[0] || funcArgs[0].karRid == undefined)
                ) {
                    // if not emitted by us
                    // this is treated as a new objectID
                    // create a new handlerID that was triggered by internal event
                    if (args[0] == 'connection') {
                        cftID = -2;
                    }
                    handlerID = new commonClasses.handlerID(
                        newEventForObject(cftID, myFunctionObjectID).toString(),
                        newEventForObject(cftID, myFunctionObjectID)
                    );
                    initNewHandler(requestID, handlerID, hid);
                } else {
                    requestID = funcArgs[0].karRid;
                    funcArgs = funcArgs.slice(1);
                    handlerID = verifierLib.GetHandlerID(requestID, events, fname, 'success');
                }
                var retEventTypes = [];
                var objID = '';
                let fnType = functionType(getArgs()[1]);
                if (fnType == 100) {
                    return getArgs()[1](...funcArgs);
                }
                try {
                    assert(fnType == 1);
                } catch (err) {
                    console.log(getArgs()[1].toString());
                    console.log('ERROR', err, getArgs()[1]);
                    process.exit();
                }
                let isArrowFunction = (fn) => {
                    return fn.toString() != undefined && fn.toString().includes('=>');
                };
                var res = isArrowFunction(getArgs()[1]) ?
                    getArgs()[1](requestID, handlerID, retEventTypes, objID, ...funcArgs) :
                    getArgs()[1].call(
                        this,
                        requestID,
                        handlerID,
                        retEventTypes,
                        objID,
                        ...funcArgs
                    );
                if (isAddListenerOnce) {
                    verifierLib.Unregister(requestID, handlerID, fname, events, 'success');
                }
                return res;
            }
            //assign the same objectID to my function and args[1].objID
            assignProperty(myFunction, 'objID', args[1].objID, cftID, hid, addReference_safe);
            var newArgs = setArgs([getValueOf(args[0]), myFunction]);
            if (
                fn != Reflect.apply &&
                fn != Function.prototype.call &&
                fn != Function.prototype.apply
            ) {
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
            var eventName = getEmitterEvents(thisArg, cftID, handlerID, args[0]);
            if (builtins.unregisterAllFns.has(fn)) {
                verifierLib.UnregisterAll(cftID, handlerID, eventName, 'success');
                return thisArg[method](...args);
            }
            assert(args[1].objID != undefined);
            verifierLib.Unregister(cftID, handlerID, args[1].objID, eventName, 'success');
            var listener = getListeners(thisArg, args[0], args[1].objID);
            return thisArgNotNull ?
                thisArg[method](getValueOf(args[0]), listener) :
                fn(getValueOf(args[0]), listener);
        case 23: //eventEmitter.emit
            assert(
                fn != Reflect.apply &&
                fn != Function.prototype.call &&
                fn != Function.prototype.apply
            );
            verifierLib.assignObjectID(getThis(), cftID, handlerID, true);
            var eventNames = getEmitterEvents(thisArg, cftID, handlerID, getValueOf(args[0]));
            var myArgs = [{
                'karRid': cftID
            }].concat(args.slice(1));
            verifierLib.EmitAll(cftID, handlerID, eventNames, 'success');
            assert(thisArgNotNull == true);
            return thisArg.myEmit(...([getValueOf(args[0])].concat(myArgs)));
        case 24: //check events. Read from handler logs
            assert(
                fn != Reflect.apply &&
                fn != Function.prototype.call &&
                fn != Function.prototype.apply
            );
            verifierLib.assignObjectID(getThis(), cftID, handlerID, false);
            var res = verifierLib.recordCheckOp(cftID, handlerID, thisArg, fn.name, args);
            if (res == null) {
                return thisArgNotNull ? thisArg[method](...args) : fn(...args);
            } else {
                return res;
            }
        case 25: //events once
            assert(
                fn != Reflect.apply &&
                fn != Function.prototype.call &&
                fn != Function.prototype.apply
            );
            var eventNames = getEmitterEvents(thisArg, cftID, handlerID, args[0]);
            var rid = cftID,
                hid = handlerID;
            var res = verifierLib.buildPromiseObject(rid, hid);
            res.karContents = fn(...args.map(x => verifierLib.getValueOf(x))).then((a) => {
                if (builtins.isInternalEvent(args[0], args[1])) {
                    verifierLib.EmitAll(rid, hid, eventName, 'success');
                }
                return a;
            });
            verifierLib.SetReturnEventTypes(cftID, eventNames, res.retEventTypes, 'true');
            return res;
        case 26: //resolve/reject function
            assert(
                fn != Reflect.apply &&
                fn != Function.prototype.call &&
                fn != Function.prototype.apply
            );
            return callTheResolveOrRejectFunction(cftID, handlerID, fn, args[0]);
        case 27: //schedule timer
            var timerObjID = createObjectID(cftID, handlerID, false, assignObjectID);
            if (toTest != setInterval) {
                verifierLib.Register(cftID, handlerID, timerObjID, [timerObjID.toString()], 'success');
                verifierLib.EmitAll(cftID, handlerID, [timerObjID.toString()], 'success');
            }
            var err = new Error('skata ' + cftID.toString());
            var rid = cftID;
            var hid = handlerID;
            var myFunction = function(requestID, handlerID, retEventTypes, objID, ...funcArgs) {
                if (toTest != setInterval) {
                    handlerID = verifierLib.GetHandlerID(
                        requestID,
                        [timerObjID.toString()],
                        timerObjID,
                        'success',
                        funcArgs
                    );
                } else {
                    handlerID = new commonClasses.handlerID(
                        newEventForObject(requestID, myFunctionObjectID).toString(),
                        newEventForObject(requestID, myFunctionObjectID)
                    );
                    initNewHandler(requestID, handlerID, hid);
                }
                try {
                    assert([1, 26].includes(functionType(args[0])));
                } catch (err) {
                    console.log('ERROR', err);
                    process.exit();
                }
                if (functionType(args[0]) == 26) {
                    return callTheResolveOrRejectFunction(
                        requestID,
                        handlerID,
                        args[0],
                        funcArgs[0]
                    );
                }
                return args[0].apply(
                    this,
                    [requestID, handlerID, retEventTypes, objID].concat(funcArgs)
                );
            }
            var newArgs = setArgs([myFunction, cftID, handlerID, [], '']
                .concat(getArgs().slice(1)));
            if (builtins.scheduleTimerNoDelayFns.has(toTest)) {
                var newArgs = setArgs(
                    [myFunction, cftID, handlerID, [], ''].concat(args.slice(1))
                );
            } else {
                var newArgs = setArgs(
                    [myFunction, getValueOf(args[1]), cftID, handlerID, [], '']
                    .concat(args.slice(2))
                );
            }
            var res = thisArgNotNull ? thisArg[method](...newArgs) : fn(...newArgs);
            if (res) res.objID = timerObjID;
            // don't allow anyone to call setInterval
            // and do not allow the initialization to call setTimeout
            if (toTest == setInterval) {
                clearInterval(res);
            }
            if (toTest == setTimeout && !reportCollectionActivated(cftID)) {
                clearTimeout(res);
            }
            return res;
        case 28: //String.replace with function
            var rid = cftID,
                hid = handlerID;
            var myFunc = function(...funcArgs) {
                try {
                    assert(functionType(args[args.length - 1]) == 1);
                } catch (err) {
                    throw err;
                }
                return args[args.length - 1](...[rid, hid, [], ''].concat(funcArgs));
            }
            var newArgs = setArgs(
                args.slice(0, args.length - 1).map(x => verifierLib.getValueOf(x))
                .concat([myFunc])
            );
            return fn.apply(thisArg, newArgs);
        case 29: //clear timer
            if (args[0] != undefined) {
                assert(args[0].objID);
                verifierLib.Unregister(
                    cftID,
                    handlerID,
                    args[0].objID,
                    [args[0].objID.toString()],
                    'success'
                );
            }
            return thisArgNotNull ?
                thisArg[method](...initArgs.map(x => verifierLib.getValueOf(x))) :
                fn(...initArgs.map(x => verifierLib.getValueOf(x)));
        case 30: //Object.keys (don't return the objID)
            var data = Object.assign({}, args[0]);
            if (!(args[0] instanceof EventEmitter)) {
                delete data.objID;
                delete data.requestID;
            }
            return Object.keys(data).filter(k => getValueOf(data[k]) != undefined);
        case 31: //Require
            return fn(verifierLib.handleRequire(...initArgs));
        case 32:
            let ret = fn(...initArgs);
            defineProperty(ret, 'isDebugLog', true);
            return ret;
        case 33: //util.promisify
            if ([16, 27].includes(functionType(initArgs[0]))) {
                var retVal = fn(...initArgs);
                retVal.promisified = true;
                return retVal;
            } else {
                assert(functionType(initArgs[0]) == 1); //ourCall
                //This is the promisify function
                function promisify(original) {
                    // Names to create an object from in case the callback receives multiple
                    // arguments, e.g. ['bytesRead', 'buffer'] for fs.read.
                    return function fn(requestID, handlerID, objID, retEventTypes, ...args) {
                        var prom = verifierLib.createPromiseObject(requestID, handlerID);
                        if (args[0] instanceof Object) {
                            global[args[0].promiseName] = prom;
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
                                    (
                                        requestID,
                                        handlerID,
                                        objID,
                                        retEventTypes,
                                        err,
                                        ...values
                                    ) => {
                                        if (err) {
                                            verifierLib.EmitAll(
                                                requestID,
                                                handlerID,
                                                prom.retEventTypes,
                                                'fail'
                                            );
                                            return reject(err);
                                        }
                                        verifierLib.EmitAll(
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
                                        verifierLib.EmitAll(
                                            requestID,
                                            handlerID,
                                            prom.retEventTypes,
                                            'fail'
                                        );
                                        return reject(err);
                                    }
                                    verifierLib.EmitAll(
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
                return promisify(initArgs[0]);
            }
        case 34:
            assert(
                fn != Reflect.apply &&
                fn != Function.prototype.call &&
                fn != Function.prototype.apply
            );
            //Express function should only be called from the server in the beginning
            assert(!reportCollectionActivated(cftID));

            //first find the indexes that need to be modified
            var fnIndexes = builtins.isCallToExpressMethod(fn, args);
            var newArgs = args;
            //it is static with set headers
            if (fnIndexes[0] == builtins.isStatic) {
                if (args[1].setHeaders.length != 3) {
                    newArgs[1].setHeaders = (req, res, next) => {
                        var requestID = req.headers['x-request-id'];
                        var handlerID = verifierLib.newHandlerID(requestID, args[1].setHeaders.name);
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
                var idx = fnIndexes[i];
                let thisFn = args[idx];
                if (thisFn.length == 8) {
                    newArgs[idx] = (err, req, res, next) => {
                        var requestID = req.headers['x-request-id'];
                        var handlerID = verifierLib.newHandlerID(requestID, thisFn.name);
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
                    newArgs[idx] = (req, res, next) => {
                        var requestID = req.headers['x-request-id'];
                        var handlerID = verifierLib.newHandlerID(requestID, thisFn.name);
                        var retEventTypes = [];
                        var objID = '';
                        return thisFn(requestID, handlerID, retEventTypes, objID, req, res, next);
                    }
                } else if (thisFn.length == 6) {
                    newArgs[idx] = (req, res) => {
                        var requestID = req.headers['x-request-id'];
                        var handlerID = verifierLib.newHandlerID(requestID, thisFn.name);
                        var retEventTypes = [];
                        var objID = '';
                        res.on('finish', () => {
                            Measurements.requestEnds(requestID);
                        })

                        return thisFn(requestID, handlerID, retEventTypes, objID, req, res);
                    }
                } else {
                    //make sure that it is not our function
                    assert(args[idx].length < 4 && functionType(thisFn) == 100);
                }
            }
            return thisArg[method](...newArgs);
        case 35: //it is _implicitHeader
            assert(
                fn != Reflect.apply &&
                fn != Function.prototype.call &&
                fn != Function.prototype.apply
            );
            if (functionType(thisArg.writeHead) == 1) { //our call
                var prev = thisArg.writeHead;
                thisArg.writeHead = function(...funcArgs) {
                    var [requestID, handlerID, retEventTypes, objID] = verifierLib.popContext();
                    return prev.call(
                        this,
                        requestID,
                        handlerID,
                        retEventTypes,
                        objID,
                        ...funcArgs
                    );
                }
            }
            return thisArg._implicitHeader(...args.map(x => verifierLib.getValueOf(x)));
        case 37: //It is express send
            return thisArg[method](...args)
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
                        var [requestID, handlerID, retEventTypes, objID] = verifierLib.popContext();
                        return args[1](requestID, handlerID, retEventTypes, objID);
                    } else {
                        assert(functionType(args[1]) == 100);
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
                let new_this = verifierLib.assignObjectID(thisArgOriginal, cftID, handlerID, true)
                // Modify the original object so that the read values are passed to the callee
                if (thisArgOriginal instanceof PrimitiveWrapper) {
                    if (new_this.karousos_x) {
                        thisArgOriginal.karousos_x = new_this.karousos_x;
                    } else {
                        thisArgOriginal.karousos_x = new_this;
                    }
                } else {
                    thisArgOriginal = new_this;
                }
            }

            var result = executeCall(
                isNew,
                thisArgNotNull,
                thisArgOriginal,
                method,
                fn,
                initArgs,
                createMultivalue,
            );
            if (fn == Array.prototype.push || fn == Map.prototype.set) {
                verifierLib.assignObjectID(thisArgOriginal, cftID, handlerID, false)
                // Assign the object id and isLoggable of the original to the result of
                // Map.prototype.set
                // so that the resulting multivalue is logged if needed
                if (
                    fn == Map.prototype.set &&
                    thisArgOriginal.isLoggable &&
                    result &&
                    result instanceof Multivalue
                ) {
                    defineProperty(result, 'isLoggable', true);
                    defineProperty(result, 'objID', thisArgOriginal.objID);
                }
            }
            if (fn == Object.create && initArgs[0] != Buffer.Buffer.prototype) {
                for (var prop in result) {
                    if (hasOwnProperty(result[prop], 'objID')) {
                        delete result[prop].objID
                    }
                }
            }
            if (fn == JSON.parse && result.karousos_value != undefined) {
                result = createMultivalue(result.karousos_value)
            }
            if (hasOwnProperty(result, 'objID'))
                result = verifierLib.assignObjectID(result, cftID, handlerID, false);
            setObjIDsAppropriately(cftID, handlerID, fn, thisArg, initArgs, this.assignObjectID);
            if (obj instanceof Promise && !obj.karContents && retEventTypes.length == 0) {
                var prom = verifierLib.createPromiseObject(cftID, handlerID);
                prom.karContents = result;
                verifierLib.setThen(prom);
                debug('returning prom', fn.name, prom);
                verifierLib.EmitAll(cftID, handlerID, prom.retEventTypes, 'success');
                return prom;
            }
            return result;
    }
}

// Emits the event the resolve/reject event associated with the promise and calls the function
function callTheResolveOrRejectFunction(cftID, handlerID, fn, arg) {
    cftID = getValueOf(cftID);
    if (fn.resolveEvent) {
        verifierLib.EmitAll(cftID, handlerID, fn.resolveEvent, 'success');
    } else {
        verifierLib.EmitAll(cftID, handlerID, fn.rejectEvent, 'fail');
    }
    return fn(arg && arg.karContents ? arg.karContents : arg);
}

// Read the recorded object by accessing accessDetector. Merge it with the
// previous object to retain its prototype
function accessObject_safe(cftID, hid, objID, value, isRead, doubleValue) {
    let info = verifierLib.popContext();
    verifierLib.pushContext(-2, globalHandler, [], "");
    var needToMerge = {
        value: false,
        return_init: false
    };
    var opnum = opcounts.get(cftID).get(hid.toString())
    opcounts.get(cftID).set(hid.toString(), opnum + 1);
    var objNew = applyToAllRidsInGroup(cftID, (rid, val, isMultivalue) => {
        let idx = opcounts.get(cftID).get(hid.hash) - 1;
        if (idx < 0) idx = "init";
        return accessDetector.accessObject(
            cftID,
            rid,
            hid,
            opnum,
            objID,
            val,
            isRead,
            doubleValue,
            idx,
            needToMerge,
            isMultivalue,
            false
        );
    }, [value, value.isMultivalue], false)
    if (value instanceof PrimitiveWrapper && value.karousos_x instanceof Array && objNew instanceof Multivalue) {
        objNew.objID = value.objID;
        defineProperty(objNew, 'isLoggable', true);
        return objNew;
    }
    if (needToMerge.return_init && value instanceof PrimitiveWrapper && value.karousos_x instanceof Array) {
        return value;
    }
    if (value instanceof Array || (value.karousos_x instanceof Array)) {
        var value2 = value.karousos_x ? value.karousos_x : value;
        for (let i = 0; i < value2.length; i++) {
            if (objNew[i] && value2[i].objID) {
                defineProperty(objNew[i], 'objID', value2[i].objID)
            }
        }
    }
    objNew = my_merge(objNew, value, needToMerge.value);
    // If the original value is loggable, the returned object should also be loggable
    if (value.isLoggable) {
        defineProperty(objNew, "isLoggable", true)
    }
    if (!objNew.objID) {
        defineProperty(objNew, "objID", objID)
    }
    verifierLib.pushContext(info[0], info[1], info[2], info[3])
    return objNew;
}

function convertType(fn, arg) {
    if (fn == Date.prototype.constructor) {
        return new Date(arg);
    }
    return arg;
}

//Operations on multivalues

exports.doBinaryOperation = function(op, val1, val2, inCondition, passObjID) {
    try {
        val1 = getValueOf(val1);
        val2 = getValueOf(val2);
        var ret;
        var fn = new Function('x', 'y', 'return x ' + op + ' y;');
        if (!areMultivalues(val1, val2)) {
            ret = fn(val1, val2);
        } else {
            let val1multi = val1 instanceof Multivalue ?
                val1 :
                (
                    val1 && val1.karousos_value ?
                    new Multivalue(val1.karousos_value) :
                    new Multivalue([val1])
                );
            let val2multi = val2 instanceof Multivalue ?
                val2 :
                (
                    val2 && val2.karousos_value ?
                    new Multivalue(val2.karousos_value) :
                    new Multivalue([val2])
                );
            ret = val1multi.doBinaryOperation(fn, val2multi);
            if (inCondition && ret instanceof Multivalue) {
                throw new Error('Not same result in condition', val1, val2);
            }
        }
        if (passObjID && hasOwnProperty(val1, 'objID') && !cannotAssignObjectID(ret)) {
            if (ret instanceof Object) {
                Object.defineProperty(ret, 'objID', {
                    value: val1.objID,
                    enumerable: false,
                    configurable: true
                });
            } else {
                ret.objID = val1.objID;
            }
        }
        return ret;
    } catch (err) {
        console.log(err);
        process.exit();
    }
}

exports.doUnaryOperation = function(op, val, before, inCondition) {
    val = getValueOf(val)
    try {
        var fn = before ?
            new Function('x', 'return ' + op + ' x;') :
            new Function('x', 'return x' + op + ';');
        if (!val || !isMultivalue(val)) {
            return fn(val);
        }
        if (!(val instanceof Multivalue)) val = new Multivalue(val.karousos_value);
        let ret = val.doUnaryOperation(fn);
        if (inCondition && ret instanceof Multivalue) {
            throw new Error('Not same result in condition', val);
        }
        return ret;
    } catch (err) {
        console.log(err);
        process.exit();
    }
}

// Wrap add reference to maintain context
function addReference_safe(cftID, hid, objIDold, objIDnew, isRead) {
    let info = verifierLib.popContext();
    verifierLib.pushContext(-2, globalHandler, [], "");
    var value = applyToAllRidsInGroup(cftID, (rid) => {
        let idx = opcounts.get(cftID).get(hid.toString()) - 1;
        if (idx < 0) idx = "init";
        return accessDetector.addReference(rid, hid, objIDold, objIDnew, idx, isRead);
    })
    verifierLib.pushContext(info[0], info[1], info[2], info[3])
    return value;
}

// Get the server's tag from the id that the verifier uses for this tag
function getCFT(cftID) {
    cftID = cftID.karousos_x ? cftID.karousos_x : cftID;
    return cftIDs[parseInt(cftID)];
}

// Upon the end, do the postprocessing: add the ww, rw, rw edges from accessDetector and
// check that the graph is acyclic
exports.end = function() {
    Measurements.write_advice_size()
    Measurements.postprocessStarts();
    accessDetector.addEdgesToGraph();
    graph.checkAcyclic();
    Measurements.postprocessEnds();
}


//check if object has a field called karousos value, it's ad-hoc for parsing the result
//this should only handle the parsing case of wiki.js
function checkKarousosField(object) {
    let ret = false;
    for (let x in object) {
        if (object[x].karousos_value) {
            ret = true
            break;
        }
    }
    return ret;
}
// Check that the response produce by re-exec is the one in the trace
exports.checkResponse = function(cftID, response) {
    try {
        if (typeof response == "string" && response.includes("karousos_value")) {
            var parsed_resp = JSON.parse(response);
            //console.log(parsed_resp)
            if (parsed_resp.karousos_value) {
                response = new Multivalue(parsed_resp.karousos_value);
            } else if (typeof parsed_resp === typeof {} && checkKarousosField(parsed_resp)) {
                // the parsed_resp if an object with one of the field have karousos_value
                // convert to an array of object
                // with only one field - karousos_value, which is a string
                var arr_len = 1;
                for (let x in parsed_resp) {
                    if (parsed_resp[x].karousos_value) {
                        arr_len = parsed_resp[x].length;
                        break;
                    }
                }
                var resp_as_multivalue = new Array(arr_len)
                for (let i = 0; i < resp_as_multivalue.length; i++) resp_as_multivalue[i] = {}

                //if 'x' is the field of karousos_value
                for (let x in parsed_resp) {
                    if (parsed_resp[x].karousos_value) {
                        for (let i = 0; i < arr_len; i++) {
                            resp_as_multivalue[i][x] = parsed_resp[x].karousos_value[i]
                        }
                    }
                    //directly copy the field
                    else {
                        for (let i = 0; i < arr_len; i++) {
                            resp_as_multivalue[i][x] = parsed_resp[x]
                        }
                    }
                }
                response = {
                    karousos_value: resp_as_multivalue
                }
            } else {
                //Response is an array and one of its elements is a multivalue.
                //Convert the response to a multivalue;
                //First find the length of the array
                var arr_len = 1;
                for (let x of parsed_resp) {
                    if (x.karousos_value) {
                        arr_len = x.length;
                        break;
                    }
                    for (let prop in x) {
                        if (x[prop].karousos_value) {
                            arr_len = x[prop].length;
                            break;
                        }
                    }
                }
                var resp_as_multivalue = Array.apply(null, Array(arr_len)).map(() => {
                    return new Array()
                });
                for (let x of parsed_resp) {
                    if (x.karousos_value) {
                        assert(x.length == arr_len);
                        for (let i = 0; i < arr_len; i++) {
                            resp_as_multivalue[i].push(x.karousosValue[i])
                        }
                    } else {
                        var isMultivalue = false;
                        for (let prop in x) {
                            if (x[prop].karousos_value) {
                                isMultivalue = true;
                                break;
                            }
                        }
                        for (let i = 0; i < arr_len; i++) {
                            if (isMultivalue) {
                                var toAdd = {};
                                for (let prop in x) {
                                    if (x[prop].karousos_value) {
                                        toAdd[prop] = x[prop].karousos_value[i]
                                    } else {
                                        toAdd[prop] = x[prop]
                                    }
                                }
                                resp_as_multivalue[i].push(toAdd);
                            } else {
                                resp_as_multivalue[i].push(x)
                            }
                        }
                    }
                }
                response = new Multivalue(resp_as_multivalue.map(x => {
                    return JSON.stringify(x)
                }));
            };
        }

        applyToAllRidsInGroup(cftID, (rid, resp) => {
            try {
                if (process.env.EXPERIMENT == "message" || process.env.EXPERIMENT == "delay_first_write_micro") {
                    assert(ridToResponse.has(rid) && ridToResponse.get(rid) == resp);
                } else {
                    assert(ridToResponse.has(rid) && ridToResponse.get(rid) == Base64.encode(resp));
                }
            } catch (err) {
                console.log(err);
                if (process.env.EXPERIMENT == "message") {
                    console.log(ridToResponse.get(rid), resp);
                } else {
                    console.log("Response should be:", Base64.decode(ridToResponse.get(rid)));
                    console.log("Response is:", resp)
                }
                throw err
            }
        }, [response])
    } catch (err) {
        console.log(err);
        console.trace();
        process.exit();
    }
}

// Apply the function fn of all requests in the group cftID with the given arguments
// noMultivalue is true iff this function returns a single element and not a multivalue
function applyToAllRidsInGroup(cftID, fn, args, noMultivalue) {
    if (!args) args = [];
    if (!reportCollectionActivated(cftID)) return fn(cftID, ...args);
    var requestIDs = cfg.get(parseInt(cftID));
    var ret = requestIDs.map((rid, i) => {
        var thisArgs = args == undefined || args == null ? [] :
            thisArgs = args.map(x => getIthElementInMultivalue(x, i));
        return fn(rid, ...thisArgs);
    })
    if (noMultivalue) {
        return args[0];
    }
    if (ret[0] == undefined) {
        return undefined;
    }
    var result = createMultivalue(ret, noMultivalue);
    return result;
}


var Base64 = {

    /**
     *
     *  Base64 encode / decode
     *  http://www.webtoolkit.info/
     *
     **/

    // private property
    _keyStr: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",

    // public method for encoding
    encode: function(input) {
        if (typeof input === typeof {}) input = JSON.stringify(input)
        var output = "";
        var chr1, chr2, chr3, enc1, enc2, enc3, enc4;
        var i = 0;

        input = Base64._utf8_encode(input);

        while (i < input.length) {

            chr1 = input.charCodeAt(i++);
            chr2 = input.charCodeAt(i++);
            chr3 = input.charCodeAt(i++);

            enc1 = chr1 >> 2;
            enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
            enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
            enc4 = chr3 & 63;

            if (isNaN(chr2)) {
                enc3 = enc4 = 64;
            } else if (isNaN(chr3)) {
                enc4 = 64;
            }

            output = output +
                this._keyStr.charAt(enc1) + this._keyStr.charAt(enc2) +
                this._keyStr.charAt(enc3) + this._keyStr.charAt(enc4);
        }
        return output;
    },

    // public method for decoding
    decode: function(input) {
        var output = "";
        var chr1, chr2, chr3;
        var enc1, enc2, enc3, enc4;
        var i = 0;

        input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");

        while (i < input.length) {

            enc1 = this._keyStr.indexOf(input.charAt(i++));
            enc2 = this._keyStr.indexOf(input.charAt(i++));
            enc3 = this._keyStr.indexOf(input.charAt(i++));
            enc4 = this._keyStr.indexOf(input.charAt(i++));

            chr1 = (enc1 << 2) | (enc2 >> 4);
            chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
            chr3 = ((enc3 & 3) << 6) | enc4;

            output = output + String.fromCharCode(chr1);

            if (enc3 != 64) {
                output = output + String.fromCharCode(chr2);
            }
            if (enc4 != 64) {
                output = output + String.fromCharCode(chr3);
            }
        }

        output = Base64._utf8_decode(output);

        return output;
    },

    // private method for UTF-8 encoding
    _utf8_encode: function(string) {
        string = string.replace(/\r\n/g, "\n");
        var utftext = "";

        for (var n = 0; n < string.length; n++) {

            var c = string.charCodeAt(n);

            if (c < 128) {
                utftext += String.fromCharCode(c);
            } else if ((c > 127) && (c < 2048)) {
                utftext += String.fromCharCode((c >> 6) | 192);
                utftext += String.fromCharCode((c & 63) | 128);
            } else {
                utftext += String.fromCharCode((c >> 12) | 224);
                utftext += String.fromCharCode(((c >> 6) & 63) | 128);
                utftext += String.fromCharCode((c & 63) | 128);
            }
        }
        return utftext;
    },

    // private method for UTF-8 decoding
    _utf8_decode: function(utftext) {
        var string = "";
        var i = 0;
        var c = 0;
        var c1 = 0;
        var c2 = 0;

        while (i < utftext.length) {

            c = utftext.charCodeAt(i);

            if (c < 128) {
                string += String.fromCharCode(c);
                i++;
            } else if ((c > 191) && (c < 224)) {
                c2 = utftext.charCodeAt(i + 1);
                string += String.fromCharCode(((c & 31) << 6) | (c2 & 63));
                i += 2;
            } else {
                c2 = utftext.charCodeAt(i + 1);
                c3 = utftext.charCodeAt(i + 2);
                string += String.fromCharCode(((c & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));
                i += 3;
            }
        }
        return string;
    }
}