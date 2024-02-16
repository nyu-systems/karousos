"use strict";

const t = require('@babel/types');
const debug = require('debug')('add-rep-col');
const assert = require('assert')
const inspect = require('./utils/inspect');
const bookkeeping = require('./utils/bookkeeping');
const modifiers = require('./utils/modifiers');
const builders = require('./utils/builders');
const karousos = require('./utils/karousos');
const nodeBuiltIns = require('./utils/nodeBuiltIns');

module.exports = {
    handleNewPromise,
    handleInternalOfNewPromise,
    handlePromiseRaceOrAll,
    handlePromiseInReturn,
    addEmitBeforeResolveOrReject,
    handleCallToNodeCorePromiseEmitEvent,
}

function handleNewPromise(path, state, inRefConstruct, visitor) {
    if (bookkeeping.alreadyVisited(path)) {
        return
    }
    var promiseName
    // Add before:
    // promiseName = karousos.createPromiseSuperObj()
    // save the new Promise in promiseName.karContents
    if (t.isVariableDeclarator(path.parentPath)) {
        promiseName = path.parent.id
        let promiseDef = buildCreatePromiseObject(path.parentPath.parent.kind, promiseName)
        path.getStatementParent().insertBefore(promiseDef)
        var stmt = path.getStatementParent()
        stmt.replaceWith(buildPromiseContentsAssignment(promiseName, path.node))
        path.skip()
        path = stmt.get('expression').get('right')
    } else if (t.isAssignmentExpression(path.parentPath)) {
        promiseName = path.parent.left
        let promiseDef = buildCreatePromiseObject('', promiseName)
        path.getStatementParent().insertBefore(promiseDef)
        replaceAssignmentWithPromiseContents(path.parentPath.get('left'))
    } else {
        process.emitWarning(
            'new expression not in assignment or variable declaration after replacement' +
            state.file.opts.filename
        )
        return;
    }
    // Try to parse the function inside new Promise. First figure out which argument it corresponds
    // to in case the new Promise is in reflect.construct.
    var args
    if (inRefConstruct) {
        let args1 = path.get('arguments')[1]
        if (!t.isArrayExpression(args1)) {
            process.emitWarning(
                'Reflect.construct(promise, nonArray) called' +
                state.file.opts.filename
            )
            return
        }
        args = args1.get('elements')
    } else {
        args = path.get('arguments')
    }

    if (args.length == 0) {
        return
    }
    handleInternalOfNewPromise(args[0], state, promiseName, visitor)
    //save that this function is a new promise
    modifiers.insertAfter(path, karousos.buildSetThen(promiseName))
    bookkeeping.markVisited(path)
}

function replaceAssignmentWithPromiseContents(path) {
    path.replaceWith(t.memberExpression(path.node,
        builders.getIdentifier('karContents')))
}

// build a call to karousos.createPromiseObject and save the result in a variable declaration 
// or an assignment statement
function buildCreatePromiseObject(kind, name) {
    var call = builders.buildCall(
        inspect.karousosModule,
        'createPromiseObject',
        [builders.getIdentifier('requestID'), builders.getIdentifier('handlerID')]
    );
    if (kind != '') {
        return builders.buildVariableDeclaration(kind, builders.getIdentifier(name), call)
    } else {
        return t.expressionStatement(t.assignmentExpression('=', builders.getIdentifier(name), call))
    }
}

// build promise.karContents = obj
function buildPromiseContentsAssignment(promise, obj) {
    return builders.buildAssignmentStatement('=', t.memberExpression(
        promise, builders.getIdentifier('karContents')), obj)
}

// adds statements to the beginning of the function that is used as an argument to new Promise
// and then parses the function keeping in the state what is the resolve and what is the reject 
// function
function handleInternalOfNewPromise(path, state, promiseName, visitor) {
    addInitStatementsToNewPromiseFunction(path, promiseName)
    var params = path.node.params
    var state2 = bookkeeping.newStateForInPromise(state, params)
    path.inPromise = true;
    path.traverse(visitor, state2)
    bookkeeping.markVisited(path)
}

