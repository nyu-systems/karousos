"use strict";

const babelHelp = require('@babel/helper-plugin-utils');
const t = require('@babel/types');
const assert = require('assert');
const debug = require('debug')('add-rep-col');
const prom = require('./promise-babel')
const callHandler = require('./handleCalls');
const ret = require('./returns-babel');
const awaitStmts = require('./await');
const yieldStmts = require('./generators');
const assertMod = require('./node-assert');
const requireMod = require('./require-handler');
const inspect = require('./utils/inspect');
const bookkeeping = require('./utils/bookkeeping');
const modifiers = require('./utils/modifiers')
const karousos = require('./utils/karousos');
const builders = require('./utils/builders');
const mode = parseInt(process.env.ADVICE_MODE || 0) //what advice to collect;
const {
    getAssignObjIDparams
} = require('./utils/getAssignObjIDparams');

module.exports = {
    handleProgram,
    handleTaggedTemplateExpression,
    handleVariableDeclaration,
    handleVariableDeclarator,
    handleConditionalExpression,
    handleAssignmentPattern,
    handleAssignmentExpression,
    handleNewExpression,
    handleCallExpression,
    handleFunctionDeclaration,
    handleFunctionExpression,
    handleClass,
    handleObjectMethod,
    handleObjectProperty,
    handleReturnOrThrow,
    handleAwait,
    handleYield,
    handleCatchClause,
    handleTryStatement,
    handleForOfStatement,
    handleSpreadElement,
    handleIdentifier,
    handleMemberExpression,
    handleBinaryExpression,
    handleIfStatement,
    handleSwitchStatement,
    handleSwitchCase,
    handleDoWhileStatement,
    handleForInStatement,
    handleForStatement,
    handleWhileStatement,
    handleLogicalExpression,
    handleUpdateExpression,
    handleSequenceExpression,
    handleContinueStatement,
    handleLabeledStatement,
    handleThisExpression,
}

//Adds commands at the beginning of a file. These commands are
//require('server/verifier-lib') and
//popContext so that the the file knows the rid, hid that called it
function handleProgram(path, state) {
    //only add the commands if we are not compiling an eval or new function at runtime
    if (!state.opts || (!state.opts.isNewFunction && !state.opts.isEval)) {
        addRequireRepCol(path, state)
        path.unshiftContainer('body',
            karousos.buildPopContext())
    }
    //initialize the bindings that are considered unsafe
    inspect.initialize_unsafe();
}

//adds require(server/verifier-lib) at the beginning of the block
function addRequireRepCol(path, state) {
    var reqName = state.opts.isVerifier ? '/verifier-lib' : '/server-lib'
    path.unshiftContainer('body',
        karousos.buildRequire(process.env.LIB_HOME + reqName));
    // mark the exported module as visited
    bookkeeping.markVisited(path.get('body')[0].get('declarations')[0].get('init'))
}

function handleTaggedTemplateExpression(path) {
    // replace tagged template expression with a call
    path.replaceWith(t.callExpression(path.node.tag, [path.node.quasi]))
}

function handleVariableDeclaration(path, state) {
    // Convert any const declarations to var. so that we can assign object ids to the objects
    // subsequent to their declaration.
    if (path.node.kind == "const") {
        path.node.kind = "var";
    }
    if (path.node.declarations.length > 1) {
        // Break the variable declaration in multiple single declarations.
        // We only handle some cases
        assert(t.isBlockStatement(path.parent) ||
            t.isProgram(path.parent) ||
            t.isSwitchCase(path.parent));
        // Move all declarations except the first one in separate variable declaration statements
        for (let i = path.node.declarations.length - 1; i > 0; i--) {
            modifiers.insertAfter(
                path,
                t.VariableDeclaration(path.node.kind, [path.node.declarations[i]])
            );
        }
        path.node.declarations = [path.node.declarations[0]];
    } else if (
        t.isObjectPattern(path.node.declarations[0].id) &&
        (
            t.isIdentifier(path.node.declarations[0].init) ||
            t.isMemberExpression(path.node.declarations[0].init)
        )
    ) {
        // This is the case where var {...} = x or var {...} = x.c
        var properties = path.node.declarations[0].id.properties;
        var init = path.node.declarations[0].init;
        // Check that we are not transforming var {... x: y ... } = u
        for (let i = properties.length - 1; i >= 0; i--) {
            if (
                !t.isIdentifier(properties[i].value) ||
                (properties[i].value.name != properties[i].key.name)
            ) {
                return;
            }
        }
        for (let i = properties.length - 1; i >= 0; i--) {
            let prop = properties[i].key;
            if (i > 0) {
                // Break the variable declaration to multiple var p = x.p for all p in init.
                modifiers.insertAfter(
                    path,
                    t.VariableDeclaration(
                        path.node.kind,
                        [
                            t.VariableDeclarator(bookkeeping.copy(prop),
                                t.MemberExpression(bookkeeping.copy(init),
                                    bookkeeping.copy(prop)
                                )
                            )
                        ]
                    )
                );
            } else {
                path.get('declarations')[0].get('id').replaceWith(bookkeeping.copy(prop));
                path.get('declarations')[0].get('init').replaceWith(
                    t.memberExpression(
                        bookkeeping.copy(init),
                        bookkeeping.copy(prop)
                    )
                );
            }
        }
    }
}

function handleVariableDeclarator(path, state) {
    if (bookkeeping.alreadyVisited(path)) return;
    // Put the variable declarator in a separate statement if its parent is not a statement
    modifiers.putAssignmentOrVariableDeclaratorInSeparateStatement(path, state);
    // Replace the init with karousos.getValueOf(init)
    if (!t.isObjectPattern(path.node.id) && !t.isArrayPattern(path.node.id)) {
        karousos.replaceWithValueOf(path.get('init'));
    }
    // Handle the case where this is an implicit call to a symbol iterator
    setHandlerIDForSymbolIteratorCalls(path, path.node.id, path.node.init);
    if (t.isConditionalExpression(path.node.init)) {
        handleConditionalExpression(path.get('init'));
    }
}

function setHandlerIDForSymbolIteratorCalls(path, id, init) {
    //set the handler id of the object id that corresponds to the iterator
    if (t.isArrayPattern(id) && t.isIdentifier(init)) {
        modifiers.insertBefore(path, karousos.buildSetHidForObjID(init))
    }
}

//Transform all x = cond ? cons : alt to if (cond) x = cons else x = alt
function handleConditionalExpression(path) {
    if (bookkeeping.alreadyVisited(path)) {
        return
    }
    if (handleCondInExpression(path)) {
        return false;
    }
    if (t.isAssignmentExpression(path.parent) && t.isSequenceExpression(path.parentPath.parent)) {
        path.get('consequent').replaceWith(t.sequenceExpression([
            karousos.buildUpdateTag('0', true),
            path.node.consequent
        ]))
        path.get('alternate').replaceWith(t.sequenceExpression([
            karousos.buildUpdateTag('1', true),
            path.node.alternate
        ]))
        return false;
    }
    // Check that the conditional expression is either inside a variable declarator, or in an
    // an assignment expression or in an expression statement
    assert(
        (t.isVariableDeclarator(path.parent) && path.parentPath.parent.declarations.length == 1) ||
        (t.isAssignmentExpression(path.parent) && t.isExpressionStatement(path.parentPath.parent)) ||
        t.isExpressionStatement(path.parent)
    );
    var newCons, newAlt
    if (t.isExpressionStatement(path.parent)) {
        newCons = t.expressionStatement(bookkeeping.copy(path.node.consequent))
        newAlt = t.expressionStatement(bookkeeping.copy(path.node.alternate))
        let stmt = path.getStatementParent()
        path.getStatementParent().replaceWith(
            builders.buildIfStatement(bookkeeping.copy(path.node.test),
                t.blockStatement([newCons]),
                t.blockStatement([newAlt])
            )
        )
        path.skip(); //skip traveling this path. it is no longer in the tree
    } else {
        var name;
        if (t.isVariableDeclarator(path.parent)) {
            assert(
                t.isVariableDeclaration(path.parentPath.parent) &&
                path.parentPath.parent.declarations.length == 1
            )
            var res = builders.generateUid(path, 'res');
            newCons = builders.buildVariableDeclaration(
                'var',
                bookkeeping.copy(res),
                bookkeeping.copy(path.node.consequent)
            );
            newAlt = builders.buildVariableDeclaration(
                'var',
                bookkeeping.copy(res),
                bookkeeping.copy(path.node.alternate)
            );
            modifiers.insertBefore(
                path,
                builders.buildIfStatement(
                    bookkeeping.copy(path.node.test),
                    t.blockStatement([newCons]),
                    t.blockStatement([newAlt])
                )
            );
            path.replaceWith(bookkeeping.copy(res));
        } else {
            name = path.parent.left
            newCons = builders.buildAssignmentStatement(
                path.parent.operator,
                name,
                bookkeeping.copy(path.node.consequent)
            );
            newAlt = builders.buildAssignmentStatement(
                path.parent.operator,
                name,
                bookkeeping.copy(path.node.alternate)
            );
            path.getStatementParent().replaceWith(
                builders.buildIfStatement(
                    bookkeeping.copy(path.node.test),
                    t.blockStatement([newCons]),
                    t.blockStatement([newAlt])
                )
            );
            path.skip();
            return true;
        }
    }
    return false;
}


