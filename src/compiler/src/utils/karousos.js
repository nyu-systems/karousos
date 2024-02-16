const assert = require('assert')
const t = require('@babel/types')
const nodeBuiltIns = require('./nodeBuiltIns')
const build = require('./builders')
const inspect = require('./inspect')
const bookkeeping = require('./bookkeeping')
const modifiers = require('./modifiers')
const _ = require('lodash');
const mode = parseInt(process.env.ADVICE_MODE || 0) //what advice to collect;
const karousosModule = inspect.karousosModule

module.exports = {
    buildGetValueOf,
    replaceWithValueOf,
    buildPushContext,
    buildPopContext,
    buildCallGetHandlerID,
    buildSync,
    buildIsUndefined,
    buildSetThen,
    buildCreateAwaitRetEvtType,
    buildFindLength,
    buildAddRidHidIfNeeded,
    buildCallToMemberOf,
    buildTestIfPromise,
    buildCheckNotPromise,
    buildCheckPromiseSuperObj,
    buildMaybeReturnPromise,
    buildCreateObjectID,
    buildSetHidForObjID,
    buildGetHidForObjID,
    buildShouldSkipObjID,
    buildNewHidCall,
    buildSetHid,
    buildSetRetEventTypes,
    buildEmitEvent,
    buildExportContents,
    buildRecordNonDetOp,
    buildSetOrEmit,
    buildGetHandlerID,
    buildGetAndUpdateHandlerID,
    buildGetFunctionType,
    buildGetSuperFunctionType,
    buildGetSuperMethodFunctionType,
    buildLinkTimerIdToHanlderId,
    buildRegisterEvent,
    buildUnregisterEvent,
    buildUnregisterAllEvent,
    buildRequire,
    buildUpdateHidIfNeeded,
    buildSetObjIDAndRid,
    buildUpdateTag,
    buildGetRid,
    buildMarkTheResRejFunctions,
    buildAssignObjectID,
    buildHandleRequire,
    buildGetCurrentHid,
    isReportsColMethod,
    isCallToReportsCol,
    isCallToRecordAccess,
    isEmit,
    isSetRetEventTypes,
    isSetHidForObjID,
    isTheResolveFunction,
    isTheRejectFunction,
    isCallToPopContext,
    prevStatementIsEmit,
    prevStatementIsSetRetEventTypes,
    prevStatementIsSetHidForObjID,
    isAssignmentOrVariableDeclaration,
    isInReturn,
    isDetSyncCallToCore,
    isCallWithCallback,
    addStandardIdsToParams,
    formatArgsRec,
    addParamsToCallback,
    handleGeneralCall,
}

// Build karousos.getValueOf(obj)
function buildGetValueOf(path) {
    return build.buildCall(karousosModule, "getValueOf", [path.node || path])
}

//Replace an identifier with getValueOf. If this is an obj.member it replaces the obj with getValueOf
function replaceWithValueOf(path) {
    if ((t.isIdentifier(path) && !["undefined", karousosModule, "Symbol", "true", "false", "Array", "Object", "Boolean", 'arguments'].includes(path.node.name)) || (t.isMemberExpression(path) && !inspect.isLengthProperty(path) && (!t.isIdentifier(path.node.property) || path.node.property.name != 'prototype'))) {
        path.replaceWith(buildGetValueOf(path));
        bookkeeping.markVisited(path);
        if (t.isMemberExpression(path.get('arguments')[0])) {
            replaceWithValueOf(path.get('arguments')[0].get('object'));
        }
    }
}

// Build karousos.pushContext()
function buildPushContext() {
    return build.buildCallStatement(karousosModule, 'pushContext', [
        t.identifier('requestID'),
        t.identifier('handlerID'),
        t.arrayExpression([]),
        t.stringLiteral('')
    ])
}

// Build karousos.popContext()
function buildPopContext() {
    return build.buildVariableDeclaration('var',
        t.arrayPattern([
            t.identifier('requestID'),
            t.identifier('handlerID'),
            t.identifier('retEventTypes'),
            t.identifier('objID')
        ]),
        build.buildCall(karousosModule, 'popContext', []))
}

// Build karousos.GetHandlerID()
function buildCallGetHandlerID(functionName, eventType, success) {
    return build.buildCall(karousosModule, 'GetHandlerID',
        [build.getIdentifier('requestID'), eventType, t.stringLiteral(functionName),
            t.stringLiteral(success)
        ])
}

