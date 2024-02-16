const t = require('@babel/types');

const inspect = require('./inspect');
const bookkeeping = require('./bookkeeping');
const build = require('./builders');
const assert = require('assert');

/*******************************************************/
/*************Functions to modify the AST***************/
/*******************************************************/


module.exports = {
    turnToStatement,
    insertBefore,
    insertAfter,
    turnBodyToBlockStatement,
    addIdToFunctionExpression,
    replaceUpdateExpression,
    putInSeparateStatement,
    replaceWithBlockStatement,
    putAssignmentOrVariableDeclaratorInSeparateStatement,
    replaceWithIdentifiers,
}

// Check if the input is a statement and, if not, wrap it into a return statement
function turnToStatement(node) {
    if (t.isVariableDeclaration(node) || t.isExpressionStatement(node) ||
        t.isWhileStatement(node) || t.isDoWhileStatement(node) ||
        t.isWithStatement(node) || t.isTryStatement(node) ||
        t.isThrowStatement(node) || t.isSwitchStatement(node) ||
        t.isReturnStatement(node) || t.isLabeledStatement(node) ||
        t.isIfStatement(node) || t.isForStatement(node) ||
        t.isForOfStatement(node) || t.isForInStatement(node) ||
        t.isEmptyStatement(node) || t.isDebuggerStatement(node) ||
        t.isContinueStatement(node) || t.isBreakStatement(node)) {
        return node
    }
    return t.ReturnStatement(node)
}

// Insert statements before the statement that encloses the given node
function insertBefore(path, toInsert) {
    if (!Array.isArray(toInsert)) {
        toInsert = [toInsert]
    }
    var stmt = path.getStatementParent()
    // if the parent statement is not in a block statement e.g. if(x) path, then 
    // wrap it into a block statement and then add the statement
    if (!t.isBlockStatement(stmt.parent) && !t.isProgram(stmt.parent) && !t.isSwitchCase(stmt.parent)) {
        stmt.replaceWith(t.blockStatement(toInsert.concat([stmt])))
        path.skip()
    } else {
        stmt.insertBefore(toInsert)
    }
}

// Insert statement after the statement that encloses the given node
// returns how many statements after the parent statement, the inserted statements are added
function insertAfter(path, toInsert) {
    if (!Array.isArray(toInsert)) {
        toInsert = [toInsert]
    }
    var stmt = path.getStatementParent()
    // if the parent statement is not in a block statement e.g. if(x) path, then 
    // wrap it into a block statement and then add the statement
    if (!t.isBlockStatement(stmt.parent) && !t.isProgram(stmt.parent) && !t.isSwitchCase(stmt.parent)) {
        stmt.replaceWith(t.blockStatement(([stmt]).concat(toInsert)))
        path.skip()
        return 1;
    } else {
        //check if the next one is a call to assignObjectID
        var next = stmt.getSibling(stmt.key + 1);
        if (next != undefined && t.isExpressionStatement(next) &&
            t.isCallExpression(next.node.expression) &&
            t.isMemberExpression(next.node.expression.callee) &&
            t.isIdentifier(next.node.expression.callee.property) &&
            next.node.expression.callee.property.name == 'assignObjectID' &&
            t.isIdentifier(next.node.expression.callee.object) &&
            next.node.expression.callee.object.name == inspect.karousosModule) {
            next.insertAfter(toInsert)
            return 2
        } else {
            stmt.insertAfter(toInsert)
            return 1
        }
    }
}

function turnBodyToBlockStatement(path) {
    if (!t.isBlockStatement(path.node.body)) {
        path.get('body').replaceWith(t.blockStatement([turnToStatement(path.node.body)]))
    }
}

// If the function expression does not have a name, generate a name and add a name to it.
function addIdToFunctionExpression(path) {
    if (t.isAssignmentExpression(path.parent) && t.isIdentifier(path.parent.left)) {
        return path.parent.left
    }
    if (t.isVariableDeclarator(path.parent)) {
        return path.parent.id
    }
    if (path.node.id != null) {
        return path.node.id
    }
    if (t.isFunctionExpression(path)) {
        var functionID = build.generateUid(path, 'functionID')
        path.node.id = functionID
        return functionID
    }
    return t.identifier('')
}

//replace update expressions with assignment stmt. e.g. x++ => x = x + 1;
function replaceUpdateExpression(path) {
    if (bookkeeping.alreadyVisited(path)) return;
    var op = path.node.operator == '++' ? '+' : '-';
    var assignmentExpr = t.assignmentExpression("=",
        bookkeeping.copy(path.node.argument), t.binaryExpression(op, bookkeeping.copy(path.node.argument),
            t.numericLiteral(1)));
    var assignmentStmt = t.expressionStatement(assignmentExpr);
    if (inspect.inCondition(path)) {
        //if it is in condition replace with the assignment expression and be done
        path.replaceWith(assignmentExpr)
    } else {
        //we only handle cases where the update is directly in a condition 
        //and not deep inside the codition.
        try {
            assert(!inspect.inWhileCondition(path))
        } catch (err) {
            console.log(path.node)
            console.log(path.parentPath.parentPath.parentPath.parent)
            throw err
        }
        //add the assignment statement before or after the expression
        //and replace the update in the expression with the result. 
        if (path.node.prefix) {
            insertBefore(path, assignmentStmt)
        } else {
            insertAfter(path, assignmentStmt)
        }
        path.replaceWith(path.node.argument)
    }
}

//put an expression in a separate statement, 
//save the result of the expression and use it the result in  place of 
//the expression in path.node
function putInSeparateStatement(path) {
    if (t.isFunctionExpression(path) && path.node.id && t.isIdentifier(path.node.id)) {
        var res = build.generateUid(path, path.node.id.name); //so that we can still recognize toString get etc
    } else {
        var res = build.generateUid(path, 'res');
    }
    insertBefore(path, build.buildVariableDeclaration('var', res, path.node));
    path.replaceWith(bookkeeping.copy(res));
}