function addInitStatementsToPromiseMethodFunctions(path, prevPromise, thisPromise) {
    if (prevPromise == undefined) {
        throw 'prev promise undefined'
    }
    if (thisPromise === undefined) {
        throw 'this promise undefined'
    }
    var args = path.get('arguments')
    if (!t.isNullLiteral(args[0])) {
        addInitStatementsToPromiseMethodFunction(
            args[0],
            prevPromise,
            thisPromise,
            path.node.callee.property.name
        )
    }
    // parse the second argument if this is a call to promise.then
    if (path.node.callee.property.name == 'then' && args.length == 2) {
        addInitStatementsToPromiseMethodFunction(
            args[1],
            prevPromise,
            thisPromise,
            'catch'
        )
    }
}

// Adds statements to retrieve the requestID, handlerID, retEventTypes, and mark the 
// resolve and reject functions at the beginning of the function inside new Promise()
function addInitStatementsToNewPromiseFunction(funcPath, promiseName) {
    var promiseNameID = builders.getIdentifier(promiseName);
    promiseNameID.visited = true;
    let getRequestID = builders.buildVariableDeclaration('var', 'requestID',
        t.memberExpression(promiseNameID, builders.getIdentifier('requestID'))
    )
    let getHandlerID = builders.buildVariableDeclaration('var', 'handlerID',
        t.memberExpression(promiseNameID, builders.getIdentifier('handlerID'))
    )
    let getRetEvtTypes = builders.buildVariableDeclaration('var', 'retEventTypes',
        t.memberExpression(promiseNameID, builders.getIdentifier('retEventTypes'))
    )
    let markResRej = karousos.buildMarkTheResRejFunctions(
        funcPath.node.params[0],
        funcPath.node.params[1],
        t.identifier('retEventTypes')
    )
    if (t.isBlockStatement(funcPath.node.body)) {
        funcPath.get('body').unshiftContainer(
            'body', [
                getRequestID,
                getHandlerID,
                getRetEvtTypes,
                markResRej
            ]
        )
    } else {
        funcPath.get('body').replaceWith(
            t.blockStatement([
                getRequestID,
                getHandlerID,
                getRetEvtTypes,
                markResRej,
                t.expressionStatement(funcPath.node.body)
            ])
        )
    }
}

function handlePromiseRaceOrAll(path, state) {
    if (bookkeeping.alreadyVisited(path)) {
        return
    }
    if (!t.isArrayExpression(path.get('arguments')[0])) {
        return -1;
    }
    var elems = path.node.arguments[0].elements
    if (elems.length == 0) {
        return -1;
    }
    // Get any calls or new expressions that are arguments out of the arguments.
    // also modify all arguments x to x.karContents since the promises are wrapped
    var promiseNames = []
    for (let i = 0; i < elems.length; i++) {
        if (t.isCallExpression(elems[i]) || t.isNewExpression(elems[i])) {
            let promiseName = builders.generateUid(path, 'promiseID')
            let promiseDef = builders.buildVariableDeclaration('var', promiseName, elems[i])
            path.getStatementParent().insertBefore([promiseDef])
            path.get('arguments')[0].get('elements')[i].replaceWith(
                t.memberExpression(promiseName, t.identifier('karContents'))
            )
        } else {
            path.get('arguments')[0].get('elements')[i].replaceWith(
                t.memberExpression(elems[i], t.identifier('karContents'))
            )
        }
        promiseNames.push(
            t.memberExpression(elems[i].object, builders.getIdentifier('retEventTypes'))
        )
    }
    var all = path.node.callee.property.name == 'all'
    if (karousos.isInReturn(path, state)) {
        // We don't handle Promise.race or Promise.all inside return statements.
        throw new Error('Promise race or all inside return after replacement')
    } else {
        var thisPromise;
        // Add the promise object call and save the result to p.karContents
        [thisPromise, path] = transformPromiseResult(path, state)
        if (thisPromise == undefined) {
            return
        }
        var retEventTypes = karousos.buildSetRetEventTypes(
            t.memberExpression(thisPromise, builders.getIdentifier('retEventTypes')),
            t.arrayExpression(promiseNames),
            all.toString()
        );
        // Add SetRetEventTypes before the promise 
        path.getStatementParent().insertBefore([retEventTypes])
        // Add setThen after the promise
        modifiers.insertAfter(path, karousos.buildSetThen(thisPromise))
    }
    bookkeeping.markVisited(path)
}