// Build karousos.sync
function buildSync(init_path, new_node, isReassignment) {
    var init_node = init_path.node;
    var member_expr_arguments = []
    if (t.isMemberExpression(init_node)) {
        var property = init_node.property;
        if (t.isIdentifier(property)) {
            if (!init_node.computed) {
                property = t.stringLiteral(property.name);
            }
        } else if (t.isUpdateExpression(property)) {
            property = property.argument;
        } else {
            property = getExpression(init_path.get('property'));
        }
        member_expr_arguments = [
            init_node.object,
            property
        ]
    }
    return build.buildCall(karousosModule, 'sync',
        [t.isArrayPattern(init_node) ? t.arrayExpression(init_node.elements) : (t.isObjectPattern(init_node) ? t.objectExpression(init_node.properties) : init_node),
            new_node,
            t.booleanLiteral(t.isObjectPattern(init_node)),
            t.booleanLiteral(t.isArrayPattern(init_node)),
            t.identifier('requestID'),
            t.identifier('handlerID'),
            t.booleanLiteral(!!isReassignment)
        ].concat(member_expr_arguments));
}

//makes an expression static in the sense that it is ok to be evaluated twice
//one in the actual call and one in the call to assign objectID
function getExpression(path) {
    if (t.isIdentifier(path) || inspect.isLiteral(path) ||
        t.isThisExpression(path))
        return bookkeeping.copy(path.node);
    if (t.isBinaryExpression(path))
        return t.binaryExpression(path.node.operator,
            getExpression(path.get('left')),
            getExpression(path.get('right')));
    if (t.isUnaryExpression(path))
        return t.unaryExpression(path.node.operator,
            getExpression(path.get('argument')),
            path.node.prefix)
    if (t.isLogicalExpression(path))
        return t.logicalExpression(path.node.operator,
            getExpression(path.get('left')),
            getExpression(path.get('right')));
    if (t.isUpdateExpression(path))
        return getExpression(path.get('argument'));
    if (t.isMemberExpression(path))
        return t.memberExpression(
            getExpression(path.get('object')),
            getExpression(path.get('property')),
            path.node.computed);
    if (t.isCallExpression(path) || t.isNewExpression(path) ||
        t.isConditionalExpression(path) || t.isAssignmentExpression(path) ||
        t.isSequenceExpression(path)) {
        modifiers.putInSeparateStatement(path);
        assert(t.isIdentifier(path))
        return path.node;
    }
    console.log(path.node)
    assert(false)
}

function buildIsUndefined(node) {
    return build.buildCall(karousosModule, 'isUndefined', [bookkeeping.copy(node)]);
}

function buildSetThen(promiseName) {
    return build.buildCallStatement(karousosModule, 'setThen', [promiseName])
}

function buildCreateAwaitRetEvtType() {
    return build.buildCall(karousosModule, 'createAwaitRetEvtType', [t.identifier('requestID'), t.identifier('handlerID')]);
}

function buildFindLength(node) {
    return build.buildCall(karousosModule, 'findLength', [node])
}

function buildAddRidHidIfNeeded(res) {
    return build.buildAssignmentStatement('=', res,
        build.buildCall(karousosModule, 'addRidHidIfNeeded',
            [res, t.identifier('requestID'), t.identifier('handlerID')]))
}

function buildCallToMemberOf(objPath, methodPath) {
    return build.buildCall(karousosModule, 'getMember', [objPath.node, methodPath.node])
}

function buildTestIfPromise(arg) {
    return t.logicalExpression('&&',
        arg,
        t.logicalExpression('&&',
            build.buildCall(karousosModule, 'isNativePromise', [
                t.memberExpression(arg, build.getIdentifier('karContents'))
            ]),
            t.binaryExpression('>',
                t.memberExpression(build.getIdentifier('retEventTypes'),
                    build.getIdentifier('length')),
                t.numericLiteral(0))
        ))
}

function buildCheckNotPromise(object) {
    return build.buildCallStatement(karousosModule, 'checkNotPromise', [object])
}

function buildCheckPromiseSuperObj(object) {
    return build.buildCall(karousosModule, 'isPromiseSuperObject', [object])
}

function buildMaybeReturnPromise(path) {
    let call = build.buildCall(karousosModule, 'maybeReturnPromise',
        [t.identifier('requestID'),
            t.identifier('handlerID'),
            t.identifier('retEventTypes'),
            path.node.argument,
            t.isReturnStatement(path) || t.isYieldExpression(path) ? t.stringLiteral('success') : t.stringLiteral('fail')
        ]);
    return t.isReturnStatement(path) ? t.returnStatement(call) : t.isYieldExpression(path) ? t.yieldExpression(call) : t.throwStatement(call)
}

function buildCreateObjectID(path, objID) {
    return build.buildVariableDeclaration('var', objID,
        build.buildCall(karousosModule, 'createObjectID',
            [build.getIdentifier('requestID'), build.getIdentifier('handlerID')]))
}

function buildSetHidForObjID(obj) {
    return build.buildAssignmentStatement('=', obj, build.buildCall(karousosModule, 'setHandlerIDforObjectID',
        [build.getIdentifier('requestID'), build.getIdentifier('handlerID'), obj]))
}