function replaceWithBlockStatement(path) {
    if (!t.isBlockStatement(path)) {
        path.replaceWith(t.blockStatement([path.node]))
    }
}

//takes as input a variable declaration or assignment expression and 
//puts it in a separate statement if needed
//returns whether a change was made
function putAssignmentOrVariableDeclaratorInSeparateStatement(path, state) {
    //whether we need to put it in separate statement or not depends on the initialization
    //type
    var elem = t.isVariableDeclarator(path) ? path.get('init') : path.get('right')
    //whether we need to put it in separate statement depends on the intitialization
    if (!inspect.isPromiseConstructor(elem) &&
        !inspect.isReflectConstructOfPromise(elem) &&
        !inspect.isPromiseRejectOrResolve(elem) &&
        !inspect.isPromiseRaceOrAll(elem) &&
        !t.isAwaitExpression(elem) &&
        !t.isCallExpression(elem) &&
        !t.isConditionalExpression(elem) &&
        !t.isYieldExpression(elem) &&
        !t.isFunctionExpression(elem) &&
        !t.isArrowFunctionExpression(elem) &&
        !t.isSequenceExpression(elem) &&
        !t.isLogicalExpression(elem)) {
        return false
    }
    //If it is an assignment expression:
    if (t.isAssignmentExpression(path)) {
        //we need to change only if it is not in a while loop and it is not is a statement
        //by itself
        if (t.isExpressionStatement(path.parent) || inspect.inWhileCondition(path)) {
            return false
        }
        //put it in separate statement	
        insertBefore(path, t.expressionStatement(path.node))
        path.replaceWith(t.isObjectPattern(path.node.left) ?
            t.objectExpression(path.node.left.properties) :
            t.isArrayPattern(path.node.left) ?
            t.arrayExpression(path.node.left.elements) :
            bookkeeping.copy(path.node.left))
        return true
    }
    //Variable declaration
    //Don't modify anything if it is declared by itself
    if (!t.isVariableDeclarator(path) || path.parent.declarations.length == 1) {
        return false
    }
    //find the index of this declarator in the declaration
    var myIndex = -1,
        decls = path.parent.declarations
    for (let i = 0; i < decls.length; i++) {
        if (_.isEqual(decls[i].id, path.node.id)) {
            myIndex = i
            break
        }
    }
    if (myIndex < 0) {
        throw new Error('Cannot find index')
    }
    //if var x_1 = .. , x_2 = .. , x_3 = .., ..., x_k = ...
    //and the declaration is at index myIndex transform to
    //var x_1 = ... , ...., x_{myIndex - 1}
    //var x_myIndex = ....
    //vat x_{myIndex + 1 = ..., ....}
    if (myIndex != 0) {
        insertBefore(path, t.variableDeclaration(path.parent.kind, bookkeeping.copy(decls.slice(0, myIndex))))
    }
    if (myIndex != decls.length - 1) {
        insertAfter(path, t.variableDeclaration(path.parent.kind, bookkeeping.copy(decls.slice(myIndex + 1))))
    }
    path.parentPath.replaceWith(t.variableDeclaration(path.parent.kind, [path.node]))
    path.skip()
    return true
}

// Takes as input a call and replaces the callbackInd-th argument with a function expression
function replaceWithFunctionExpression(path, callbackInd, argNo, slice) {
    if (path.node.arguments.length - 1 < callbackInd) {
        return
    }
    var arg = path.node.arguments[callbackInd]
    if (t.isFunctionExpression(arg)) {
        return;
    }
    if (t.isArrowFunctionExpression(arg)) {
        var res = build.generateUid(path, 'res')
        modifiers.insertBefore(path, build.buildVariableDeclaration('var', res, arg))
        path.get('arguments')[callbackInd].replaceWith(res)
        arg = res
    }
    assert(t.isIdentifier(arg) || t.isMemberExpression(arg) || inspect.isStringLiteral(arg) || t.isNullLiteral(arg))
    if (t.isStringLiteral(arg)) {
        return
    }
    if (t.isNullLiteral(arg)) {
        path.node.arguments[callbackInd] = t.functionExpression(null, [], t.blockStatement([t.returnStatement(t.nullLiteral())]))
        return
    }
    var args = []
    var funcCall
    if (argNo != -1) {
        // replace with a call with argNo arguments
        for (let i = 0; i < argNo; i++) {
            args.push(build.getIdentifier('argIon' + i))
        }
        funcCall = build.buildCallStatement(arg, undefined, args)
    } else {
        // either slice the input arguments or not
        if (slice) {
            funcCall = t.returnStatement(build.buildCall(arg, undefined,
                [t.spreadElement(build.buildCall('arguments', 'slice', [t.numericLiteral(1)]))]))
        } else {
            funcCall = t.returnStatement(build.buildCall(arg, undefined,
                [t.spreadElement(t.identifier('arguments'))]))

        }
    }
    path.node.arguments[callbackInd] = t.functionExpression(null, args,
        t.blockStatement([funcCall]))
}

// replace the node with identifiers recursively.
function replaceWithIdentifiers(path) {
    if (inspect.isLiteral(path) || t.isSuper(path) || t.isThisExpression(path) || bookkeeping.alreadyVisited(path)) {
        return;
    }
    if (t.isMemberExpression(path)) {
        replaceWithIdentifiers(path.get('object'));
        replaceWithIdentifiers(path.get('property'));
    } else if (path && path.node != null && !t.isIdentifier(path) && !inspect.isLiteral(path)) {
        putInSeparateStatement(path);
    }
}