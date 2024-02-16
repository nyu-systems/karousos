"use strict";

const babelHelp = require('@babel/helper-plugin-utils');
const t = require('@babel/types');
const assert = require('assert');
const debug = require('debug')('add-rep-col');
const prom = require('./promise-babel');
const ret = require('./returns-babel');
const assertMod = require('./node-assert')
const requireMod = require('./require-handler')
const callbackHandler = require('./callback')
const mode = parseInt(process.env.ADVICE_MODE || 0) //what advice to collect;
const inspect = require('./utils/inspect');
const bookkeeping = require('./utils/bookkeeping');
const karousos = require('./utils/karousos');
const express = require('./utils/expressFuncs');
const nodeBuiltIns = require('./utils/nodeBuiltIns');
const builders = require('./utils/builders');
const modifiers = require('./utils/modifiers');

exports.handleCall = function(path, state) {
    // if it is inside a while condition or in a function declaration
    // then check if it is a call to karousos module and, if not, handle it as a general call
    if (inspect.inWhileCondition(path) || inspect.inFunctionDeclaration(path)) {
        if (!karousos.isCallToReportsCol(path)) {
            karousos.handleGeneralCall(path, state);
        }
        bookkeeping.markVisited(path);
        return;
    }

    // We don't handle calls to conditional expressions
    assert(!inspect.inConditionalExpression(path));

    // check if we need to move the call to another statement. 
    // if so, move it and return
    if (callMovedInSeparateStmt(path)) {
        return;
    }

    //get any calls out of the callee
    getCallOut(path.get('callee'));

    //if there are any calls as arguments, put them as separate calls before this call and
    //save the results of the calls
    formatArgs(path);
    //if the callee is a complex expression then put it in a separate statemenent	
    if (
        t.isCallExpression(path.node.callee) ||
        t.isNewExpression(path.node.callee) ||
        t.isConditionalExpression(path.node.callee) ||
        t.isSequenceExpression(path.node.callee)
    ) {
        modifiers.putInSeparateStatement(path.get('callee'));
    }
    // if the callee is a member expression, replace all of its parts with identifiers
    if (t.isMemberExpression(path.node.callee)) {
        modifiers.replaceWithIdentifiers(path.get('callee'));
    }

    // check if it has a callback, what is the callback index, and how many arguments 
    // the callback takes
    var [isNodeBuiltInWithCb, callbackInd, argNo] = karousos.isCallWithCallback(path, state);

    // Check if you can infer any information about the call. If so, handle it accordingly
    // Otherwise wrap it in a call to karousosModule.callFunction
    if (inspect.isSuperMethod(path.get('callee'))) {
        handleSuperMethod(path, state);
    } else if (t.isSuper(path.node.callee)) {
        handleSuper(path, state);
    } else if (isNodeBuiltInWithCb) {
        callbackHandler.handleCallbacks(path, state, callbackInd, argNo, false);
    } else if (nodeBuiltIns.isUtilCallbackify(path, state)) {
        callbackHandler.handleCallbackify(path, state);
    } else if (inspect.isRequire(path, state)) {
        requireMod.handleRequire(path, state);
    } else if (nodeBuiltIns.isAssertRejectOrThrow(path, state)) {
        assertMod.handleAssertRejectOrThrow(path, state);
    } else if (inspect.isReflectConstructOfPromise(path)) {
        prom.handleNewPromise(path, state, true);
    } else if (nodeBuiltIns.isSetUncaughtExceptionCaptureCallback(path, state)) {
        modifiers.replaceWithFunctionExpression(path, 0, 1);
        path.get('arguments')[0].get('body').unshiftContainer(
            'body',
            t.throwStatement(t.stringLiteral('Uncaught excpeption capture callback was invoked '))
        );
    } else if (nodeBuiltIns.isCallToEventsOnce(path, state)) {
        prom.handleEventsOnce(path, state);
    } else if (nodeBuiltIns.isCallToDetNodeCorePromiseEmitEvent(path, state)) {
        prom.handleCallToNodeCorePromiseEmitEvent(path, state, false);
    } else if (inspect.isPromiseRaceOrAll(path)) {
        if (prom.handlePromiseRaceOrAll(path, state) == -1) {
            karousos.handleGeneralCall(path, state);
            bookkeeping.markVisited(path);
        }
        //none of our candidate applications use it. 
    } else if (
        inspect.isAtomicWait(path) ||
        inspect.isAtomicNotify(path) ||
        inspect.isCallToAtomics(path)) {
        throw new Error('Atomics not supported');
    } else if (!karousos.isDetSyncCallToCore(path, state) && !karousos.isInReturn(path, state)) {
        //if the call is in return then we do nothing. When the return is parsed it will take care
        // of everything
        if (mode < 6) karousos.handleGeneralCall(path, state);
        bookkeeping.markVisited(path);
    }
}

