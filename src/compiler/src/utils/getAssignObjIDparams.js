const t = require('@babel/types');
const assert = require('assert');
const common = require('./inspect');
const karousos = require('./karousos');
const karousosModule = common.karousosModule;
const inspect = require('./inspect');

module.exports = {
    //returns [needToAddObjID, isRead, whereToAdd]. whereToAdd is either a node in the body of which
    //we need to add the assignObjectID statement or the body or null if we just need to add the next
    //statement

    getAssignObjIDparams(path, state) {
        var needToAddObjID = false; //the path of the function where we need to put the assignObjectId if needed
        var isRead;
        var whereToAdd = null;
        // We do not need to assign object ids to js keywords
        if (isKeyword(path)) return [false, false, whereToAdd];
        // We only need to assign an objectID upon the definition of a new variable.
        if (t.isVariableDeclarator(path.parentPath) && path.parentPath.get('id') == path && !t.isForOfStatement(path.parentPath.parentPath.parent)) {
            return [true, false, whereToAdd]
        }
        if ((t.isFunctionExpression(path.parentPath) || t.isFunctionDeclaration(path.parentPath)) &&
            path.parentPath.get('id') == path
        ) {
            if (t.isFunctionExpression(path.parentPath) && !t.isExpressionStatement(path.parentPath.parentPath)) {
                return [false, isRead, whereToAdd]
            } else {
                return [true, false, whereToAdd]
            }
        }
        // Check that x is in a statement of the form for .. of karousos.getValueOf(x){...}
        if (t.isForOfStatement(path.parentPath.parent) && path.parentPath.get('callee') != path) {
            isRead = path.parentPath.parentPath.get('right') == path.parentPath;
            return [true, isRead, null];
        }
        // If it is x for which the expression is x.length, this is a read.
        if (
            t.isIdentifier(path) &&
            t.isMemberExpression(path.parentPath) &&
            path == path.parentPath.get('object') &&
            path.parent.property.name == "length"
        ) {
            return [true, true, null]
        }
        // If it is x for which the expression is x = ... then it is a write
        // Othewise, if it is the expression ... = x, then it is a read
        if (
            t.isIdentifier(path) &&
            t.isAssignmentExpression(path.parent)
        ) {
            return [true, path.parentPath.get('right') == path, null]
        }
        // if it is x in a condition if (binaryOperation(x,...)) or 
        // var .. = binaryOperation(x, ..) (variable declaration) or 
        // y = binaryOperation(x, ..) (assignment expression)
        // then it is a read
        if (
            t.isIdentifier(path) &&
            t.isBinaryExpression(path.parentPath) &&
            (
                t.isIfStatement(path.parentPath.parentPath) ||
                t.isVariableDeclarator(path.parentPath.parentPath) ||
                t.isAssignmentExpression(path.parentPath.parentPath)
            )
        ) {
            return [true, true, null]
        }
        // if x is in a variable declaration s.t. var y = x then it is a read
        if (
            t.isIdentifier(path) &&
            t.isVariableDeclarator(path.parentPath) &&
            path.parentPath.get('init') == path
        ) {
            return [true, true, null]
        }
        return [false, true, true];
    },

    getAssignObjIDparams_old(path, state) {
        var needToAddObjID = false; //the path of the function where we need to put the assignObjectId if needed
        var isRead;
        var whereToAdd = null;
        if (t.isMemberExpression(path) && t.isThisExpression(path.get('object')) && t.isArrayExpression(path.parentPath) && t.isCallExpression(path.parentPath.parentPath)) {
            return [true, true, whereToAdd]
        }
        if (noNeedToAddLbl(path)) {
            needToAddObjID = false;
            return [needToAddObjID, isRead, whereToAdd];
        }
        var newObject = false;
        //check if we need to force the assignment of a fresh object ID
        //thi`s only happens if we are assigning to a new object
        if (t.isVariableDeclarator(path.parent) && path.parentPath.get('id') == path) {
            newObject = true;
        }

        while (path.parent && !t.isExpressionStatement(path.parent) &&
            !t.isBlockStatement(path.parent) && !t.isProgram(path.parent)) {
            //if it is of the form var x = y then no need to add anything.. 
            //if (t.isVariableDeclarator(path.parent) && t.isIdentifier(path.parent.id) && path.parent.init != null && (t.isCallExpression(path.parent.init) || t.isNewExpression(path.parent.init) || t.isIdentifier(path.parent.id) || t.isMemberExpression(path.parent.id)) && !isCalltoReportsColMultivalueOp(path.parentPath.get('init'))){
            //	console.log('here', path.node)
            //	return [false, isRead, whereToAdd];
            //
            //}
            if (t.isAssignmentExpression(path.parent) && t.isIdentifier(path.parent.left) && (t.isCallExpression(path.parent.right) || t.isNewExpression(path.parent.right) || t.isIdentifier(path.parent.right) || t.isMemberExpression(path.parent.right)) && !isCalltoReportsColMultivalueOp(path.parentPath.get('right'))) {
                return [false, isRead, whereToAdd];
            }
            if (t.isObjectProperty(path.parent) && (!t.isIdentifier(path.parent.value) ||
                    !t.isIdentifier(path.parent.key) || path.parent.value.name != path.parent.key.name)) {
                //check if it is a destcucting assignment
                if ((t.isAssignmentExpression(path.parentPath.parentPath.parent) && path.parentPath.parentPath.parentPath.get('left') == path.parentPath.parentPath) || (t.isVariableDeclarator(path.parentPath.parentPath.parent) && path.parentPath.parentPath.parentPath.get('id') == path.parentPath.parentPath)) {
                    return [false, isRead, whereToAdd];
                }
                if (path.parentPath.get('value') == path) {
                    needToAddObjID = true;
                    isRead = true;
                    //Maybe it is in the arguments initializer
                    if ((t.isAssignmentPattern(path.parentPath.parentPath.parent) &&
                            common.isFunctionDecl(path.parentPath.parentPath.parentPath.parent)) ||
                        (t.isAssignmentPattern(path.parentPath.parentPath.parentPath.parent) &&
                            common.isFunctionDecl(path.parentPath.parentPath.parentPath.parentPath.parent))) {
                        whereToAdd = path.parentPath.parentPath.parentPath.parentPath;
                    }
                    if (common.isFunctionDecl(path.parentPath.parentPath.parentPath)) {
                        whereToAdd = path.parentPath.parentPath.parentPath;
                    }
                }
                return [needToAddObjID, isRead, whereToAdd];
            } else if (t.isAssignmentExpression(path.parent)) {
                if (t.isAwaitExpression(path.parent.right)) {
                    return [false, isRead, whereToAdd, newObject];
                }
                return [true, path.parentPath.get('right') == path, whereToAdd, newObject];
            } else if (t.isVariableDeclarator(path.parent)) {
                if (path.parentPath.parent && path.parentPath.parentPath.parent && (
                        t.isForInStatement(path.parentPath.parentPath.parent) ||
                        t.isForOfStatement(path.parentPath.parentPath.parent))) {
                    return [false, false, path.parentPath.parentPath.parentPath];
                }
                return [true, path.parentPath.get('init') == path, whereToAdd, newObject];
            } else if (t.isUpdateExpression(path.parent)) {
                return [true, false, whereToAdd];
            } else if ((t.isBinaryExpression(path.parent) || t.isLogicalExpression(path.parent) ||
                    t.isUnaryExpression(path.parent))) {
                return [true, path.parent.operator != 'delete', whereToAdd];
            } else if (t.isClassProperty(path.parent)) {
                //if we have reached this part, it may be a property but this is the value assigned so it is read
                return [true, true.whereToAdd];
            } else if (t.isIfStatement(path.parent) || t.isWhileStatement(path.parent) ||
                t.isForStatement(path.parent) || t.isDoWhileStatement(path.parent) ||
                t.isSwitchCase(path.parent)) { //it is in the test
                assert(path.parentPath.get('test') == path)
                return [true, true, whereToAdd];
            } else if (t.isAwaitExpression(path.parent)) {
                return [true, true, whereToAdd];
            } else if (t.isCatchClause(path.parent)) {
                return [true, true, whereToAdd];
            } else if (t.isTemplateLiteral(path.parent)) {
                return [true, true, whereToAdd];
            } else if (t.isForInStatement(path.parent) || t.isForOfStatement(path.parent)) {
                isRead = path.parentPath.get('right') == path; //in this case tell the caller if it needs to put this in the body
                if (!isRead) whereToAdd = path.parentPath;
                return [true, isRead, whereToAdd];
            } else if (t.isSwitchStatement(path.parent)) {
                return [true, true, whereToAdd];
            } else if (t.isClassDeclaration(path.parent) || t.isClassExpression(path.parent)) {
                isRead = path.parentPath.get('superClass') == path;
                return [true, isRead, whereToAdd];
            } else if (t.isMemberExpression(path.parent) && path.parentPath.get('property') == path &&
                path.parent.computed) {
                return [true, true, whereToAdd];
            } else if (t.isMemberExpression(path.parent) && path.parentPath.get('object') == path &&
                t.isCallExpression(path.parentPath.parent) && path.parentPath.parentPath.get('callee') == path.parentPath) {
                return [true, true, whereToAdd]
            } else if (t.isCallExpression(path.parent) || t.isNewExpression(path.parent)) {
                //if it is a binary or unary operation
                if (isCalltoReportsColMultivalueOp(path.parentPath)) {
                    if (!inCall(path.parentPath)) {
                        return [true, path.parent.arguments[0].name != 'delete', whereToAdd];
                    }
                } else {
                    if (path.parentPath.get('arguments')[path.parent.arguments.length - 1] != path ||
                        karousos.isCallToReportsCol(path.parentPath, 'assignObjectID') ||
                        karousos.isCallToReportsCol(path.parentPath, 'setThen')) {
                        return [false, isRead, whereToAdd];
                    }
                    return [true, true, whereToAdd];
                }
            } else if (common.isFunctionDecl(path.parent)) {
                if (path.parentPath.inPromise) {
                    return [false, true, whereToAdd];
                }
                whereToAdd = path.parentPath;
                return [true, true, whereToAdd];
            } else if (t.isObjectExpression(path.parent)) {
                return [true, true, whereToAdd];
            } else if (t.isAssignmentPattern(path.parent) && !t.isObjectProperty(path.parentPath.parent) && !common.isFunctionDecl(path.parentPath.parent)) {
                //it is not in the parameters of a function (all such assignment patterns are replaced)
                return [true, path.parentPath.get('right') == path, whereToAdd];
            } else if (t.isConditionalExpression(path.parent)) {
                return [false, true, whereToAdd];
            }
            try {
                assert(t.isSequenceExpression(path.parent) || t.isObjectProperty(path.parent) || t.isArrayExpression(path.parent) || t.isMemberExpression(path.parent) || t.isAssignmentPattern(path.parent) || t.isArrayPattern(path.parent) || t.isRestElement(path.parent) || t.isObjectPattern(path.parent) || t.isSpreadElement(path.parent) || t.isBinaryExpression(path.parent) || t.isUnaryExpression(path.parent) || t.isLogicalExpression(path.parent) || t.isCallExpression(path.parent));
                path = path.parentPath;
            } catch (err) {
                console.log(path.parentPath.parent, path.parent, path.node);
                console.log(err);
                process.exit();
            }
        }
        return [true, false, whereToAdd];
    },
}