// Handle a conditional that is in not in an expression, a variable declaration or an assignment
// statement by temporarily saving the result in a variable and replacing the conditional with the
// variable
function handleCondInExpression(path) {
    if (t.isVariableDeclarator(path.parent) ||
        t.isAssignmentExpression(path.parent) ||
        t.isExpressionStatement(path.parent)
    ) {
        return false
    }
    let res = builders.generateUid(path, 'res')
    let decl = builders.buildVariableDeclaration('var', res, bookkeeping.copy(path.node))
    path.replaceWith(res)
    modifiers.insertBefore(path, decl)
    return true
}

// We only handle the case where the assignment pattern is inside a function definition
// as an argument and it is not an object pattern. In this case, if we have
// f(... x= y... ){
// ...
//}
// we replace with
// f(...x...)
// {
// if (karousos.isUndefined(x)){x = y}
// ...
// }
function handleAssignmentPattern(path, state) {
    if (inspect.isFunctionDecl(path.parent)) {
        if (!t.isObjectPattern(path.node.left)) {
            path.parentPath.get('body').unshiftContainer('body', t.ifStatement(
                karousos.buildIsUndefined(path.node.left),
                t.blockStatement([
                    builders.buildAssignmentStatement(
                        "=",
                        bookkeeping.copy(path.node.left),
                        bookkeeping.copy(path.node.right))
                ])
            ))
            path.replaceWith(path.node.left)
        }
    }
}

function handleAssignmentExpression(path, state) {
    // Do nothing if the right hand side of the assignment is a call to karousos module
    if (karousos.isCallToRecordAccess(path.get('right'))) {
        path.skip();
        return;
    }
    // If the path is already visited, do nothing
    if (bookkeeping.alreadyVisited(path)) return;
    // Put the assignment in a separate statement if needed
    if (modifiers.putAssignmentOrVariableDeclaratorInSeparateStatement(path, state)) {
        return;
    };
    // converts x o= y to x = x o y;
    var op = path.node.operator;
    if (op != '=') {
        var newOp = op.substring(0, op.length - 1);
        path.node.operator = '=';
        path.get('right').replaceWith(
            t.binaryExpression(
                newOp,
                bookkeeping.copy(path.node.left),
                path.node.right
            )
        );
    }
    // Handle the case where this is an implicit call to a symbol iterator
    setHandlerIDForSymbolIteratorCalls(path, path.node.left, path.node.right);
    // If the right hand side is a conditional expression, try to replace and return if
    // the right hand side is replaced.
    if (t.isConditionalExpression(path.get('right'))) {
        if (handleConditionalExpression(path.get('right'))) {
            return
        }
    }
    // If the left hand side of the assignment is toJSON, toString etc, wrap the function on
    // the right
    if (inspect.mayBeCalledInternally(path.get('left'))) {
        if (t.isIdentifier(path.node.right)) {
            path.get('right').replaceWith(
                t.functionExpression(
                    null,
                    [t.restElement(t.identifier('args'))],
                    t.blockStatement([
                        t.returnStatement(
                            builders.buildCall(
                                path.node.right,
                                'apply',
                                [
                                    t.thisExpression(),
                                    t.identifier('args')
                                ]
                            )
                        )
                    ])
                )
            )
        }
    }
    // We might have overwritten a native js or node function
    inspect.setUnsafeBinding(path);
    // handle the case where we have exports.x = fn();
    splitExportCallResult(path);
    assert(path.node.operator == "=");
    // Replace with karousos.sync unless the left hand side is then, promiseName,
    // or fromPromiseInternal. Also, try to mark the access if needed
    if (
        !path.node.visitedObjID &&
        (
            !t.isIdentifier(path.node.left) ||
            !path.node.left.name.includes("then")
        ) &&
        (
            !t.isMemberExpression(path.node.left) ||
            !t.isIdentifier(path.node.left.property) ||
            !(['then', 'promiseName', 'fromPromiseInternal'].includes(path.node.left.property.name))
        ) &&
        (!t.isMemberExpression(path.get('left')) || !path.node.left.computed)
    ) {
        if (t.isIdentifier(path.get('left'))) {
            addAssignObjIDIfNeeded(path.get('left'), state);
        }
        if (t.isIdentifier(path.get('right'))) {
            addAssignObjIDIfNeeded(path.get('right'), state);
        }
        path.get('right').replaceWith(
            karousos.buildSync(
                path.get('left'),
                path.node.right,
                t.isIdentifier(path.node.left) && t.isMemberExpression(path.node.right)
            )
        )
    }
    bookkeeping.markVisited(path);
}

// Converts exports.x = fn()
// to
// var res = () => { return fn()};
// exports.x = res();
function splitExportCallResult(path) {
    if (
        t.isMemberExpression(path.node.left) &&
        t.isIdentifier(path.node.left.object) &&
        path.node.left.object.name == 'exports' &&
        t.isCallExpression(path.node.right)
    ) {
        var res = builders.generateUid(path, 'res')
        modifiers.insertBefore(
            path,
            builders.buildVariableDeclaration(
                'var',
                res,
                t.arrowFunctionExpression(
                    [],
                    t.blockStatement([
                        t.returnStatement(path.node.right)
                    ])
                )
            )
        );
        path.get('right').replaceWith(t.callExpression(res, []))
    }
}

// Handle a new expression depending on whether it defines a new promise, a new function
// or a general call
function handleNewExpression(path, state, visitor) {
    if (inspect.isPromiseConstructor(path) && mode < 5) {
        prom.handleNewPromise(path, state, false, visitor);
    } else if (inspect.isFunctionConstructor(path)) {
        handleFunctionConstructor(path)
    } else {
        callHandler.handleCall(path, state)
    }
}

// Replace new Function() with karousos.newFunction
function handleFunctionConstructor(path) {
    if (bookkeeping.alreadyVisited(path)) {
        return
    }
    path.node.callee = t.memberExpression(
        t.identifier(inspect.karousosModule), t
        .identifier('newFunction')
    );
    path.node.arguments = ([
        t.identifier(inspect.isGeneratorFunctionConstructor(path).toString()),
        t.identifier(inspect.isAsyncFunctionConstructor(path).toString())
    ]).concat(path.node.arguments)
    bookkeeping.markVisited(path)
}

function handleCallExpression(path, state) {
    if (bookkeeping.alreadyVisited(path)) return;
    callHandler.handleCall(path, state);
}

