"use strict";

// This file contains functions we use to determine the type of each function
// e.g. user-defined, builtIn, type of builtin (is it synchronous, deterministic,
// does it take callbacks as arguments etc)

const builtins = require('./builtins');
const assert = require('assert');
const commonDetSyncCallToJsBuiltIn = builtins.commonDetSyncCallToJsBuiltIn
const generatorFuncProto = Object.getPrototypeOf(function*() {});
const asyncFuncProto = Object.getPrototypeOf(async function() {});
const net = require('net');
const util = require('util');
const http = require('http');
const mode = parseInt(process.env.ADVICE_MODE || 0) //what advice to collect;
// Map in which we memorize the types of all functions
var seenFns = new Map()

// Initialize the functions that have been encountered
exports.initSeenFns = function() {
    seenFns = new Map();
}

// Gets as input an object x and sets the resolve event to the input
// res and the reject event to the input rej 
exports.markTheResRejFunctions = function(x, rej, res) {
    if (mode >= 5) return;
    if (x) {
        x.resolveEvent = res;
    }
    if (x) {
        x.rejectEvent = rej;
    }
}

// When we bind a function it becomes native and we can no longer determine its type
// We use this function to set the type of the binded function to the original function
exports.saveFunctionInitType = function(funcAfterBind, funcBeforeBind) {
    funcAfterBind.function_before_bind = funcBeforeBind;
}

// Find the type of the super function
exports.getSuperFunctionType = function(superClass) {
    if (mode >= 5) return 100;
    // First check the prototype, otherwise the function itself
    if (superClass.prototype != undefined) {
        return functionType(superClass.prototype.constructor);
    }
    return functionType(superClass.constructor);
}

// Find the type of the super's method function
exports.getSuperMethodFunctionType = function(superMethod) {
    if (mode >= 5) return 100;
    var type = functionType(superMethod);
    // we only handle cases where the super method is synchronous, deterministic builtIn 
    // or user-defined
    assert(type == 1 || type == 100);
    return type;
}

// Try to find the function type by first reading from seenFns and doing some simple checks. 
// If we don't find it, then call functionType_inner
var functionType = function(func, args, isNew, thisArg, method) {
    // The functions that are marked as fromPromiseInternal and isNewFunction are 
    // user-defined so return 1
    if (func.fromPromiseInternal != undefined || func.isNewFunction) {
        return 1;
    }
    // check if they are the resolve/reject functions
    if (func.resolveEvent || func.rejectEvent) {
        return 26;
    }
    // Try to find the function in the memorized functions
    if (seenFns.has(func)) {
        return seenFns.get(func);
    }
    // You are not expected to expected to understand this
    try {
        if (seenFns.size > 10000 && seenFns.has(func.toString())) {
            return seenFns.get(func.toString());
        }
    } catch (err) {}
    // Inspect the function to find its function type
    let f_type = functionType_inner(func, args, isNew, thisArg, method);
    seenFns.set(func, f_type);
    // You are not expected to understand this
    if (seenFns.size > 10000) {
        seenFns.set(func.toString(), f_type);
    }
    return f_type;
}

exports.functionType = functionType;