//Handle calls to the resolve/reject function
function handleCallToTheResolveOrRejectFunction(path, state) {
    var successRes = karousos.isTheRejectFunction(path, state) ? 'fail' : 'success';
    prom.addEmitBeforeResolveOrReject(path, state, successRes);
}

// Recursively checks if the node contains any calls and, if so, moves them 
// to separate statements, replacing them in the node with the results.
function getCallOut(path) {
    if (!path) return
    if (t.isCallExpression(path) || t.isNewExpression(path) ||
        t.isConditionalExpression(path) || t.isSequenceExpression(path)) {
        modifiers.putInSeparateStatement(path);
    }
    if (t.isMemberExpression(path)) {
        getCallOut(path.get('object'));
        getCallOut(path.get('property'));
    }
    if (t.isArrayExpression(path)) {
        for (let i = 0; i < path.node.elements.length; i++) {
            getCallOut(path.get('elements')[i])
        }
    }
    if (t.isAssignmentExpression(path)) {
        getCallOut(path.get('right'))
    }
    if (t.isBinaryExpression(path)) {
        getCallOut(path.get('left'))
        getCallOut(path.get('right'))
    }
    if (t.isUnaryExpression(path)) {
        getCallOut(path.get('argument'))
    }
}

//check if call needs to be moved in separate stmt and, if so, move it.
function callMovedInSeparateStmt(path) {
    if (
        karousos.isCallToReportsCol(path) ||
        t.isExpressionStatement(path.parent) ||
        (
            t.isVariableDeclarator(path.parent) &&
            !t.isObjectPattern(path.parent.id) &&
            !t.isArrayPattern(path.parent.id)
        ) ||
        (
            t.isAssignmentExpression(path.parent) &&
            !t.isObjectPattern(path.parent.left) &&
            !t.isArrayPattern(path.parent.left)
        ) ||
        t.isAssignmentPattern(path.parent)
    ) {
        return false;
    }
    assert(!t.isSequenceExpression(path.parent))
    modifiers.putInSeparateStatement(path);
    return true;
}

// moves arguments in separate statements if needed
function formatArgs(path) {
    var isFilter = inspect.propertyOneOf(inspect.findCallee(path), 'filter');
    karousos.formatArgsRec(path, path.get('arguments'), isFilter);
}

// Replace a call to super 
// with if (check type of constructor)
// call super without request id
// else
// call super with request id
function handleSuper(path, state) {
    assert(state.superName != undefined);
    assert(t.isExpressionStatement(path.parent));
    var callFunctionType = karousos.buildGetSuperFunctionType(state.superName);
    var isNative = t.binaryExpression('==', callFunctionType, t.numericLiteral(100));
    var ifStmt = builders.buildIfStatement(
        isNative,
        t.expressionStatement(path.node),
        builders.buildCallStatement(
            t.super(),
            null,
            ([
                t.identifier('requestID'),
                t.identifier('handlerID'),
                t.identifier('retEventTypes'),
                t.identifier('objID')
            ].concat(bookkeeping.copy(path.node.arguments)))
        )
    );
    var parentPath = path.parentPath;
    parentPath.replaceWith(ifStmt);
    bookkeeping.markVisited(parentPath);
    bookkeeping.markVisited(parentPath.get('consequent').get('expression'));
    bookkeeping.markVisited(parentPath.get('alternate').get('expression'));
}

// Similar to the previous function but for methods of the super
function handleSuperMethod(path, state) {
    assert(
        t.isExpressionStatement(path.parent) ||
        t.isVariableDeclarator(path.parent) ||
        t.isAssignmentExpression(path.parent)
    );
    var callFunctionType = karousos.buildGetSuperMethodFunctionType(path.node.callee);
    var isNative = t.binaryExpression('==', callFunctionType, t.numericLiteral(100));
    var ifStmt = t.conditionalExpression(isNative,
        path.node,
        builders.buildCall(
            path.node.callee.object,
            path.node.callee.property,
            ([
                t.identifier('requestID'),
                t.identifier('handlerID'),
                t.identifier('retEventTypes'),
                t.identifier('objID')
            ].concat(bookkeeping.copy(path.node.arguments)))
        )
    );
    path.replaceWith(ifStmt);
    bookkeeping.markVisited(path);
    bookkeeping.markVisited(path.get('test'));
    bookkeeping.markVisited(path.get('test').get('left'));
    bookkeeping.markVisited(path.get('consequent'));
    bookkeeping.markVisited(path.get('alternate'));
}