function handleFunctionDeclaration(path, state, visitor) {
    // mark the id of the function declaration as visited if we are parsing the
    // contents of a variable of new Function or if the is one of the main functions in a file
    if (state.opts.isNewFunction && t.isProgram(path.parent)) {
        bookkeeping.markVisited(path.get('id'))
    }
    // Check if the first parameters is requestID which implies that this is already visited.
    if (t.isIdentifier(path.node.params[0]) && path.node.params[0].name == 'requestID') {
        bookkeeping.markVisited(path);
        path.skip()
        return;
    }
    if (bookkeeping.alreadyVisited(path)) {
        return
    }
    // if the compiler is called to compile a function that was defined with function constructor
    // require the karousos library
    if (state.opts && state.opts.isNewFunction) {
        addRequireRepCol(path.get('body'), state)
    }
    // If this is function could be called implicitly (e.g. toString, toJSON, set, get)
    // add a popContext at the top and parse the subtree of this function
    // keeping the information that this function may be called implicitly in the state
    if (inspect.mayBeCalledInternally(path.get('id')) || inspect.isOn(path.get('id')) || mode >= 5) {
        path.get('body').unshiftContainer('body', karousos.buildPopContext());
        var state2 = bookkeeping.newStateForMaybeCalledInternally(state);
        path.traverse(visitor, state2);
        bookkeeping.markVisited(path);
        return;
    }
    // if the function is a generator, add a pushContext in the beginning of the function
    // and get the hid for of the generator from its object id
    if (path.node.generator) {
        karousos.addStandardIdsToParams(path)
        path.get('body').unshiftContainer('body',
            ([] ? inspect.mayBeCalledInternally(path.get('id')) : karousos.buildPushContext())
            .concat([karousos.buildGetHidForObjID(builders.getIdentifier('objID'))]),
        )
        bookkeeping.markVisited(path.get('body').get('body')[0])
    } else {
        // In all other cases, add [requestID, handlerID, objID, retEventTypes] in the
        // in the beginning of the parameters
        var initParams = bookkeeping.copy(path.node.params)
        karousos.addStandardIdsToParams(path)
        // add a pushContext() call in the beginning of the function
        path.get('body').unshiftContainer('body', karousos.buildPushContext())
        //and prepare the function to be called with New Promise()
        if (!state.opts || !state.opts.isNewFunction) {
            prepareFunctionWhenCalledWithNewPromise(path, state, initParams, path.node.id, visitor)
        }
        // If the body of the function does not have a return statement, add a return statement
        // to id
        addReturnStatement(path.get('body'));
        bookkeeping.markVisited(path)
    }
    //add an objectID to the function
    if (!bookkeeping.alreadyVisited(path.get('id')) && !path.node.id.visitedObjID) {
        modifiers.insertAfter(path, karousos.buildAssignObjectID(path, path.get('id')))
    }
}

function prepareFunctionWhenCalledWithNewPromise(path, state, initParams, functionId, visitor) {
    // check the function parameters to see if this function can be called with new promise
    // the parameters should be either 1 or 2 and both of them should be identifiers.
    if (initParams.length == 0 || initParams.length > 2 ||
        (initParams.length > 0 && !t.isIdentifier(initParams[0])) ||
        (initParams.length > 1 && !t.isIdentifier(initParams[1]))) {
        bookkeeping.markVisited(path)
        return
    }
    //check that the function is not an object property
    if (
        t.isObjectProperty(path.parent) && ['toString', 'toJSON', 'get', 'set'].includes(functionId)
    ) {
        return;
    }
    // generate a random identifier (this will be the promiseName)
    var promNo = generateRandom()
    var promiseID = 'promise' + promNo.toString()
    // turn the body to a block statement if it is not a statement yet
    var body =
        t.isBlockStatement(path.node.body) ?
        bookkeeping.copy(path.node.body) :
        t.blockStatement([bookkeeping.copy(modifiers.turnToStatement(path.node.body))]);
    // Add the new function to be used for promises after the original function.
    // And the statement that assigns a name to this function
    var nextStmt = modifiers.insertAfter(
        path,
        [
            builders.buildAssignmentStatement('=',
                t.memberExpression(functionId, t.identifier('fromPromiseInternal')),
                t.functionExpression(
                    null,
                    bookkeeping.copy(initParams),
                    body,
                    false,
                    path.node.async
                )
            ),
            builders.buildAssignmentStatement('=',
                t.memberExpression(functionId, t.identifier('promiseName')),
                t.stringLiteral(promiseID)
            )
        ]);
    // parse the body of the function as an internal function with promiseName the one above
    var promiseFuncPath = inspect.getNextStatement(path, nextStmt).get('expression').get('right')
    // Add promise-related statements to the new function to be used with Promise.new
    prom.handleInternalOfNewPromise(promiseFuncPath, state, promiseID, visitor)
    //mark this function as a promise function. this is used later in order not to
    //assign objectIDs to the arguments
    bookkeeping.markVisited(path)
    bookkeeping.markVisited(promiseFuncPath)
}

// add a return statement at the end of the body
// if the function body does not have a return statement
function addReturnStatement(body) {
    assert(t.isBlockStatement(body));
    if (lastStmtIsReturn(body.get('body'))) return;
    body.pushContainer('body', t.returnStatement());
}

function lastStmtIsReturn(body) {
    var lastStmt = body[body.length - 1];
    return t.isReturnStatement(lastStmt) || t.isThrowStatement(lastStmt);
}

function generateRandom() {
    return Math.floor((Math.random() * 100000) + 1)
}

function handleFunctionExpression(path, state, visitor) {
    // If this is an arrow function expression the body might not be a block so we
    // need to convert it to a block
    if (t.isArrowFunctionExpression(path)) {
        modifiers.turnBodyToBlockStatement(path);
    }
    // Check if the first parameters is requestID which implies that this is already visited.
    if (t.isIdentifier(path.node.params[0]) && path.node.params[0].name == 'requestID' && !bookkeeping.alreadyVisited(path)) {
        bookkeeping.markVisited(path);
        path.skip();
        return;
    }
    if (bookkeeping.alreadyVisited(path)) {
        return
    }
    modifiers.turnBodyToBlockStatement(path)
    // Find the function name
    var name = findName(path, true);
    // If this is function could be called implicitly (e.g. toString, toJSON, set, get)
    // add a popContext at the top and parse the subtree of this function
    // keeping the information that this function may be called implicitly in the state
    if (inspect.mayBeCalledInternally(name) || inspect.isOn(name) || mode >= 5) {
        path.get('body').unshiftContainer('body', karousos.buildPopContext());
        var state2 = bookkeeping.newStateForMaybeCalledInternally(state);
        path.traverse(visitor, state2);
        bookkeeping.markVisited(path);
        placeFunctionExpressionInSeparateStatement(path, state);
        return;
    }
    //if it is a symbol iterator
    if (inspect.isSymbolIterator(inspect.getSuffix(name))) {
        //push the context in the beggining of the fucnction,
        path.get('body').unshiftContainer('body', karousos.buildPushContext());
        //add an objectID and a requestID to the object
        modifiers.insertAfter(path.getStatementParent(), [
            karousos.buildSetObjIDAndRid(name)
        ])
        //when the function gets called, read the objectID and the requestID from the ones
        //saved in the generator
        path.get('body').unshiftContainer('body', retrieveIteratorStateStmts(name))
        //parse the function body
        var state2 = bookkeeping.newStateWithObjName(state, objName)
        path.traverse(visitor, state2)
        bookkeeping.markVisited(path)
        return
    }
    // If it is passed as an argument to specific function just add a push context
    // in the beginning
    if (inspect.isCallToPromise(path.parentPath, state) ||
        inspect.isEvery(path.parentPath) ||
        inspect.isReflectConstructOfPromise(path.parentPath.parentPath, state)) {
        path.get('body').unshiftContainer('body', karousos.buildPushContext());
        bookkeeping.markVisited(path)
        return
    }
    // place it in a separate statement. If there is indeed placed in a separate
    // statement return. the path is now just an identifier
    if (placeFunctionExpressionInSeparateStatement(path, state)) {
        return
    }
    // Add a name to the function
    var functionId = modifiers.addIdToFunctionExpression(path)
    // if the function is a generator, add a pushContext in the beginning of the function
    // and get the hid for of the generator from its object id
    if (path.node.generator) {
        path.get('body').unshiftContainer('body', karousos.buildPushContext());
        karousos.addStandardIdsToParams(path)
        path.get('body').unshiftContainer('body',
            [
                karousos.buildGetHidForObjID(builders.getIdentifier('objID')),
            ]
        );
        bookkeeping.markVisited(path)
        return
    }
    // In all other cases, add [requestID, handlerID, objID, retEventTypes] in the
    // in the beginning of the parameters
    var initParams = bookkeeping.copy(path.node.params)
    karousos.addStandardIdsToParams(path)
    //and prepare the function to be called with New Promise()
    if (!state.opts || !state.opts.isNewFunction) {
        prepareFunctionWhenCalledWithNewPromise(path, state, initParams, functionId, visitor)
    }
    path.get('body').unshiftContainer('body', karousos.buildPushContext());
    // If the body of the function does not have a return statement, add a return statement
    // to id
    addReturnStatement(path.get('body'));
    bookkeeping.markVisited(path)
}