//Returns function type. Multiple function types. Most important:
//0: call to a weird call we cannot handle
//1: call to a user function
//100: call to syncronous builtin (deterministic and no callback)
var functionType_inner = function(func, args, isNew, thisArg, method) {
    assert(func != undefined);
    // If it is marked as new function, it is user-defined
    if (func.isNewFunction) {
        return 1;
    }

    // Convert the function to a string
    var funcStr = toString(func);

    // Check if this is a binded function. Try to find the original function and set 
    // the function that we check for its type to the original function
    if (funcStr.includes("native code")) {
        var isNative = true;
        while (func.function_before_bind) {
            func = func.function_before_bind;
            funcStr = toString(func);
            if (!funcStr.includes('native code')) {
                isNative = false;
                break;
            }
        }
    }

    //check if we are calling a constructor.
    if (funcStr.startsWith('class')) {
        if (funcStr.includes('constructor(')) {
            funcStr = funcStr.substring(funcStr.indexOf('constructor'));
        } else {
            if (funcStr.includes('extends')) {
                if ((funcStr).includes('requestID')) return 1;
                return 100;
            }
        }
    }

    // If the function has requestID as argument return 1
    if (hasRequestIDasArg(funcStr)) {
        return 1;
    }
    // Check the most common builtin functions and exit early if the function is there
    if (commonDetSyncCallToJsBuiltIn.has(func)) return 100;
    // Check for different function types
    if (process.env.IS_VERIFIER == "true" && builtins.callsToExpressSend(func)) {
        return 37;
    }
    if (builtins.emitFns.has(func)) {
        return 23;
    }
    if (func == Promise.prototype.then) {
        return 3;
    }
    if (func == Promise.prototype.catch) {
        return 4;
    }
    if (func.resolveEvent || func.rejectEvent) {
        return 26;
    }
    // Check for express. It is a call to express if the below call returns an array
    var indexes = builtins.isCallToExpressMethod(func, args);
    if (indexes instanceof Array) {
        if (indexes.length == 0) {
            return 100; //basically a native function
        } else {
            return 34;
        }
    }
    // We do not handle calls that use apply and call more than 1 times e.g. x.apply.call
    if (func == Function.prototype.apply ||
        func == Function.prototype.call) {
        return 0;
    }
    if (func == Promise.prototype.constructor) {
        return 2;
    }

    if (func == Promise.prototype.finally) {
        return 5;
    }
    if (func == Promise.all || func == Promise.race) {
        return 6;
    }
    if (func == Promise.reject || func == Promise.resolve) {
        return 7;
    }
    if (func == Function.prototype.bind) {
        return 9;
    }
    if (
        [Function.prototype.constructor,
            generatorFuncProto.constructor,
            asyncFuncProto.constructor
        ]
        .includes(func) &&
        !hasRequestIDasArg(funcStr)
    ) {
        return 10;
    }
    if (func == eval) {
        return 11;
    }
    if (func == generatorFuncProto.prototype.next) {
        return 12;
    }
    if ((func == JSON.parse || func == JSON.stringify) && !(hasRequestIDasArg(funcStr))) {
        return 13;
    }
    if (builtins.assertRejectOrThrow.has(func)) {
        return 14;
    }
    if (builtins.nonDetSyncCallToJsBuiltIn.has(func)) {
        return 15;
    }
    if (builtins.detNodeBuiltInsWithCb.has(func)) {
        return 16;
    }
    if (builtins.nonDetNodeBuiltInsWithCb.has(func)) {
        return 17;
    }
    if (builtins.forEachTable.has(func)) {
        return 18;
    }
    if (builtins.detNodeBuiltInRetPromise.has(func) || func.promisified) {
        return 19;
    }
    if (builtins.nonDetNodeBuiltInRetPromise.has(func)) {
        return 20;
    }
    //HACK Below to be able to handle connections returned from http with custom on
    if (
        builtins.registerFns.has(func) ||
        (thisArg && thisArg instanceof net.Socket && method == 'on')
    ) {
        return 21;
    }
    if (builtins.unregisterFns.has(func)) {
        return 22;
    }
    if (builtins.inspectHandlersFns.has(func)) {
        return 24;
    }
    if (builtins.eventsOnceFns.has(func)) {
        return 25;
    }
    if (builtins.scheduleTimerFns.has(func)) {
        return 27;
    }
    if (func == String.prototype.replace && typeof args[args.length - 1] == 'function') {
        return 28;
    }
    if (builtins.clearTimerFns.has(func)) {
        return 29;
    }
    if (builtins.objectKeys.has(func)) {
        return 30;
    }
    if (builtins.isRequire(func)) {
        return 31;
    }
    if (func == util.debuglog) {
        return 32;
    }
    if (func == util.promisify) {
        return 33;
    }
    if (func == http.ServerResponse.prototype._implicitHeader) {
        return 35;
    }
    if (func.name == 'specialThen') return 1;

    return 100;
    // UNCOMMENT ABOVE LINE IF YOU NEED TO CHECK THAT WE DON'T CALL AN UNSUPPORTED FUNCTION
    if (!detSyncCallToJsBuiltIn.concat([origCwd, require('process').binding]).includes(func) &&
        !builtins.constructor_strings.includes(funcStr) &&
        !isNative && toString(func).indexOf('extends') == -1 &&
        !(['set', 'get', 'postProcessResponse', 'toString', 'toJSON'].includes(func.name)) &&
        !func.isDebugLogi && !func.name == 'specialThen') {
        console.log('args', getParamNames(func), toString(func), toString(origCwd));
        console.log(funcStr.includes('requestID'));
        console.log(func.name)
        console.trace();
        process.exit()
    }
    return 100;
}

function toString(func) {
    if (func instanceof Function)
        return Function.prototype.toString.call(func);
    return func.toString();
}

// Checks if the function has requestID as argument which implies that 
// it is user-defined
function hasRequestIDasArg(funcStr) {
    var fnStr = funcStr.slice(0, funcStr.indexOf('\n'))
    return fnStr.includes('requestID');
}