function buildGetHidForObjID(obj, type) {
    if (type == undefined) {
        return build.buildAssignmentStatement('=', build.getIdentifier('handlerID'),
            build.buildCall(karousosModule, 'getHandlerIDforObjectID',
                [build.getIdentifier('requestID'), build.getIdentifier('handlerID'), obj]))
    } else {
        return build.buildVariableDeclaration(type, build.getIdentifier('handlerID'),
            build.buildCall(karousosModule, 'getHandlerIDforObjectID',
                [build.getIdentifier('requestID'), build.getIdentifier('handlerID'), obj]))
    }
}

function buildShouldSkipObjID(left, right) {
    return build.buildCall(karousosModule, 'shouldSkip', [left, right]);
}

function buildNewHidCall(path, state) {
    return build.buildCall(karousosModule, 'newHandlerID',
        [build.getIdentifier('requestID'), t.stringLiteral(
            state.filename + ":" + path.node.start.toString())])
}

function buildSetHid() {
    return build.buildCallStatement(karousosModule, 'setCurrentHandler',
        [build.getIdentifier('requestID'), build.getIdentifier('handlerID')])
}

function buildSetRetEventTypes(dependentEvents, dependantEvents, allOrRace) {
    return build.buildCallStatement(karousosModule, 'SetReturnEventTypes',
        [build.getIdentifier('requestID'), dependantEvents, dependentEvents, build.getIdentifier(allOrRace), build.getIdentifier('handlerID')]);
}

function buildEmitEvent(success, promiseName, eventTypes, value) {
    var call
    //value is only needed in promises and, specifically, in promise.race. 
    //but we add it to all promises and all thenns.
    var addValue = value ? (arr) => {
        return arr.concat(value)
    } : (arr) => {
        return arr
    }
    if (eventTypes == undefined) {
        if (promiseName == undefined) {
            call = build.buildCallStatement(karousosModule, 'EmitAll',
                addValue([build.getIdentifier('requestID'), build.getIdentifier('handlerID'),
                    build.getIdentifier('retEventTypes'), t.StringLiteral(success)
                ]))
        } else {
            call = build.buildCallStatement(karousosModule, 'EmitAll',
                addValue([build.getIdentifier('requestID'), build.getIdentifier('handlerID'),
                    t.memberExpression(promiseName, build.getIdentifier('retEventTypes')), t.StringLiteral(success)
                ]))

        }
    } else {
        call = build.buildCallStatement(karousosModule, 'EmitAll',
            addValue([build.getIdentifier('requestID'), build.getIdentifier('handlerID'),
                eventTypes, t.StringLiteral(success)
            ]))
    }
    return call
}

function buildExportContents(p) {
    return build.buildCall(karousosModule, 'exportContents', [build.getIdentifier(p)])
}

function buildRecordNonDetOp(res) {
    return build.buildCallStatement(karousosModule, 'recordNonDetOp', [
        build.getIdentifier('requestID'),
        build.getIdentifier('handlerID'),
        res
    ])
}

function buildSetOrEmit(ret, p, success) {
    if (ret != undefined) {
        return build.buildCallStatement(karousosModule, 'SetOrEmit',
            [build.getIdentifier('requestID'), build.getIdentifier('handlerID'),
                build.getIdentifier(ret), build.getIdentifier(p), t.StringLiteral(success)
            ])
    } else {
        return build.buildCallStatement(karousosModule, 'SetOrEmit',
            [build.getIdentifier('requestID'), build.getIdentifier('handlerID'),
                build.getIdentifier('undefined'), build.getIdentifier(p), t.StringLiteral(success)
            ])
    }
}

function buildGetHandlerID(functionName, eventType, success, isVerifier) {
    return build.buildAssignmentStatement('=', build.getIdentifier('handlerID'),
        buildCallGetHandlerID(functionName, eventType, success))
}

function buildGetAndUpdateHandlerID(functionName, eventType, success) {
    if (functionName instanceof String || typeof functionName == 'string') functionName = t.stringLiteral(functionName);
    return build.buildAssignmentStatement('=', build.getIdentifier('handlerID'),
        build.buildCall(karousosModule, 'GetAndUpdateHandlerID',
            [build.getIdentifier('requestID'), build.getIdentifier('handlerID'), eventType, functionName,
                t.stringLiteral(success)
            ]))
}

function buildGetFunctionType(fn) {
    return build.buildCall(karousosModule, 'functionType', [fn])
}

function buildGetSuperFunctionType(fn) {
    return build.buildCall(karousosModule, 'getSuperFunctionType', [fn])
}

function buildGetSuperMethodFunctionType(fn) {
    return build.buildCall(karousosModule, 'getSuperMethodFunctionType', [fn])
}

function buildLinkTimerIdToHanlderId(timer, handlerName, eventID) {
    return build.buildCallStatement(karousosModule, 'Register',
        [build.getIdentifier('requestID'),
            timer, handlerName, eventID
        ])
}