// This function transforms the promise. It adds it as a separate statement if needed.
// and builds the appropriate promise "super object" 
function transformPromiseResult(path, state) {
    var stmt = path.getStatementParent()
    var promiseName
    var promiseDef
    if (inspect.parentIsExpression(path)) {
        promiseName = generatePromiseName(path);
        promiseDef = buildCreatePromiseObject('var', promiseName)
    } else if (t.isAssignmentExpression(path.parentPath)) {
        assert(inspect.grandparentIsExpression(path))
        promiseName = path.parent.left
        promiseDef = buildCreatePromiseObject('', promiseName)
    } else if (t.isVariableDeclarator(path.parentPath)) {
        promiseName = path.parent.id
        promiseDef = buildCreatePromiseObject(path.parentPath.parent.kind, promiseName)
    } else {
        promiseName = generatePromiseName(path);
        var decl = builders.buildVariableDeclaration('var', promiseName, path.node)
        path.getStatementParent().insertBefore(decl)
        path.replaceWith(promiseName)
        return [undefined, path]
    }
    path.getStatementParent().insertBefore([promiseDef])
    stmt.replaceWith(buildPromiseContentsAssignment(promiseName, path.node))
    path.skip()
    return [promiseName, stmt.get('expression').get('right')]
}

function generatePromiseName(path) {
    return builders.generateUid(path, 'promiseID')
}

function handlePromiseInReturn(path, state) {
    // Get the promise out of the return, and add setRetEventTypes between the promise declaration
    // and the return
    let promiseName = generatePromiseName(path)
    let promiseDecl = builders.buildVariableDeclaration('var', promiseName, path.node.argument)
    let setEmitEvents = karousos.buildSetRetEventTypes(
        t.identifier('retEventTypes'),
        t.memberExpression(promiseName, t.identifier('retEventTypes')),
        'true'
    );
    path.getStatementParent().insertBefore([promiseDecl, setEmitEvents])
    // check if there are retEventTypes passed to the parent function (this implies that this is 
    // called from an await) and then return contents of the promise
    // otherwise return the promise
    let test = t.binaryExpression(
        '>',
        t.memberExpression(builders.getIdentifier('retEventTypes'), builders.getIdentifier('length')), t.numericLiteral(0)
    );
    var [returnPromiseCont, returnPromise] = getPossibleReturns(path, state, promiseName)
    let ifStmt = builders.buildIfStatement(test,
        t.blockStatement([returnPromiseCont]),
        t.blockStatement([returnPromise])
    )
    var stmt = path.getStatementParent()
    stmt.replaceWith(ifStmt)
    path.skip()
    bookkeeping.markVisited(stmt.get('consequent').get('body')[0])
    bookkeeping.markVisited(stmt.get('alternate').get('body')[0])
    bookkeeping.markVisited(stmt.get('consequent').get('body')[0].get('argument'))
    bookkeeping.markVisited(stmt.get('alternate').get('body')[0].get('argument'))
}

// You are not expected to understand this
function getPossibleReturns(path, state, promiseName) {
    var returnPromiseCont, returnPromise
    if (state != undefined && state.objName != undefined) {
        returnPromiseCont = t.isReturnStatement(path) ?
            t.returnStatement(
                t.objectExpression([
                    t.objectProperty(builders.getIdentifier('value'),
                        t.memberExpression(promiseName, builders.getIdentifier('karContents'))),
                    t.objectProperty(builders.getIdentifier('done'), builders.getIdentifier('false'))
                ])
            ) :
            t.throwStatement(t.memberExpression(promiseName, builders.getIdentifier('karContents')))
        returnPromise = t.isReturnStatement(path) ?
            t.returnStatement(t.objectExpression([
                t.objectProperty(builders.getIdentifier('value'), promiseName),
                t.objectProperty(builders.getIdentifier('done'), builders.getIdentifier('false'))
            ])) :
            t.throwStatement(promiseName)

    } else {
        returnPromiseCont = t.isReturnStatement(path) ?
            t.returnStatement(
                t.memberExpression(promiseName, builders.getIdentifier('karContents'))
            ) :
            t.throwStatement(t.memberExpression(promiseName, builders.getIdentifier('karContents')))

        returnPromise = t.isReturnStatement(path) ?
            t.returnStatement(promiseName) :
            t.throwStatement(promiseName)
    }
    return [returnPromiseCont, returnPromise]
}

