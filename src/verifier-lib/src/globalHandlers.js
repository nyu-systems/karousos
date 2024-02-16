"use strict";

// This file contains functions that we use to keep track of the handler ids 
// of global handlers that are activated by requests

const assert = require('assert');
const {
    toEventStr
} = require(process.env.KAR_HOME + '/src/karousos_utils');
const {
    reportCollectionActivated,
    makeUid
} = require(process.env.KAR_HOME + '/src/karousos_utils');

var globalHandlers; // map from events to the handlers that are listening for these events

module.exports = {
    initialize,
    register,
    emit,
    inspectActivatedHandlersForEvt,
    getActivatedHandler,
}

function initialize() {
    globalHandlers = new Map();
}

// Called when a global handler is registered
function register(cftID, eType, success, fname, forAlreadyEmitted, emittedEvents) {
    try {
        if (success == 'any') {
            register(cftID, eType, 'success', fname, forAlreadyEmitted);
            register(cftID, eType, 'fail', fname, forAlreadyEmitted);
        }
        var evt = eType.toString() + ':' + success.toString();
        var prev = globalHandlers.get(evt);
        if (!prev) {
            globalHandlers.set(evt, new Map());
            prev = new Map();
        }
        globalHandlers.get(evt).set(fname);
        //initialize the global handlers with the already emitted events
        if (forAlreadyEmitted) {
            let alreadyEmittedEvts = emittedEvents.get(makeUid(cftID, eType));
            if (alreadyEmittedEvts != undefined) {
                alreadyEmittedEvts.forEach((inf) => {
                    emit(eType, success, inf, cftID);
                })
            }
        }
    } catch (err) {
        console.log(err);
        process.exit();
    }
}

// Called to check if the event is activating any global handlers
// if so, it adds info the globalHandlers[evt][fname] to indicate that the handler 
// with information in info is activated
function emit(eType, success, info, cftID) {
    try {
        assert(info != undefined && info.hid != undefined);
        if (success == 'any') {
            emit(eType, 'success', info, cftID);
            emit(eType, 'fail', info, cftID);
            return;
        }

        var evt = eType.toString() + ':' + success.toString();
        var ret = [];
        // Initialize globalHandlers[evt] if it is not initialized
        if (!reportCollectionActivated(cftID)) {
            if (!globalHandlers.has(evt)) globalHandlers.set(evt, new Map());
        }
        // Check if there are any registered handlers for the event. If not, return
        if (!globalHandlers.has(evt)) return ret;
        // get the ids of the functions that are registered for the emitted event 
        var handlers = Array.from(globalHandlers.get(evt).keys());
        // Update globalHandlers by adding the information of the new emitted event to 
        // globalHandlers[evt][fname]
        var newMap = new Map();
        handlers.forEach(h => {
            var prev = globalHandlers.get(evt).get(h) || [];
            newMap.set(h, prev.concat(info));
        });
        globalHandlers.set(evt, newMap);
    } catch (err) {
        console.log(err);
        process.exit();
    }
}

// Inspect all activated handlers from an event.
function inspectActivatedHandlersForEvt(eType, success) {
    if (success == 'any') {
        return inspectActivatedHandlersForEvt(eType, 'success').concat(
            inspectActivatedHandlersForEvt(eType, 'fail')
        );
    }
    if (eType.objNum == -1) return [];
    var evt = eType.toString() + ':' + success.toString();
    return Array.from((globalHandlers.get(evt) || new Map()).keys());
}

// Returns an activated handler for the event and specified function
function getActivatedHandler(eType, success, fname, isThen) {
    if (success == 'any') {
        return getActivatedHandler(eType, 'success', fname, isThen) ||
            getActivatedHandler(eType, 'fail', fname, isThen);
    }
    var evt = eType.toString() + ':' + success.toString();
    if (globalHandlers.has(evt) && globalHandlers.get(evt).has(fname)) {
        var ret = globalHandlers.get(evt).get(fname);
        if (ret) {
            // HACK
            if (ret.length > 0 && !isThen) {
                globalHandlers.get(evt).set(fname, ret.slice(1));
            }
            return ret[0];
        }
    }
    return undefined;
}