function buildRegisterEvent(fname, events, success, forAlreadyEmitted) {
    if (fname instanceof String || typeof fname == 'string') fname = t.stringLiteral(fname);
    return build.buildCallStatement(karousosModule, 'Register',
        [build.getIdentifier('requestID'), build.getIdentifier('handlerID'),
            fname, events, t.stringLiteral(success),
            forAlreadyEmitted || t.identifier('false')
        ])
}

function buildUnregisterEvent(fname, events, success) {
    return build.buildCallStatement(karousosModule, 'Unregister',
        [build.getIdentifier('requestID'), build.getIdentifier('handlerID'),
            t.stringLiteral(fname), events, t.stringLiteral(success)
        ])
}

function buildUnregisterAllEvent(events, success) {
    return build.buildCallStatement(karousosModule, 'UnregisterAll',
        [build.getIdentifier('requestID'), build.getIdentifier('handlerID'),
            events, t.stringLiteral(success)
        ])
}

function buildRequire(loc) {
    var declar = build.buildVariableDeclaration('const', karousosModule,
        build.buildCall('require', undefined, [t.stringLiteral(loc)])
    );
    declar._blockHoist = 3;
    return declar
}

function buildUpdateHidIfNeeded() {
    return build.buildAssignmentStatement('=', build.getIdentifier('handlerID'),
        build.buildCall(karousosModule, build.getIdentifier('UpdateHidIfNeeded'),
            [build.getIdentifier('requestID'), build.getIdentifier('handlerID')]))
}

function buildSetObjIDAndRid(obj) {
    return build.buildCallStatement(karousosModule,
        build.getIdentifier('setObjectIDandRequestID'),
        [build.getIdentifier(obj),
            build.getIdentifier('requestID'),
            build.getIdentifier('handlerID')
        ])
}

function buildUpdateTag(num, returnExpression) {
    if (!returnExpression)
        return build.buildCallStatement(karousosModule,
            build.getIdentifier('updateTag'),
            [build.getIdentifier('requestID'),
                build.getIdentifier('handlerID'),
                t.stringLiteral(num)
            ])
    return build.buildCall(karousosModule,
        build.getIdentifier('updateTag'),
        [build.getIdentifier('requestID'),
            build.getIdentifier('handlerID'),
            t.stringLiteral(num)
        ]
    )
}

function buildGetRid(request) {
    return build.buildVariableDeclaration('var', 'requestID',
        build.buildCall(karousosModule, 'getRequestID', [build.getIdentifier(request)]))
}

function buildMarkTheResRejFunctions(res, rej, evt) {
    return build.buildCallStatement(karousosModule, 'markTheResRejFunctions',
        [res ? res : t.nullLiteral(), rej ? rej : t.nullLiteral(), evt])
}

// Built  
//   if (!obj || typeof obj == "function" || (typeof obj == "object" && obj && (obj.then || (obj.stack != null && obj.error != null) || obj.isLoggable)){
//	karousos.assignObjectID() 
//   }
// 
function buildAssignObjectID(path, objPath, isRead, isNewObject) {
    if (mode >= 6) return t.emptyStatement();
    var node = objPath.node || objPath;
    var checkExists = t.unaryExpression(
        "!",
        bookkeeping.copy(node),
    );
    checkExists.visited = true;
    checkExists.argument.visited = true;
    var getTypeOf = t.unaryExpression(
        "typeof",
        bookkeeping.copy(node),
    );
    getTypeOf.visited = true;
    getTypeOf.argument.visited = true;
    var checkIfFunction = t.binaryExpression(
        "==",
        bookkeeping.copy(getTypeOf),
        t.stringLiteral("function")
    );
    checkIfFunction.visited = true;
    checkIfFunction.left.visited = true;
    checkIfFunction.right.visited = true;
    var checkIfObject = t.binaryExpression(
        "==",
        bookkeeping.copy(getTypeOf),
        t.stringLiteral("object")
    );
    checkIfObject.visited = true;
    checkIfObject.left.visited = true;
    checkIfObject.right.visited = true;
    var checkIfPromise = t.memberExpression(
        bookkeeping.copy(node),
        t.identifier("then"),
    );
    checkIfPromise.visited = true;
    checkIfPromise.object.visited = true;
    checkIfPromise.property.visited = true;
    var checkHasStack = t.binaryExpression(
        "!=",
        t.memberExpression(bookkeeping.copy(node),
            t.identifier("stack")),
        t.nullLiteral()
    );
    checkHasStack.visited = true;
    checkHasStack.left.visited = true;
    checkHasStack.left.object.visited = true;
    checkHasStack.left.object.visited = true;
    checkHasStack.right.visited = true;
    var checkHasMessage = t.binaryExpression(
        "!=",
        t.memberExpression(bookkeeping.copy(node),
            t.identifier("message")),
        t.nullLiteral()
    );
    checkHasMessage.visited = true;
    checkHasMessage.left.visited = true;
    checkHasMessage.left.object.visited = true;
    checkHasMessage.left.object.visited = true;
    checkHasMessage.right.visited = true;
    var checkIfError = t.logicalExpression(
        "&&",
        checkHasStack,
        checkHasMessage,
    );
    checkIfError.visited = true;
    checkIfError.left.visited = true;
    checkIfError.right.visited = true;
    var checkIfLoggable = t.memberExpression(
        bookkeeping.copy(node),
        t.identifier("isLoggable"),
    );
    checkIfLoggable.visited = true;
    checkIfLoggable.object.visited = true;
    checkIfLoggable.property.visited = true;
    var or1 = t.logicalExpression(
        "||",
        checkIfPromise,
        checkIfError
    );
    or1.visited = true;
    var or2 = t.logicalExpression(
        "||",
        or1,
        checkIfLoggable
    );
    or2.visited = true;
    var and1 = t.logicalExpression(
        "&&",
        bookkeeping.copy(node),
        checkIfObject,
    );
    and1.visited = true;
    var and = t.logicalExpression(
        "&&",
        and1,
        or2,
    );
    and.visited = true;
    var or3 = t.logicalExpression(
        "||",
        checkExists,
        checkIfFunction,
    );
    or3.visited = true;
    var or4 = t.logicalExpression(
        "||",
        or3,
        and,
    );
    or4.visited = true;
    var ifStatement = t.ifStatement(
        or4,
        buildAssignObjectIDinner(path, objPath, isRead, isNewObject)
    );
    ifStatement.visited = true;
    return ifStatement;
}