function addEmitBeforeResolveOrReject(path, state, type, promiseName) {
    if (bookkeeping.alreadyVisited(path)) {
        return
    }
    // If the return's argument is a conditional expression, take it out
    if (t.isConditionalExpression(path.node.arguments[0])) {
        assert(
            t.isExpressionStatement(path.parentPath) ||
            t.isVariableDeclarator(path.parentPath) ||
            t.isAssignmentExpression(path.parentPath)
        );
        modifiers.putInSeparateStatement(path.get('arguments')[0])
    }
    var arg = path.node.arguments[0];
    var argPath = path.get('arguments')[0];
    var eventTypes = type == 'success' ?
        t.memberExpression(path.node.callee, t.identifier('isTheResolveFunction')) :
        t.memberExpression(path.node.callee, t.identifier('isTheRejectFunction'))
    // emit event if we are sure that it is not a call
    if (arg == null ||
        t.isBinaryExpression(arg) ||
        t.isUnaryExpression(arg) ||
        t.isArrayExpression(arg) ||
        inspect.isLiteral(arg) ||
        t.isObjectExpression(arg) ||
        t.isArrowFunctionExpression(arg) ||
        t.isFunctionExpression(arg) ||
        t.isLogicalExpression(arg) ||
        t.isSpreadElement(arg) ||
        t.isUpdateExpression(arg) ||
        t.isSequenceExpression(arg) ||
        t.isThisExpression(arg)
    ) {
        //If it is a complicated expression, the value is saved in an intermediate variable
        if (
            t.isBinaryExpression(arg) ||
            t.isUnaryExpression(arg) ||
            t.isArrayExpression(arg) ||
            t.isLogicalExpression(arg) ||
            t.isUpdateExpression(arg)
        ) {
            modifiers.putInSeparateStatement(argPath);
        }
        let toEmit = buildEmitEvent(type, null, eventTypes);
        modifiers.insertBefore(path, toEmit);
        bookkeeping.markVisited(path)
        return;
    } else if (inspect.isCallToPromise(argPath)) {
        handlePromiseInResRej(path, type);
        return;
    } else if (t.isAwaitExpression(argPath)) {
        //Remove the await and emit the event before the return and after await
        modifiers.putInSeparateStatement(path.get('arguments')[0]);
        let toEmit = buildEmitEvent(type, null, eventTypes, awaitRes);
        modifiers.insertBefore(path, [toEmit]);
        return;
    } else if (t.isCallExpression(arg) || t.isNewExpression(arg)) {
        // move the call out of the return. 
        modifiers.putInSeparateStatement(path.get('arguments')[0]);
    } else if (t.isAssignmentExpression(arg)) {
        // replace the assignment
        modifiers.insertBefore(path, arg)
        argPath.replaceWith(arg.left)
    }
    // If we reach here, add before the return res:
    // if (res is promise){
    // setRetEventTypes
    // res = res.karContents
    // } else {
    // emit
    // }
    arg = path.node.arguments[0]
    let test = karousos.buildTestIfPromise(arg)
    let setEmitEvents = karousos.buildSetRetEventTypes(
        eventTypes,
        t.memberExpression(arg, t.identifier('retEventTypes')),
        'true'
    );
    var toAdd = []
    var res = path.node.arguments[0]
    if (!t.isIdentifier(res)) {
        modifiers.putInSeparateStatement(path.get('arguments')[0])
    }
    let toEmit = buildEmitEvent(type, null, eventTypes, arg)
    let ifStmt = builders.buildIfStatement(test,
        t.blockStatement([
            setEmitEvents,
            builders.buildAssignmentStatement(
                '=',
                res,
                t.memberExpression(arg, t.identifier('karContents'))
            )
        ]),
        t.blockStatement([toEmit])
    )
    toAdd.push(ifStmt)
    modifiers.insertBefore(path, toAdd)
    bookkeeping.markVisited(path)
}

