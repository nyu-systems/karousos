"use strict";

require("./init_async_emit")();
exports.builtins = require("./builtins");
exports.commonClasses = require("./commonClasses");

const {
    initSeenFns,
    markTheResRejFunctions,
    functionType,
    getSuperFunctionType,
    getSuperMethodFunctionType,
    saveFunctionInitType,
} = require('./function_types');

exports.markTheResRejFunctions = markTheResRejFunctions;
exports.functionType = functionType;
exports.getSuperFunctionType = getSuperFunctionType;
exports.getSuperMethodFunctionType = getSuperMethodFunctionType;
exports.saveFunctionInitType = saveFunctionInitType;
exports.initSeenFns = initSeenFns;

const {
    reportCollectionActivated,
    reportCollectionDeactivated,
    shouldSkip,
    pushContext,
    popContext,
    makeUid,
    uidHasRid,
    defineProperty,
    assignProperty,
    hasOwnProperty,
    findLength,
    setObjIDsAppropriately,
    toEventStr,
    desymbolize,
    convertSymbols,
    getRequestID,
    maybeReturnPromise,
    mapToObject,
} = require('./general');

exports.reportCollectionActivated = reportCollectionActivated;
exports.reportCollectionDeactivated = reportCollectionDeactivated;
exports.shouldSkip = shouldSkip;
exports.pushContext = pushContext;
exports.popContext = popContext;
exports.makeUid = makeUid;
exports.defineProperty = defineProperty;
exports.assignProperty = assignProperty;
exports.hasOwnProperty = hasOwnProperty;
exports.findLength = findLength;
exports.setObjIDsAppropriately = setObjIDsAppropriately;
exports.toEventStr = toEventStr;
exports.uidHasRid = uidHasRid;
exports.desymbolize = desymbolize;
exports.convertSymbols = convertSymbols;
exports.getRequestID = getRequestID;
exports.maybeReturnPromise = maybeReturnPromise;
exports.mapToObject = mapToObject;

const {
    newFunction,
    handleRequire
} = require('./parser_functions');

exports.newFunction = newFunction;
exports.handleRequire = handleRequire;

const {
    getHandlerIDforObjectID,
    setHandlerIDforObjectID,
    initGeneratorHelpers,
    deleteGeneratorHelpers,
} = require('./generator_utils');

exports.getHandlerIDforObjectID = getHandlerIDforObjectID;
exports.setHandlerIDforObjectID = setHandlerIDforObjectID;
exports.initGeneratorHelpers = initGeneratorHelpers;
exports.deleteGeneratorHelpers = deleteGeneratorHelpers;

const {
    createPromiseObject,
    isPromiseSuperObject,
    checkNotPromise,
    isNativePromise,
    setThen,
    initPromiseMethodsForRid,
    deletePromiseMethodsForRid,
    addPromiseMethod,
    getAllEventsForFinally,
    getAllEventsForCatch,
    getAllEventsForThen,
    findLastThenPriorToCatch,
    exportContents,
} = require('./promise_utils');

exports.createPromiseObject = createPromiseObject;
exports.isPromiseSuperObject = isPromiseSuperObject;
exports.checkNotPromise = checkNotPromise;
exports.isNativePromise = isNativePromise;
exports.setThen = setThen;
exports.initPromiseMethodsForRid = initPromiseMethodsForRid;
exports.deletePromiseMethodsForRid = deletePromiseMethodsForRid;
exports.addPromiseMethod = addPromiseMethod;
exports.getAllEventsForFinally = getAllEventsForFinally;
exports.getAllEventsForCatch = getAllEventsForCatch;
exports.getAllEventsForThen = getAllEventsForThen;
exports.findLastThenPriorToCatch = findLastThenPriorToCatch;
exports.exportContents = exportContents;

const {
    initObjNums,
    initObjNumForHid,
    initObjNumForRid,
    createObjectID,
    flushObjNums,
} = require("./object_ids");

exports.initObjNums = initObjNums;
exports.initObjNumForHid = initObjNumForHid;
exports.initObjNumForRid = initObjNumForRid;
exports.createObjectID = createObjectID;
exports.flushObjNums = flushObjNums;

const {
    initEventsForObject,
    newEventForObject,
    createAwaitRetEvtType,
    initAwaitRetEvtType,
    getEmitterEvents,
    getListeners,
    flushDataOnEvents,
} = require("./event_names");

exports.initEventsForObject = initEventsForObject;
exports.newEventForObject = newEventForObject;
exports.createAwaitRetEvtType = createAwaitRetEvtType;
exports.initAwaitRetEvtType = initAwaitRetEvtType;
exports.getEmitterEvents = getEmitterEvents;
exports.getListeners = getListeners;
exports.flushDataOnEvents = flushDataOnEvents;