// Build karousos.assignObjectID for the object at objPath. objPath can be a node or a path 
function buildAssignObjectIDinner(path, objPath, isRead, isNewObject) {
    var isReadStr = t.identifier((!!isRead).toString());
    var isNewObjectStr = t.identifier((!!isNewObject).toString());
    if (objPath.node == undefined) { //it is not a path
        return build.buildAssignmentStatement("=", bookkeeping.copy(objPath), build.buildCall(karousosModule, 'assignObjectID', [
            objPath, t.identifier('requestID'), t.identifier('handlerID'), isReadStr, isNewObjectStr
        ]));
    }
    bookkeeping.markVisited(objPath);
    //if the object we are assigning an id to is not a member expression then return
    if (!t.isMemberExpression(objPath)) {
        return t.isThisExpression(objPath) ?
            build.buildCallStatement(karousosModule, 'assignObjectID', [
                objPath.node, t.identifier('requestID'), t.identifier('handlerID'), isReadStr, isNewObjectStr
            ]) :
            build.buildAssignmentStatement("=", bookkeeping.copy(objPath.node), build.buildCall(karousosModule, 'assignObjectID', [
                objPath.node, t.identifier('requestID'), t.identifier('handlerID'), isReadStr, isNewObjectStr
            ]));
    }
    var pObject = t.isCallExpression(objPath.node.object) && isCallToReportsCol(path.get('object'), 'getValueOf') ? bookkeeping.copy(objPath.node.object.arguments[0]) : bookkeeping.copy(objPath.node.object);
    pObject.visited = true;
    var property = bookkeeping.copy(objPath.node.property);
    var objName = bookkeeping.copy(objPath.node);
    //Otherwise we need to assign an objectID with object and method.
    if (t.isIdentifier(property)) {
        if (!objPath.node.computed) {
            property = t.stringLiteral(property.name);
        }
    } else if (t.isUpdateExpression(property)) {
        property = property.argument;
        objName = t.memberExpression(pObject, property, objPath.node.computed)
    } else {
        property = getExpression(objPath.get('property'));
        if (t.isMemberExpression(property) && property.computed) {
            property = t.memberExpression(buildGetValueOf(property.object), property.property, property.computed);
        }
        objName = t.memberExpression(pObject, property, objPath.node.computed);
    }
    if (objPath.node.computed && t.isIdentifier(pObject)) {
        pObject.visited = true;
        objName = t.memberExpression(buildGetValueOf(pObject), bookkeeping.copy(property), true);
    }
    return build.buildAssignmentStatement("=", bookkeeping.copy(objName), build.buildCall(karousosModule, 'assignObjectID', [
        bookkeeping.copy(objName), t.identifier('requestID'), t.identifier('handlerID'), isReadStr, isNewObjectStr,
        pObject, property
    ]));
}

function buildHandleRequire(reqArg) {
    return build.buildCall(karousosModule, 'handleRequire', [reqArg, t.identifier('require')])
}

function buildGetCurrentHid() {
    return build.buildAssignmentStatement('=', t.identifier('handlerID'),
        build.buildCall(karousosModule, 'getCurrentHandler',
            [build.getIdentifier('requestID')]))
}