// Find the name of the function
function findName(path, isFunction) {
    if (t.isAssignmentExpression(path.parent)) {
        return path.parentPath.get('left')
    } else if (t.isVariableDeclarator(path.parent)) {
        return path.parentPath.get('id')
    } else if (t.isObjectProperty(path.parent)) {
        return path.parentPath.get('key')
    } else if (isFunction) {
        return path.get('id')
    } else if (t.isClassDeclaration(path.parent) || t.isClassExpression(path.parent)) {
        return path.parentPath.get('id')
    }
    throw new Error('could not find name')
}

function placeFunctionExpressionInSeparateStatement(path, state) {
    // If the function expression is not in an assignment expression or a variable declarator
    // or an expression statement, replace with res and add "var res = function expression" before
    // this statement
    if ((t.isAssignmentExpression(path.parent) && t.isIdentifier(path.parent.left)) ||
        t.isVariableDeclarator(path.parent) ||
        t.isExpressionStatement(path.parent) ||
        (
            t.isObjectProperty(path.parent) &&
            inspect.mayBeCalledInternally(path.parentPath.get('key'))
        )
    ) {
        return false
    }
    modifiers.putInSeparateStatement(path)
    return true
}

function retrieveIteratorStateStmts(name) {
    return [
        builders.buildVariableDeclaration('var', 'objID',
            t.memberExpression(name, builders.getIdentifier('objID'))),
        builders.buildAssignmentStatement('=', builders.getIdentifier('requestID'),
            t.memberExpression(name,
                builders.getIdentifier('requestID'))),
        karousos.buildGetHidForObjID(builders.getIdentifier('objID'), 'var'),
    ]
}

function handleClass(path, state, visitor) {
    // If the class does not have a super do nothing
    if (!path.node.superClass) {
        return
    }
    // if the superClass is a function call, move it to a separate statement
    if (t.isCallExpression(path.node.superClass)) {
        modifiers.putInSeparateStatement(path.get('superClass'))
    }
    // We only handle cases where the superClass is an identifier or a
    // member expression consisting of identifiers and other member expressions.
    assert(inspect.isIdentifierOrSimpleMemberExp(path.get('superClass')));
    // If there are no class methods,
    if (path.node.body.body.length == 0) {
        //we need to add a constructor
        path.get('body').replaceWith(t.classBody([
            t.classMethod(
                "constructor",
                t.identifier("constructor"),
                [t.restElement(t.identifier('args'))],
                t.blockStatement([
                    builders.buildCallStatement(t.super(), undefined, [
                        t.spreadElement(t.identifier('args'))
                    ])
                ])
            )
        ]))
    }
    // parse all class methods keeeping in state what is the superClass
    var newState = bookkeeping.newStateForSuper(state, path.node.superClass);
    path.traverse(visitor, newState);
}

function handleObjectMethod(path, state, visitor) {
    if (bookkeeping.alreadyVisited(path)) {
        return
    }
    // If this is function could be called implicitly (e.g. toString, toJSON, set, get)
    // add a popContext at the top and parse the subtree of this function
    // keeping the information that this function may be called implicitly in the state
    if (inspect.mayBeCalledInternally(path.get('key')) || mode >= 5) {
        path.get('body').unshiftContainer('body', karousos.buildPopContext());
        var state2 = bookkeeping.newStateForMaybeCalledInternally(state);
        path.traverse(visitor, state2);
        bookkeeping.markVisited(path);
        return;
    }
    //if it is a symbol iterator
    if (inspect.isSymbolIterator(path.get('key'))) {
        // Check that it is inside an object expression or the body of a class
        if (!t.isObjectExpression(path.parentPath) && !t.isClassBody(path.parentPath)) {
            console.log(path.parent)
            throw new Error('Object Method not inside Object expression')
        }
        // Move the class method or object expression in a separate statement
        // if it is not in a variable declarator, an assignment expression,
        // a class declaration or a class expression
        if (
            !t.isVariableDeclarator(path.parentPath.parentPath) &&
            !t.isAssignmentExpression(path.parentPath.parentPath) &&
            !t.isClassDeclaration(path.parentPath.parent) &&
            !t.isClassExpression(path.parentPath.parent)
        ) {
            modifiers.putInSeparateStatement(path.parentPath)
            path.skip()
        } else if (
            !t.isClassDeclaration(path.parentPath.parent) &&
            !t.isClassExpression(path.parentPath.parent)
        ) {
            // If the object expression or class body is in an assignment statement or
            // variable declaration, assign an id and an object id to it
            var objName = findName(path.parentPath, false).node;
            var objID = builders.generateUid(path, 'objID')
            modifiers.insertAfter(path.getStatementParent(), [
                karousos.buildSetObjIDAndRid(objName)
            ])
            // traverse the class body statements keeping in state what the object name is
            bookkeeping.markVisited(path)
            bookkeeping.markVisitedParams(path)
            var state2 = bookkeeping.newStateWithObjName(state, objName)
            path.traverse(visitor, state2)
            path.skip()
        }
    } else if (t.isIdentifier(path.get('key')) && path.node.key.name == 'next') {
        // if it is a next method:
        // if it is not asynchronous just pop the context
        if (!path.node.async) {
            path.get('body').unshiftContainer('body',
                karousos.buildPopContext()
            )
            bookkeeping.markVisited(path);
            bookkeeping.markVisitedParams(path);
        }
        if (state.objName) {
            // If we know the object name from the state, add statements to
            // retrieve the state (handler id etc) in the beginning of the function
            path.get('body').unshiftContainer('body',
                retrieveIteratorStateStmts(state.objName))
            bookkeeping.markVisited(path)
            bookkeeping.markVisitedParams(path.get('value'))
        } else {
            // Otherwise, make sure that the parent is an object expression or class body
            if (!t.isObjectExpression(path.parentPath) && !t.isClassBody(path.parentPath)) {
                throw new Error('Object Method not inside Object expression')
            }
            // Move the class method or object expression in a separate statement
            // if it is not in a variable declarator, an assignment expression,
            // a class declaration or a class expression
            if (!t.isVariableDeclarator(path.parentPath.parentPath) &&
                !t.isAssignmentExpression(path.parentPath.parentPath) &&
                !t.isClassDeclaration(path.parentPath.parent) &&
                !t.isClassExpression(path.parentPath.parent)) {
                modifiers.putInSeparateStatement(path.parentPath)
            } else {
                // otherwise, find the object name and add statement to retrieve the
                // state (handler id etc.) in the beginning of the function
                var objName = findName(path.parentPath, false).node
                path.get('body').unshiftContainer('body', retrieveIteratorStateStmts(objName))
                bookkeeping.markVisited(path)
                bookkeeping.markVisitedParams(path)
            }
        }
    } else if (path.node.generator) {
        // if it is a generator, add ids to the parameters of the function
        karousos.addStandardIdsToParams(path)
        // add a call to GetHidForObjID at the beginning of the function
        path.get('body').unshiftContainer('body',
            [karousos.buildGetHidForObjID(builders.getIdentifier('objID')), ])
        bookkeeping.markVisited(path);
    } else {
        bookkeeping.markVisited(path);
        // We only add [requestID, handlerID, objID, retEventTypes] to the function
        // parameters iff the name of the method is not one that can be called
        // internally/implicitly
        if (
            inspect.identifierOneOf(
                path.get('key'),
                ['return', 'throw', 'toString', 'valueOf']
            ) ||
            (
                t.isStringLiteral(path.node.key) &&
                (['return', 'throw']).includes(path.node.key.value)
            ) || ['get', 'set', 'toString', 'toJSON'].includes(path.node.kind) ||
            (
                t.isIdentifier(path.node.key) &&
                (['get', 'set']).includes(path.node.key.name)
            )
        ) {
            // if the function may be called implicitly, turn its body to a block
            // statement and add a popContext at the beginning.
            if (!t.isBlockStatement(path.node.body)) {
                path.get('body').replaceWith(t.blockStatement([path.node.body]))
            }
            path.get('body').unshiftContainer('body', karousos.buildPopContext())
        } else {
            karousos.addStandardIdsToParams(path)
        }
    }
}

