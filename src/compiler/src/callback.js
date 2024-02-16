"use strict";

const t = require('@babel/types');
const assert = require('assert');
const debug = require('debug')('add-rep-col');
const karousos = require('./utils/karousos');
const modifiers = require('./utils/modifiers');
const bookkeeping = require('./utils/bookkeeping');
const builders = require('./utils/builders');

module.exports = {
    handleCallbacks(path, state, callbackInd, argNo, isNonDet) {
        if (callbackInd < 0) return;
        //if the callback is not a function expression, replace it with a function expression
        modifiers.replaceWithFunctionExpression(path, callbackInd, argNo);
        //add id to the function expression
        var functionId = karousos.addIdToFunctionExpression(path.get('arguments')[callbackInd]).name;
        //Register and emit the appropriate event prior to the function call
        var objID = builders.generateUid(path, 'objID');
        var evtTypes = t.arrayExpression([objID]);
        modifiers.insertBefore(path, [
            karousos.buildCreateObjectID(path, objID),
            karousos.buildRegisterEvent(functionId, evtTypes, 'success'),
            karousos.buildEmitEvent('success', undefined, evtTypes)
        ]);
        var initArgs = bookkeeping.copy(path.node.arguments);
        //add new parameters to the callback some of the are fixed e.g. requestID, handlerID
        karousos.addParamsToCallback(path.get('arguments')[callbackInd], t.arrayExpression([]), t.stringLiteral(''));
        //Inside the function, the program should first search for its handlerID
        var toAdd = [karousos.buildGetHandlerID(functionId, evtTypes, 'success', state.opts.isVerifier, initArgs[callbackInd].params)];
        //if it is a non deterministic callback, read the non deterministic op 
        if (isNonDet) {
            toAdd.push(karousos.buildRecordNonDetOp(t.arrayExpression(initArgs)));
        }
        path.get('arguments')[callbackInd].get('body').unshiftContainer('body', toAdd);
    },

    handleCallbackify(path, state) {
        // we do not handle callbackify
        path.getStatementParent().insertAfter(t.throwStatement(t.stringLiteral('callbackify not supported')));
    },

}