// Check if this is a method of the karousos module
function isReportsColMethod(node) {
    return t.isMemberExpression(node) && node.object.name == karousosModule;
}


//Check if an expression is a call to a method of the karousos module
function isCallToReportsCol(path, method) {
    if (!path) return false;
    var callee = path.node != undefined ? path.node.callee : path.callee
    return isReportsColMethod(callee) &&
        (method == undefined || callee.property.name == method);
}

function isCallToRecordAccess(path) {
    return t.isCallExpression(path) && isCallToReportsCol(path, 'recordAccess');
}

function isEmit(path) {
    let expr = path.get('expression')
    return t.isCallExpression(expr) && inspect.isOneOfTheObjectMethods(expr.get('callee'), karousosModule, 'EmitAll')
}

function isSetRetEventTypes(path) {
    let expr = path.get('expression')
    return t.isCallExpression(expr) && inspect.isOneOfTheObjectMethods(expr.get('callee'), karousosModule, 'SetReturnEventTypes')
}

function isSetHidForObjID(path) {
    let expr = path.get('expression')
    return t.isCallExpression(expr) && inspect.isOneOfTheObjectMethods(expr.get('callee'), karousosModule, 'SetHandlerIDforObjectID')
}

function isTheResolveFunction(path, state) {
    if (t.isCallExpression(path)) {
        path = path.get('callee')
    }
    return state.resolveFunc != undefined &&
        t.isIdentifier(path.node) && path.node.name == state.resolveFunc
}

function isTheRejectFunction(path, state) {
    if (t.isCallExpression(path)) {
        path = path.get('callee')
    }
    return state.rejectFunc != undefined && t.isIdentifier(path.node) && path.node.name == state.rejectFunc
}

function isCallToPopContext(node) {
    return t.isVariableDeclaration(node) && isCallToReportsCol(node.declarations[0].init);
}

function prevStatementIsEmit(path) {
    return isEmit(inspect.getPreviousStatement(path, 1))
}

function prevStatementIsSetRetEventTypes(path) {
    return isSetRetEventTypes(inspect.getPreviousStatement(path, 1))
}

function prevStatementIsSetHidForObjID(path) {
    return isSetHidForObjID(inspect.getPreviousStatement(path, 1))
}

function isAssignmentOrVariableDeclaration(path) {
    return t.isAssignmentExpression(path) || t.isVariableDeclaration(path)
}

function isInReturn(path, state) {
    return t.isReturnStatement(path.parentPath) || t.isThrowStatement(path.parentPath) ||
        isTheResolveFunction(path.parentPath, state) ||
        isTheRejectFunction(path.parentPath, state)
}

//core = js builtins + server/verifier lib
function isDetSyncCallToCore(path, state) {
    return isCallToReportsCol(path) || inspect.isDetSyncCallToJsBuiltIn(path, state)
}

function isCallWithCallback(path, state) {
    return nodeBuiltIns.isCallToNodeBuiltInWithCallback(path, state)
}

function callResNotSaved(path) {
    return !t.isExpressionStatement(path.parent) && !t.isVariableDeclarator(path.parent) &&
        !t.isAssignmentExpression(path.parent)
}

// Adds the requestID, handlerID, retEventTypes, objID to the beginning of the function parameters
function addStandardIdsToParams(path) {
    addIDsToParams(path,
        [build.getIdentifier('requestID'), build.getIdentifier('handlerID'),
            build.getIdentifier('retEventTypes'), build.getIdentifier('objID')
        ], 0)
}

function addIDsToParams(path, toAdd, identIndex) {
    var params = path.node.params
    if (bookkeeping.alreadyVisitedParams(path)) {
        return
    }
    bookkeeping.markVisitedParams(path)
    // add the requested params toAdd to the beginning of the function parameters
    path.node.params = toAdd.concat(params)
    // add an id to the function
    var functionID = modifiers.addIdToFunctionExpression(path)
    // Handle the case where this is a x.then function. 
    if (t.isMemberExpression(functionID) && t.isIdentifier(functionID.property) && ['then'].includes(functionID.property.name)) {
        var added4 = false,
            added5 = false
        //if called from await then these are not the arguments.
        var test = t.binaryExpression('<',
            t.memberExpression(t.identifier('arguments'), t.identifier('length')),
            t.numericLiteral(4))
        var setArgs = [
            build.buildAssignmentStatement('=', path.node.params[0],
                t.memberExpression(t.thisExpression(), t.identifier('requestID'))),
            build.buildAssignmentStatement('=', path.node.params[1],
                t.memberExpression(t.thisExpression(), t.identifier('handlerID'))),
            build.buildAssignmentStatement('=', path.node.params[2],
                t.memberExpression(t.thisExpression(), t.identifier('retEventTypes'))),
            build.buildAssignmentStatement('=', path.node.params[3],
                t.memberExpression(t.thisExpression(), t.identifier('objID')))
        ]
        if (path.node.params.length > 4) {
            setArgs.push(build.buildAssignmentStatement('=', path.node.params[4],
                t.memberExpression(t.identifier('arguments'), t.numericLiteral(0), true)))
            added4 = true
        }
        if (path.node.params.length > 5) {
            setArgs.push(build.buildAssignmentStatement('=', path.node.params[5],
                t.memberExpression(t.identifier('arguments'), t.numericLiteral(1), true)))
            added5 = true
        }
        path.get('body').unshiftContainer('body', t.ifStatement(test, t.blockStatement(setArgs)))
        var stmt = path.get('body').get('body')[0]
        bookkeeping.markVisited(stmt)
        bookkeeping.markVisited(stmt.get('test').get('left').get('object'))
        if (added4) {
            bookkeeping.markVisited(stmt.get('consequent').get('body')[4].get('expression').get('right').get('object'))
        }
        if (added5) {
            bookkeeping.markVisited(stmt.get('consequent').get('body')[5].get('expression').get('right').get('object'))
        }
    }
}