function handleObjectProperty(path, state, visitor) {
    if (bookkeeping.alreadyVisited(path)) {
        return
    }
    //if it is a symbol iterator
    if (inspect.isSymbolIterator(path.get('key'))) {
        // Check that it is inside an object expression
        if (!t.isObjectExpression(path.parentPath)) {
            throw new Error('Object Method not inside Object expression')
        }
        // Move the object expression in a separate statement
        // if it is not inside a variable declarator or an assignment expression
        if (!t.isVariableDeclarator(path.parentPath.parentPath) &&
            !t.isAssignmentExpression(path.parentPath.parentPath)) {
            modifiers.putInSeparateStatement(path.parentPath, false)
            path.skip()
        } else {
            // If the object expression or class body is in an assignment statement
            // or variable declaration assign an id and an object id to it
            var objName = findName(path.parentPath, false).node
            var objID = builders.generateUid(path, 'objID')
            modifiers.insertAfter(path.getStatementParent(), [
                karousos.buildSetObjIDAndRid(objName)
            ])
            bookkeeping.markVisited(path)
            bookkeeping.markVisitedParams(path)
            // traverse the object statements keeping in state what the object name is
            var state2 = bookkeeping.newStateWithObjName(state, objName)
            path.traverse(visitor, state2)
            path.skip()
        }
    } else if (t.isIdentifier(path.get('key')) && path.node.key.name == 'next') {
        // if key = next:
        // do nothing if the key is mapped to null
        if (t.isNullLiteral(path.node.value) || path.node.value.name == path.node.key.name) {
            return;
        }
        var funcBody; // the body of the function
        //replace with a function call if it is not a function
        if (!t.isFunctionExpression(path.node.value) && !t.isArrowFunctionExpression(path.node.value)) {
            path.get('value').replaceWith(builders.buildCall(t.arrowFunctionExpression([],
                    t.blockStatement([
                        karousos.buildPopContext(),
                        t.returnStatement(path.node.value)
                    ])),
                null, []
            ))
            funcBody = path.get('value').get('callee').get('body')
            bookkeeping.markVisited(path.get('value'))
        } else {
            funcBody = path.get('value').get('body')
        }
        assert(t.isBlockStatement(funcBody));
        if (state.objName != undefined) {
            // If we know the object name from the state, add statements to
            // retrieve the state (handler id etc) in the beginning of the function
            var objName = state.objName
            funcBody.unshiftContainer('body',
                retrieveIteratorStateStmts(objName))
            bookkeeping.markVisited(path)
            bookkeeping.bookkeeping.markVisitedParams(funcBody)
        } else {
            //if this is of the form: {} = ... then don't do anything
            if (t.isObjectPattern(path.parentPath)) {
                assert(t.isVariableDeclarator(path.parentPath.parent))
                return
            }
            // Otherwise, make sure that the parent is an object expression or class body
            if (!t.isObjectExpression(path.parentPath)) {
                console.log(path.parentPath.parent, path.parent, path.node)
                throw new Error('Object Method not inside Object expression')
            }
            // Move the class method or object expression in a separate statement
            // if it is not in a variable declarator, or an assignment expression
            if (!t.isVariableDeclarator(path.parentPath.parentPath) &&
                !t.isAssignmentExpression(path.parentPath.parentPath)) {
                modifiers.putInSeparateStatement(path.parentPath)
            } else {
                // otherwise, find the object name and add statement to retrieve the
                // state (handler id etc.) in the beginning of the function
                var objName = findName(path.parentPath, false).node
                funcBody.unshiftContainer('body',
                    retrieveIteratorStateStmts(objName))
                bookkeeping.markVisited(path)
                bookkeeping.markVisitedParams(funcBody)
            }
        }
    } else if (path.node.value.generator) {
        // if it is a generator, add ids to the parameters of the function
        karousos.addStandardIdsToParams(path)
        // add a call to GetHidForObjID at the beginning of the function
        path.get('value').get('body').unshiftContainer('body',
            [karousos.buildGetHidForObjID(builders.getIdentifier('objID')), ])
        bookkeeping.markVisited(path)
    } else if (
        t.isFunctionExpression(path.node.value) ||
        t.isArrowFunctionExpression(path.node.value)
    ) {
        // We only add [requestID, handlerID, objID, retEventTypes] to the function
        // parameters iff the name of the method is not one that can be called
        // internally/implicitly
        if (
            inspect.identifierOneOf(
                path.get('key'),
                ['return', 'throw', 'toString', 'toJSON', 'valueOf']
            ) ||
            (
                t.isStringLiteral(path.node.key) &&
                (['return', 'throw']).includes(path.node.key.value)
            ) ||
            (
                t.isIdentifier(path.node.key) &&
                (['get', 'set']).includes(path.node.key.name)
            ) &&
            (
                !t.isIdentifier(path.node.value) ||
                path.node.value.name != path.node.key.name
            )
        ) {
            // if the function may be called implicitly, turn its body to a block
            // statement and add a popContext at the beginning.
            if (!t.isBlockStatement(path.node.value.body)) {
                path.get('value').get('body').replaceWith(t.blockStatement([t.returnStatement(path.node.value.body)]))
            }
            path.get('value').get('body').unshiftContainer('body', karousos.buildPopContext())
        } else {
            karousos.addStandardIdsToParams(path)
        }
    } else if (
        !inspect.isLiteral(path.node.value) &&
        !t.isIdentifier(path.node.value) &&
        !t.isAwaitExpression(path.node.value) &&
        !t.isObjectExpression(path.node.value) &&
        !t.isArrayExpression(path.node.value) &&
        (
            !t.isAssignmentPattern(path.node.value) ||
            (
                !inspect.isLiteral(path.node.value.right) &&
                !t.isIdentifier(path.node.value.right) &&
                !t.isAwaitExpression(path.node.value.right) &&
                !t.isObjectExpression(path.node.value.right) &&
                !t.isArrayExpression(path.node.value.right)
            )
        )
    ) {
        //replace the value with a fucntion call so that we can
        //make any necessary modifications to the value
        // the next few lines handle the case where we have an assignment pattern or a
        // simple object property
        if (t.isAssignmentPattern(path.node.value)) {
            assert(t.isIdentifier(path.node.key) && t.isIdentifier(path.node.value.left))
            var body = [t.returnStatement(path.node.value.right)];
            var fn = t.arrowFunctionExpression([
                t.identifier('requestID'),
                t.identifier('handlerID'),
                t.identifier('retEventTypes'),
                t.identifier('objID')
            ], t.blockStatement(body))
            var toReplace = t.assignmentPattern(path.node.value.left, t.callExpression(fn, [
                t.identifier('requestID'),
                t.identifier('handlerID'),
                t.arrayExpression([]),
                t.stringLiteral('')
            ]))
            path.get('value').replaceWith(toReplace);
            bookkeeping.markVisited(path.get('value').get('right'));
            bookkeeping.markVisited(path.get('value').get('right').get('callee'));
        } else {
            var body = [t.returnStatement(path.node.value)]
            var fn = t.arrowFunctionExpression([
                t.identifier('requestID'),
                t.identifier('handlerID'),
                t.identifier('retEventTypes'),
                t.identifier('objID')
            ], t.blockStatement(body))
            var toReplace = t.callExpression(fn, [
                t.identifier('requestID'),
                t.identifier('handlerID'),
                t.arrayExpression([]),
                t.stringLiteral('')
            ])
            path.get('value').replaceWith(toReplace);
            bookkeeping.markVisited(path.get('value'));
            bookkeeping.markVisited(path.get('value').get('callee'));
        }
    }
}