// Add the promise declaration and setEmitEvents prior to the statement
function handlePromiseInResRej(path, type) {
    if (bookkeeping.alreadyVisited(path)) {
        return
    }
    var eventTypes = type == 'success' ?
        t.memberExpression(path.node.callee, t.identifier('isTheResolveFunction')) :
        t.memberExpression(path.node.callee, t.identifier('isTheRejectFunction'))
    let promiseName = generatePromiseName(path)
    let promiseDecl = builders.buildVariableDeclaration('var', promiseName, path.node.arguments[0])
    let setEmitEvents = karousos.buildSetRetEventTypes(eventTypes,
        t.memberExpression(promiseName, t.identifier('retEventTypes')), 'true')
    path.getStatementParent().insertBefore([promiseDecl, setEmitEvents])
    path.node.arguments[0] = t.memberExpression(promiseName,
        builders.getIdentifier('karContents'))
    bookkeeping.markVisited(path)
}

// handle a call to a node core built in function that returns a promise
// you are not expected to understand this
function handleCallToNodeCorePromiseEmitEvent(path, state, isNonDet) {
    var promiseName
    if (t.isVariableDeclarator(path.parentPath)) {
        if (path.parentPath.parentPath.get('declarations').length > 1) {
            throw 'promise constructor called while instantiating many variables. unsafe to parse'
        }

        promiseName = path.parent.id
        let promiseDef = buildCreatePromiseObject(
            path.parentPath.parent.kind, promiseName)
        modifiers.insertBefore(path, promiseDef)
        var stmt = path.getStatementParent()
        stmt.replaceWith(buildPromiseContentsAssignment(promiseName, path.node))
        path.skip()
        path = stmt.get('expression').get('right')
    } else if (t.isAssignmentExpression(path.parentPath)) {
        debug('Handle as assignment declarator')
        if (prom.promiseNotReplacedYet(path)) {
            promiseName = path.parent.left
            let promiseDef = buildCreatePromiseObject('', promiseName)
            path.getStatementParent().insertBefore(promiseDef)
            replaceAssignmentWithPromiseContents(path.parentPath.get('left'))
        } else {
            promiseName = path.parent.left.object
        }
    } else {
        process.emitWarning('new expression not in assignment or variable declaration after replacement' + state.file.opts.filename)
        return
    }
    //add .then()
    var requestID2 = builders.generateUid(path, 'requestID')
    var handlerID2 = builders.generateUid(path, 'handlerID')
    modifiers.insertBefore(path, [
        builders.buildVariableDeclaration('var', requestID2, t.identifier('requestID')),
        builders.buildVariableDeclaration('var', handlerID2, t.identifier('handlerID'))
    ])
    var toAddThen = [
        builders.buildVariableDeclaration('var', t.identifier('requestID'), requestID2),
        builders.buildVariableDeclaration('var', t.identifier('handlerID'), handlerID2),
        buildEmitEvent('success', promiseName, builders.getIdentifier('arguments'))
    ]
    var toAddCatch = [
        builders.buildVariableDeclaration('var', t.identifier('requestID'), requestID2),
        builders.buildVariableDeclaration('var', t.identifier('handlerID'), handlerID2),
        buildEmitEvent('fail', promiseName, builders.getIdentifier('arguments'))
    ]
    if (isNonDet) {
        toAddThen.push(karousos.buildRecordNonDetOp(t.identifier('arguments')))
        toAddCatch.push(karousos.buildRecordNonDetOp(t.identifier('arguments')))
    }
    toAddThen.push(t.returnStatement(builders.getIdentifier('arguments')))
    toAddCatch.push(t.throwStatement(builders.getIdentifier('arguments')))
    var funcThen = t.functionExpression(null, [], t.blockStatement(toAddThen))
    var funcCatch = t.functionExpression(null, [], t.blockStatement(toAddCatch))
    path.replaceWith(builders.buildCall(path.node, 'then', [funcThen, funcCatch]))
    bookkeeping.markVisited(path)
    bookkeeping.markVisited(path.get('callee').get('object'))
    bookkeeping.markVisited(path.get('arguments')[0])
    bookkeeping.markVisited(path.get('arguments')[0].get('body').get('body')[toAddThen.length - 1])
    bookkeeping.markVisited(path.get('arguments')[1])
    bookkeeping.markVisited(path.get('arguments')[1].get('body').get('body')[toAddCatch.length - 1])
}