// For each argument that is not of the correct form, replace it with a variable/identifier 
// and add a statement outside the function call to appropriately set the variable 
function formatArgsRec(path, arr, isFilter) {
    for (let i = 0; i < arr.length; i++) {
        if (t.isArrayExpression(arr[i])) {
            formatArgsRec(path, arr[i].get('elements'));
        }
        //arguments that need to be moved are:
        //calls, new expressions, conditional expressions etc.
        if ((t.isConditionalExpression(arr[i]) && !bookkeeping.alreadyVisited(arr[i])) || (
                (t.isCallExpression(arr[i]) || t.isNewExpression(arr[i])) &&
                !isCallToReportsCol(arr[i])) || t.isSequenceExpression(arr[i]) ||
            t.isObjectExpression(arr[i]) && !inspect.isLiteral(arr[i]) ||
            t.isLogicalExpression(arr[i]) ||
            t.isBinaryExpression(arr[i]) ||
            t.isUnaryExpression(arr[i])) {
            modifiers.putInSeparateStatement(arr[i]);
        }
        // If it is an update expression, execute the update outside of the call
        if (t.isUpdateExpression(arr[i])) {
            modifiers.replaceUpdateExpression(arr[i])
            return;
        }
        //also, if this is a call to filter, and a function expression is passed
        //we may need to make sure it is of the correct form and make it be of the correct
        //form if it is not
        if (t.isAssignmentExpression(arr[i])) {
            modifiers.insertBefore(path, t.expressionStatement(arr[i].node));
            arr[i].replaceWith(arr[i].node.left)
        }
        if (isFilter) {
            addReturn(arr[i].get('body'));
        }
    }
}

//add the return if the body does not have an explicit return statement
function addReturn(path) {
    //if the body is not a block statement and it is not a return or throw then translate:
    //expr => return expr
    var isReturnOrThrow = (arg) => {
        return t.isReturnStatement(arg) || t.isThrowStatement(arg)
    }
    if (t.isIfStatement(path)) {
        addReturn(path.get('consequent'));
        addReturn(path.get('alternate'));
    } else if (!t.isBlockStatement(path) && !isReturnOrThrow(path)) {
        if (t.isExpressionStatement(path)) {
            path.replaceWith(t.returnStatement(path.node.expression));
        } else {
            path.replaceWith(t.returnStatement(path.node));
        }
    } else if (t.isBlockStatement(path)) {
        var lastStmt = path.get('body')[path.node.body.length - 1];
        //It is a block stmt but it does not end with return or throw
        //replace its last statement with a return or throw
        if (!isReturnOrThrow(lastStmt)) {
            ///we only handle some cases
            if (t.isExpressionStatement(lastStmt)) {
                lastStmt.replaceWith(t.returnStatement(lastStmt.node.expression));
            } else if (t.isForStatement(lastStmt)) {
                addReturn(lastStmt.get('body'))
            } else if (t.isSwitchStatement(lastStmt)) {
                for (let i = 0; i < lastStmt.get('cases').length; i++) {
                    let c = lastStmt.get('cases')[i];
                    if (c.node.consequent.length > 0) {
                        addReturn(c.get('consequent')[c.node.consequent.length - 1])
                    }
                }
            } else if (t.isTryStatement(lastStmt)) {
                addReturn(lastStmt.get('block'))
            } else {
                assert(t.isIfStatement(lastStmt))
                addReturn(lastStmt.get('consequent'));
                addReturn(lastStmt.get('alternate'));
            }
        }
    }
}