function handleReturnOrThrow(path, state, success) {
    // add Emit event before the statement
    ret.addEmitBeforeReturnOrThrow(path, success, state)
    if (state.objName != undefined) {
        // If we are inside an iterator or a generator
        // add a SetObjIDAndRid before returning
        var arg = path.node.argument != null ? path.node.argument : t.objectExpression([])
        let toAdd = []
        if (!t.isIdentifier(arg) && !t.isMemberExpression(arg)) {
            modifiers.putInSeparateStatement(arg)
        }
        let stmt = karousos.buildSetObjIDAndRid(arg,
            t.memberExpression(state.objName, builders.getIdentifier('objID')),
            t.memberExpression(state.objName, builders.getIdentifier('requestID'))
        )
        path.getStatementParent().insertBefore([stmt])
    }
}

function handleAwait(path, state) {
    awaitStmts.handleAwait(path, state)
}

function handleYield(path, state) {
    yieldStmts.handleYield(path, state)
}

function handleCatchClause(path, state) {
    if (bookkeeping.alreadyVisited(path)) {
        return
    }
    bookkeeping.markVisited(path)
    var toAdd = []
    var error = path.node.param
    // make sure that the error in the catch clause is an identifier
    if (error == null) {
        error = builders.generateUid(path, 'e')
        path.node.param = error
    } else if (t.isArrayPattern(error) || t.isArrayExpression(error)) {
        error = builders.generateUid(path, 'e')
        toAdd.push(builders.buildVariableDeclaration('var', path.node.param, error))
        path.node.param = error
    }
    // Assign an object id to the error
    toAdd.push(karousos.buildAssignObjectID(path, error));
    var errObjID = t.memberExpression(error, t.identifier('objID'));
    var events = t.arrayExpression([errObjID]);
    var functionID = builders.generateUid(path, 'functionID')
    var buildRegister = karousos.buildRegisterEvent(functionID.name, events, 'fail')
    var buildEmit = karousos.buildEmitEvent('fail', undefined, events)
    var updateHid = karousos.buildGetHandlerID(
        functionID.name, events,
        'fail',
        state.isVerifier,
        [path.node.param]
    );
    var buildUnregister = karousos.buildUnregisterEvent(functionID.name, events, 'fail')
    path.get('body').unshiftContainer(
        'body',
        toAdd.concat([
            buildRegister, // Register the function for the error event
            buildEmit, // Emit the error event
            buildUnregister, // Unregister the function for the error event
            updateHid // Set the handler id of the catch clause
        ])
    );
}

function handleTryStatement(path, state) {
    if (bookkeeping.alreadyVisited(path)) {
        path.skip();
        return;
    }
    //Add throw statements to catch clauses so that we know
    //which handler is running
    if (path.node.handler == null) {
        var err = builders.generateUid(path, 'error');
        path.get('handler').replaceWith(t.catchClause(
            err,
            t.blockStatement([t.throwStatement(err)])
        ))
    }
}


function handleForOfStatement(path) {
    if (bookkeeping.alreadyVisited(path)) return;
    // Wrap the body in a block statement
    if (!t.isBlockStatement(path.node.body)) {
        path.node.body = t.blockStatement([path.node.body])
    }
    // If the expression in "of" is a call then put it in a separate statement
    if (t.isCallExpression(path.node.right) || t.isNewExpression(path.node.right)) {
        modifiers.putInSeparateStatement(path.get('right'))
    }
    // Replace the expression in "of" with a call to getValueOf if this is an identifier
    var iter = path.node.right
    if (t.isIdentifier(path.get('right'))) {
        karousos.replaceWithValueOf(path.get('right'))
    }
    // handle the case where the for of is asynchronouw
    if (path.node.await) {
        awaitStmts.handleForAwaitOf(path)
    }
    // Turn the body to a block statement
    modifiers.turnBodyToBlockStatement(path)
    // If we are iterating over an array, set the hid for the object id before the For..of
    // and at the end of each iteration, and get the hid for the object id at the beginning
    // of each iteration
    if (!t.isArrayExpression(iter)) {
        path.insertBefore(karousos.buildSetHidForObjID(iter))
        path.get('body').unshiftContainer('body',
            [karousos.buildGetHidForObjID(iter)])
        path.get('body').pushContainer('body',
            [karousos.buildSetHidForObjID(iter)])
    }
    addTagCollectionToLoop(path)
    bookkeeping.markVisited(path);
}

function addTagCollectionToLoop(path) {
    if (bookkeeping.alreadyVisited(path)) {
        return
    }
    // Turn the body into a block
    if (path.node.body == null) {
        path.get('body').replaceWith(t.blockStatement([]))
    }
    if (!t.isBlockStatement(path.node.body)) {
        path.get('body').replaceWith(t.blockStatement([path.node.body]))
    }
    // add an updateTag call at the beginning of the iteration and when we exit the loop
    path.get('body').unshiftContainer('body', [karousos.buildUpdateTag('0')])
    modifiers.insertAfter(path, [karousos.buildUpdateTag('1')])
    bookkeeping.markVisited(path)
}

function handleSpreadElement(path) {
    // Don't do anything if it is ...arguments
    if (t.isIdentifier(path.node.argument) && path.node.argument.name == 'arguments') {
        return;
    }
    // Modification so that the argument is always either a member expression or an identifier
    if (!t.isMemberExpression(path.node.argument) && !t.isIdentifier(path.node.argument)) {
        modifiers.putInSeparateStatement(path.get('argument'))
    }
    // It might be an asynchronous iterator so set the handler id for the object that corresponds
    // to the iterator
    let objName = path.node.argument
    path.getStatementParent().insertBefore(karousos.buildSetHidForObjID(objName))
    // Wrap the argument in getValueOf
    if (t.isIdentifier(path.get('argument'))) {
        karousos.replaceWithValueOf(path.get('argument'))
    }
}

function handleIdentifier(path, state) {
    if (bookkeeping.alreadyVisited(path)) return;
    if (
        !handleArgumentsIdentifier(path, state) &&
        path.node.name != 'super' &&
        path.node.name != "undefined" &&
        path.node.name != "JSON"
    ) {
        // We need to assign an object id to the identifier if it is not a special keyword
        // e.g. arguments, super, undefined, JSON
        addAssignObjIDIfNeeded(path, state)
        // Sometimes we need to wrap the identifier in getValueOf
        if (
            (
                t.isMemberExpression(path.parent) &&
                (path.parentPath.get('object') == path || path.parent.computed)
            ) ||
            (t.isIfStatement(path.parent) && path.parentPath.get('test') == path) ||
            t.isTemplateLiteral(path.parent) ||
            t.isVariableDeclarator(path.parent) && path.parentPath.get('init') == path) {
            karousos.replaceWithValueOf(path);
        }
    }
    bookkeeping.markVisited(path);
}

// handle the case where the identifier is the keyword arguments
// returns a boolean indicating whether the identifier is arguments
function handleArgumentsIdentifier(path, state) {
    if (
        path.node.name == 'arguments' &&
        !t.isObjectProperty(path.parent) &&
        !t.isClassMethod(path.parent) && (
            !t.isMemberExpression(path.parent) ||
            !t.isIdentifier(path.parent.property) ||
            path.parent.property.name != 'arguments')
    ) {
        // If it is not called internally then replace the arguments with arguments.slice(4)
        // to remove the first 4 arguments (requestID, handlerID, objID, retEventTypes)
        if (!state.maybeCalledInternally) {
            if (bookkeeping.alreadyVisited(path)) return;
            path.replaceWith(builders.buildCall(
                builders.buildCall('Array', 'from', [t.identifier('arguments')]),
                'slice',
                [t.numericLiteral(4)]
            ))
            bookkeeping.markVisited(path.get('callee'));
            bookkeeping.markVisited(path.get('callee').get('object').get('arguments')[0]);
            bookkeeping.markVisited(path.get('callee').get('object'));
        }
        bookkeeping.markVisited(path);
        return true;
    }
    return false;
}