function isKeyword(id) {
    return (t.isIdentifier(id) && keywords.has(id.node.name)) ||
        t.isSuper(id) || (t.isMemberExpression(id) && (isKeyword(id.get('property')) ||
            common.isOneOfTheObjectMethods(id, 'process', 'env'))) ||
        common.isOneOfTheObjectMethods(id, 'Symbol', 'iterator');
}


function isCalltoReportsColMultivalueOp(path) {
    return karousos.isCallToReportsCol(path, 'doBinaryOperation') ||
        karousos.isCallToReportsCol(path, 'doUnaryOperation')
}


function noNeedToAddLbl(path) {
    //no need to add label if it is a function declaration/expression or a call. 
    //the report collection module takes care of that..
    if (path.node.visitedObjID) {
        return true;
    }
    if (t.isMemberExpression(path) && path.node.computed && t.isIdentifier(path.node.object) && path.node.object.name == 'arguments') {
        return true;
    }
    if (t.isMemberExpression(path) && t.isIdentifier(path.node.property) && ['fromPromiseInternal', 'promiseName'].includes(path.node.property.name)) {
        return true;
    }
    if (t.isIdentifier(path) && t.isMemberExpression(path.parent) && (
            (path.parentPath.get('object') != path && !path.parent.computed) || isKeyword(path.parentPath.get('property'))) ||
        karousos.isReportsColMethod(path.node) || isKeyword(path.parentPath) ||
        t.isLabeledStatement(path.parent) || t.isContinueStatement(path.parent) ||
        t.isBreakStatement(path.parent) || t.isCatchClause(path.parent) ||
        (t.isUnaryExpression(path.parent) && path.parent.operator == "typeof") ||
        (karousos.isCallToReportsCol(path.parentPath, 'doUnaryOperation') && path.parent.arguments[0].value == "typeof") ||
        isKeyword(path) ||
        t.isClassExpression(path.parent) ||
        (t.isAssignmentExpression(path.parent) && (t.isConditionalExpression(path.parent.right) || t.isAwaitExpression(path.parent.right))) ||
        (t.isMemberExpression(path) && (t.isSuper(path.node.object) || common.identifierOneOf(path.get('object'), ['Buffer']) || (common.identifierOneOf(path.get('property'), ['key', 'poolSize', 'name']) && !path.node.computed)))) {
        return true;
    }
    while (path && path.node && !t.isExpressionStatement(path) &&
        !t.isBlockStatement(path)) {
        if (path && (
                (((t.isFunctionExpression(path.parent) || t.isFunctionDeclaration(path.parent) ||
                    t.isArrowFunctionExpression(path.parent) || t.isObjectMethod(path.parent) || t.isClassMethod(path.parent)) && path.parentPath.get('id') == path)) || ((t.isCallExpression(path.parent) || t.isNewExpression(path.parent)) && !karousos.isCallToReportsCol(path.parentPath, 'doBinaryOperation') && !karousos.isCallToReportsCol(path.parentPath, 'doUnaryOperation') && (!karousos.isCallToReportsCol(path.parentPath, 'getValueOf') && !karousos.isCallToReportsCol(path.parentPath, 'doBinaryOperation') && !karousos.isCallToReportsCol(path.parentPath, 'doUnaryOperation')) && !karousos.isCallToReportsCol(path.parentPath, 'sync')) ||
                ((t.isObjectMethod(path.parent) || t.isClassMethod(path.parent) || t.isObjectProperty(path.parent) || t.isClassProperty(path.parent)) && path == path.parentPath.get('key')) ||
                t.isReturnStatement(path.parent) || t.isThrowStatement(path.parent))) {
            return true;
        }
        path = path.parentPath;
    }
    return false;
}

const keywords = new Set([
    'prevRequestID',
    'requestID',
    'prevRequestID',
    'handlerID',
    'prevHandlerID',
    'retEventTypes',
    'objID',
    'karContents',
    'true',
    'false',
    'process',
    'Symbol',
    'NaN',
    'prototype',
    'Uint8Array',
    'Buffer',
    'arguments',
    'undefined',
    'Number',
    'Boolean',
    karousosModule
])

function inCall(path) {
    while (path.parent &&
        !t.isExpressionStatement(path.parent) &&
        !t.isBlockStatement(path.parent) &&
        !t.isProgram(path.parent)) {
        if (t.isCallExpression(path.parent)) {
            return true
        }
        path = path.parentPath
    }
    return false

}

function isNewObject(path) {
    return t.isFunctionExpression(path) || t.isArrowFunctionExpression(path) || t.isObjectExpression(path);
}