function addParamsToCallback(path, retEventTypesInit, objIDinit) {
    if (bookkeeping.alreadyVisitedParams(path)) {
        return
    }
    if (bookkeeping.alreadyVisitedArgs(path)) throw new Error('already visited')
    bookkeeping.markVisitedParams(path)
    let rid = build.generateUid(path, 'requestID')
    let hid = build.generateUid(path, 'handlerID')
    let objID = build.generateUid(path, 'objID')
    let retEventTypes = build.generateUid(path, 'retEventTypes')
    let varDecl = build.buildMultiVariableDeclaration('var',
        [rid, hid, retEventTypes, objID],
        ['requestID', 'handlerID', retEventTypesInit, objIDinit]
    )
    modifiers.insertBefore(path, varDecl)
    path.node.params = path.node.params.concat([
        t.assignmentPattern(build.getIdentifier('requestID'), rid),
        t.assignmentPattern(build.getIdentifier('handlerID'), hid),
        t.assignmentPattern(build.getIdentifier('retEventTypes'), retEventTypes),
        t.assignmentPattern(build.getIdentifier('objID'), objID)
    ])
}

function handleGeneralCall(path, state) {
    //If the callee is either a function or another call, move it to a separate statement
    if (t.isFunctionExpression(path.node.callee) ||
        t.isArrowFunctionExpression(path.node.callee)) {
        var functionID = build.generateUid(path, 'functionID')
        var funcDecl = build.buildVariableDeclaration('var', functionID, path.node.callee)
        modifiers.insertBefore(path, funcDecl)
        path.node.callee = functionID
    } else if ((inspect.isCall(path) || inspect.isApply(path)) &&
        (t.isFunctionExpression(path.node.callee.object) || t.isArrowFunctionExpression(path.node.callee.object))) {
        var functionID = build.generateUid(path, 'functionID')
        var funcDecl = build.buildVariableDeclaration('var', functionID, path.node.callee.object)
        modifiers.insertBefore(path, funcDecl)
        path.node.callee.object = functionID
    }
    // add arguments to the call
    addArgsToNormalFunction(path, state)
}

function addArgsToNormalFunction(path, state) {
    var callee = path.get('callee')
    var thisArg = t.identifier('undefined')
    var args = t.arrayExpression(path.node.arguments)
    var fn = callee.node
    var isConditional = false
    var method = t.stringLiteral("");
    if (t.isMemberExpression(callee)) {
        // We might need to unwrap the object of the member exression 
        // (it might be wrapped in a primitive wrapper)
        thisArg = t.isSuper(callee.node.object) ? state.superName : callee.node.object
        if (callee.node.computed) {
            method = callee.node.property;
        } else {
            method = t.stringLiteral(inspect.extractName(callee.get('property')))
        }
        var isSuper = (t.isIdentifier(callee.node.object) && callee.node.object.name == 'super') || t.isSuper(callee.node.object)
        var test = isSuper ? t.memberExpression(callee.node.object, t.identifier('karContents')) :
            t.logicalExpression('&&', callee.node.object, t.memberExpression(callee.node.object, t.identifier('karContents')))
        isConditional = true;
        fn = t.conditionalExpression(
            test,
            t.memberExpression(t.memberExpression(callee.node.object, t.identifier('karContents')), callee.node.property, callee.node.computed),
            callee.node
        )
    }
    // handle the case where the arguments to the call is just arguments
    var isNew = t.isNewExpression(path) ? t.identifier('true') : t.identifier('false')
    var isArguments = t.isIdentifier(args) && args.name == 'arguments'
    if (isArguments) {
        args = build.buildCall(
            build.buildCall('Array', 'from', [t.identifier('arguments')]),
            'slice',
            [t.numericLiteral(4)]
        )
    }
    // replace the call with a wrapped call
    path.replaceWith(build.buildCall(karousosModule, 'callFunction', [
        isNew,
        bookkeeping.copy(fn),
        bookkeeping.copy(thisArg),
        bookkeeping.copy(method),
        t.identifier('requestID'),
        t.identifier('handlerID'),
        t.arrayExpression([]), // retEventTypes = []
        args
    ]))
    // mark the new arguments as visited to avoid infinite recursion
    if (t.isLogicalExpression(path.get('arguments')[1])) {
        replaceWithValueOf(path.get('arguments')[1].get('left'));
        replaceWithValueOf(path.get('arguments')[1].get('right'));
    }
    bookkeeping.markVisited(path.get('arguments')[7])
    bookkeeping.markVisited(path.get('arguments')[1])
    if (isConditional) bookkeeping.markVisited(path.get('arguments')[1].get('test'));
    if (isArguments) {
        bookkeeping.markVisited(path.get('arguments')[7])
        bookkeeping.markVisited(path.get('arguments')[7].get('callee').get('object'))
        bookkeeping.markVisited(path.get('arguments')[7].get('callee').get('object').get('arguments')[0])
    }
    if (t.isConditionalExpression(path.node.arguments[1])) {
        bookkeeping.markVisited(path.get('arguments')[1].get('consequent'))
        bookkeeping.markVisited(path.get('arguments')[1].get('alternate'))
    }
}