function addAssignObjIDIfNeeded(path, state) {
    // Check the type of the given path. In some cases we don't need to add an assignObjID call
    if (
        t.isCallExpression(path) ||
        t.isNewExpression(path) ||
        inspect.isLiteral(path) ||
        t.isUpdateExpression(path) ||
        (t.isMemberExpression(path) && path.node.computed)
    ) return
    // Further check if we need to add an object id
    var [needToAddObjID, isRead, whereToAdd, isNewObject] = getAssignObjIDparams(path, state);
    if (needToAddObjID) {
        var assignObjID = karousos.buildAssignObjectID(path, path, isRead, isNewObject);
        if (whereToAdd != null) {
            // Add the assignment statement after popContext if we need to add it inside the body
            if (
                whereToAdd.node.body &&
                whereToAdd.node.body.body &&
                whereToAdd.node.body.body.length > 0 &&
                karousos.isCallToPopContext(whereToAdd.node.body.body[0])
            ) {
                modifiers.insertAfter(whereToAdd.get('body').get('body')[0], assignObjID)
            } else {
                // add it to the beginning of body
                whereToAdd.get('body').unshiftContainer('body', assignObjID);
            }
        } else {
            // If we are reading the variable assign the object id before the statement,
            // otherwise, add it after
            if (isRead) {
                modifiers.insertBefore(path, assignObjID);
            } else {
                modifiers.insertAfter(path, assignObjID);
            }
        }
    }
}


function handleMemberExpression(path, state) {
    if (bookkeeping.alreadyVisited(path)) return;
    // Replace with findLength if it is a length property
    if (
        inspect.isLengthProperty(path) &&
        !t.isUpdateExpression(path.parentPath) &&
        mode < 6
    ) {
        // Record the access/assign object id to object if needed
        addAssignObjIDIfNeeded(path.get('object'), state);
        path.replaceWith(karousos.buildFindLength(path.node.object))
        bookkeeping.markVisited(path)
        return;
    }
    // replace all members of the member expression with identifiers
    modifiers.replaceWithIdentifiers(path);
    // assign an object id if needed
    addAssignObjIDIfNeeded(path, state);
    // wrap the object in getValueOf
    karousos.replaceWithValueOf(path.get('object'))
    // if it is of the form x[y]
    if (path.node.computed) {
        // if it is the right hand side of an assignment expression, and we are creating the
        // code for the verifier, replace it with a call to karousos.memberOf
        if (
            state.opts.isVerifier &&
            (!t.isAssignmentExpression(path.parentPath) || path.parentPath.get('left') != path)
        ) {
            path.replaceWith(
                karousos.buildCallToMemberOf(path.get('object'), path.get('property'))
            );
        }
        // wrap the member if getValueOf
        karousos.replaceWithValueOf(path.get('property'));
    }
    bookkeeping.markVisited(path);
}

// mark the inputs as accessed (with assignObjectID) if needed
function handleBinaryExpression(path, state) {
    addAssignObjIDIfNeeded(path.get('left'), state);
    addAssignObjIDIfNeeded(path.get('right'), state);
}

function handleIfStatement(path) {
    if (bookkeeping.alreadyVisited(path)) {
        return
    }
    // Do nothing if the test is karousos.reportCollectionActivated
    if (
        t.isCallExpression(path.node.test) &&
        t.isMemberExpression(path.node.test.callee) &&
        t.isIdentifier(path.node.test.callee.property) &&
        t.isIdentifier(path.node.test.callee.object) &&
        path.node.test.callee.property.name == 'reportCollectionActivated'
    ) {
        bookkeeping.markVisited(path);
        bookkeeping.markVisited(path.get('test'))
        return;
    }
    // wrap the altenate and consequent in block statements.
    if (path.node.alternate == null) {
        path.get('alternate').replaceWith(t.blockStatement([]))
    }
    if (!t.isBlockStatement(path.node.consequent)) {
        path.get('consequent').replaceWith(t.blockStatement([path.node.consequent]))
    }
    if (!t.isBlockStatement(path.node.alternate)) {
        path.get('alternate').replaceWith(t.blockStatement([path.node.alternate]))
    }
    //add karousos.updateTag to if statements
    path.get('consequent').unshiftContainer('body', [karousos.buildUpdateTag('0')])
    path.get('alternate').unshiftContainer('body', [karousos.buildUpdateTag('1')])
    // wrap test in getValueOf
    karousos.replaceWithValueOf(path.get('test'));
    bookkeeping.markVisited(path)
}

function handleSwitchStatement(path) {
    if (bookkeeping.alreadyVisited(path)) {
        return
    }
    //add karousos.updateTag to switch statements
    for (var i = 0; i < path.node.cases.length; i++) {
        let csPath = path.get('cases')[i]
        csPath.unshiftContainer('consequent', [karousos.buildUpdateTag(i.toString())])
    }
    // wrap discriminant in getValueOf
    karousos.replaceWithValueOf(path.get('discriminant'));
    bookkeeping.markVisited(path)
}

function handleSwitchCase(path) {
    // wrap test in getValueOf
    karousos.replaceWithValueOf(path.get('test'))
}

function handleDoWhileStatement(path, state, visitor) {
    var updateCond = rewriteCondition(path);
    addTagCollectionToLoop(path);
    var newState = bookkeeping.newStateForLoop(state, updateCond);
    // traverse the tree keeping in the state that we are inside a loop
    path.traverse(visitor, newState);
    // wrap test in getValueOf
    karousos.replaceWithValueOf(path.get('test'));
}

//Rewrite a do-while or while statement as follows:
//If it is a while statement while(expr) body transform it to
//var cond = expr;
//while(cond){ body; cond = expr}
//if it is a do while statement do{body} while(expr) we transform it to
//var cond; do{body; cond = expr}while(cond)
function rewriteCondition(path) {
    var condition = path.node.test;
    var res = builders.generateUid(path, 'cond');
    var update = builders.buildAssignmentStatement('=', res, bookkeeping.copy(condition));
    //transform body to blockStatement if it is not
    if (!t.isBlockStatement(path.get('body')))
        path.get('body').replaceWith(t.blockStatement([path.node.body]));
    //Initialize the declaration of cond appopriately
    var varDecl = t.isWhileStatement(path) ?
        builders.buildVariableDeclaration('var', res, bookkeeping.copy(condition)) :
        builders.buildVariableDeclaration('var', res);
    modifiers.insertBefore(path, varDecl)
    path.get('body').pushContainer('body', update)
    path.get('test').replaceWith(res)
    return update;
}

function handleForInStatement(path) {
    // wrap the in part in getValueOf
    if (t.isIdentifier(path.get('right'))) {
        karousos.replaceWithValueOf(path.get('right'))
    }
    addSkipObjectID(path);
    addTagCollectionToLoop(path);
}

//adds if (property == 'objID') {continue} at the beginning of the body of for in statement
function addSkipObjectID(path) {
    var left;
    // We only handle some cases
    if (t.isIdentifier(path.node.left)) {
        left = path.node.left;
    } else if (t.isVariableDeclaration(path.node.left)) {
        assert(path.node.left.declarations.length == 1)
        assert(t.isIdentifier(path.node.left.declarations[0].id))
        assert(path.node.left.declarations[0].init == null)
        left = path.node.left.declarations[0].id;
    } else {
        assert(false);
    }
    assert(t.isIdentifier(path.node.left) || t.isVariableDeclaration(path.node.left))
    modifiers.replaceWithBlockStatement(path.get('body'));
    var skipObjectID = builders.buildIfStatement(
        karousos.buildShouldSkipObjID(left, path.node.right),
        t.continueStatement()
    )
    path.get('body').unshiftContainer('body', skipObjectID);
    //mark as visited the objectID
    bookkeeping.markVisited(path.get('body').get('body')[0]);
}

function handleForStatement(path, state, visitor) {
    if (bookkeeping.alreadyVisited(path)) return;
    // If there are multiple variable declarations in the init move them out of the loop
    if (removeMultiDeclarationFromForStmt(path)) {
        return
    }
    // Wrap the body in a block statement
    modifiers.replaceWithBlockStatement(path.get('body'));
    var toAddBeforeContinue = []; // These are the statements we need to add before each continue
    var update = path.node.update;
    // the update always happens at the end of the loop.
    if (update) {
        path.get('body').pushContainer('body', t.expressionStatement(bookkeeping.copy(update)));
        path.get('update').remove();
        // the update should also be done before the continue
        toAddBeforeContinue.push(t.expressionStatement(bookkeeping.copy(update)));
    }
    if (path.node.test) {
        //Modify the code so that the test does not happen inside the () of For
        var res = builders.generateUid(path, 'res');
        // The declaration of the test variable
        var testVarDecl = builders.buildVariableDeclaration(
            'var',
            res,
            bookkeeping.copy(path.node.test)
        );
        // Statement that updates the test variable
        var testUpdate = builders.buildAssignmentStatement(
            '=',
            res,
            bookkeeping.copy(path.node.test)
        );
        // We need to update the test variable before each continue
        toAddBeforeContinue = toAddBeforeContinue.concat([bookkeeping.copy(testUpdate)]);
        //
        if (
            path.node.init &&
            t.isVariableDeclaration(path.node.init) &&
            path.node.init.kind == 'let'
        ) {
            // add the test in the beginning of the body
            path.get('body').pushContainer('body', bookkeeping.copy(testUpdate));
            // add the init and the initialization of the test variable before the loop
            // and wrap everything in a block statement so that the let is visible
            path.replaceWith(t.blockStatement([
                bookkeeping.copy(path.node.init),
                bookkeeping.copy(testVarDecl),
                t.forStatement(null, res, null, path.node.body)
            ]))
            path = path.get('body')[0]
        } else {
            var toAdd = [] // The statements we need to add before the for: init and testVarDecl
            if (path.node.init) {
                // Wrap init in an expression statement if it is an expression
                var init = t.isVariableDeclaration(path.node.init) ?
                    path.node.init :
                    t.expressionStatement(path.node.init)
                toAdd.push(bookkeeping.copy(init));
            }
            if (path.node.test) toAdd.push(bookkeeping.copy(testVarDecl));
            path.get('test').replaceWith(res);
            karousos.replaceWithValueOf(path.get('test'));
            path.get('init').remove();
            path.get('body').pushContainer('body', bookkeeping.copy(testUpdate));
            modifiers.insertBefore(path, toAdd)
        }
    }
    addTagCollectionToLoop(path);
    // traverse the for loop keeping in state the statement that need to be added before continue
    // if there is no update, we don't need to do this as there are no statements to be added before
    // continue
    if (update) {
        var newState = bookkeeping.newStateForLoop(state, toAddBeforeContinue);
        path.traverse(visitor, newState);
    }
}

//if the for is for (var x=..., y=... ; ... ; ...) put the multi-declaration
//before the statement
//return true if the function ended up replacing the for node
function removeMultiDeclarationFromForStmt(path) {
    if (t.isVariableDeclaration(path.node.init) && path.node.init.declarations.length > 1) {
        if (path.node.init.kind == 'let') {
            //put the for in statement in a block and get the declaration out of the statement
            path.replaceWith(t.blockStatement([
                path.node.init,
                t.forStatement(null, path.node.test, path.node.update, path.node.body)
            ]))
            return true;
        } else {
            //just add it before
            assert(path.node.init.kind == 'var');
            modifiers.insertBefore(path, path.node.init);
            path.get('init').remove();
        }
    }
    return false;
}

function handleWhileStatement(path, state, visitor) {
    var test = path.node.test;
    var updateCond = rewriteCondition(path);
    addTagCollectionToLoop(path);
    var newState = bookkeeping.newStateForLoop(state, updateCond);
    // traverse the tree keeping in the state that we are inside a loop
    path.traverse(visitor, newState);
    // wrap test in getValueOf
    karousos.replaceWithValueOf(path.get('test'));
}

// replace &&, || with If statement
function handleLogicalExpression(path, state) {
    if (bookkeeping.alreadyVisited(path)) return;
    if (!t.isAssignmentExpression(path.parent) && !t.isVariableDeclarator(path.parent)) {
        modifiers.putInSeparateStatement(path);
        return;
    }
    assert(!t.isExpressionStatement(path.parent));
    //Logical expression is in assignment or variable declarator
    assert(['&&', '||'].includes(path.node.operator));
    //We will temporarily save in a temp variable
    //so replace with var res = left; if (!res) res = right; var x = res;
    var res = builders.generateUid(path, 'res');
    var initAssignment = builders.buildVariableDeclaration('var', bookkeeping.copy(res), path.node.left);
    var conditionallyUpdate =
        path.node.operator == '&&' ?
        builders.buildIfStatement(
            bookkeeping.copy(res),
            builders.buildAssignmentStatement(
                '=',
                bookkeeping.copy(res),
                bookkeeping.copy(path.node.right)
            )
        ) :
        builders.buildIfStatement(
            t.unaryExpression(
                '!',
                t.isObjectPattern(bookkeeping.copy(res)) ?
                t.objectExpression(bookkeeping.copy(res).properties) :
                bookkeeping.copy(res)
            ),
            builders.buildAssignmentStatement(
                '=',
                bookkeeping.copy(res),
                bookkeeping.copy(path.node.right)
            )
        );
    // assign an object id to the result
    var assignObjID = karousos.buildAssignObjectID(res, res, true, false);
    modifiers.insertBefore(path, [initAssignment, conditionallyUpdate, assignObjID]);
    // replace the expression with the result
    path.replaceWith(bookkeeping.copy(res));
}

function handleUpdateExpression(path, state) {
    if (bookkeeping.alreadyVisited(path)) return;
    karousos.formatArgsRec(path, [path.get('argument')], false);
    modifiers.replaceUpdateExpression(path)
}

function handleSequenceExpression(path, state) {
    // Break the sequence into statements.
    var res, replace = false;
    // Do nothing if this sequence expression is in a condition/test or in a call expression
    if (
        inspect.inWhileCondition(path) ||
        t.isCallExpression(path.parent) ||
        t.isForStatement(path.parent)
    ) return;
    // In the below cases we need to save the result of the expression in an intermediate
    // variable and then replace the sequence with this variable after breaking it
    if (
        !t.isVariableDeclarator(path.parent) &&
        !t.isAssignmentExpression(path.parent) &&
        !t.isForStatement(path.parent) &&
        !t.isExpressionStatement(path.parent)
    ) {
        res = builders.generateUid(path, 'res');
        replace = true;
    }
    for (let i = 0; i < path.node.expressions.length; i++) {
        var expr = path.node.expressions[i];
        if (i == path.node.expressions.length - 1 && replace) {
            if (replace)
                modifiers.insertBefore(
                    path,
                    builders.buildVariableDeclaration('var', res, expr)
                );
        } else {
            modifiers.insertBefore(path, t.expressionStatement(expr))
        }
    }
    // replace with the intermediate variable or the last expression
    if (replace) {
        path.replaceWith(res)
    } else {
        path.replaceWith(path.node.expressions[path.node.expressions.length - 1])
    }
}

function handleContinueStatement(path, state) {
    // add the statements before the continue
    if (state.loopCond != undefined) {
        modifiers.insertBefore(path, bookkeeping.copy(state.loopCond))
    }
}

function handleLabeledStatement(path) {
    // handle labeled statements by wrapping their body in blocks
    if (!inspect.isLoop(path.node.body)) {
        modifiers.replaceWithBlockStatement(path.get('body'));
    }
}

function handleThisExpression(path, state) {
    if (bookkeeping.alreadyVisited(path)) return;
    // assign object id to this if needed
    addAssignObjIDIfNeeded(path, state);
}