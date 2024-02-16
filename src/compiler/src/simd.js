"use strict"
const t = require('@babel/types');
const assert = require('assert');
const inspect = require('./utils/inspect');
const bookkeeping = require('./utils/bookkeeping');
const builders = require('./utils/builders');
const karousos = require('./utils/karousos');

//The functions in this module are used to transform the 
//simple expressions between variables to calls to our functions
//that perform these operations between multi-variables

module.exports = {
    handleBinaryExpression,
    handleUnaryExpression,
}

function handleBinaryExpression(path, state) {
    // For binary expressions, wrap the left and right with getValueOf iff the operatior is 
    // equality or we are producing the code for the server
    if (path.node.operator == "==" || path.node.operator == "===" || !state.opts.isVerifier) {
        karousos.replaceWithValueOf(path.get('right'));
        karousos.replaceWithValueOf(path.get('left'));
    }
    if (state.opts.isVerifier) {
        // Check if the expression is in a condition 
        let inCond = inspect.inCondition(path);
        // replace the expression with a call to karousos.doBinaryOperation
        path.replaceWith(
            buildBinaryCall(
                path.node.operator,
                path.node.left,
                path.node.right,
                inCond,
                false
            )
        );
        bookkeeping.markVisited(path);
    }
}

//build a call to our function doBinaryOperation of the karousosModule
function buildBinaryCall(op, val1, val2, inCond, passObjID) {
    return builders.buildCall(inspect.karousosModule, 'doBinaryOperation', [
        t.stringLiteral(op),
        val1,
        val2,
        builders.getIdentifier(inCond.toString()),
        builders.getIdentifier(passObjID.toString())
    ])
}

function handleUnaryExpression(path, state) {
    if (bookkeeping.alreadyVisited(path)) return;
    // Prepare the call for the verifier
    if (state.opts.isVerifier) {
        if (path.node.operator == 'delete') return; //no need to transform deletes
        let inCond = inspect.inCondition(path);
        // if this is an update expression the argument to be passed to the 
        // karousosModule.doUnaryOperation is
        // {'updateExpression': true, 'value': path.node.argument}
        if (t.isUpdateExpression(path))
            arg = t.objectExpression([
                t.objectProperty(t.stringLiteral('updateExpression'), t.identifier('true')),
                t.objectProperty(t.stringLiteral('value'), path.node.argument)
            ]);
        let before = path.node.prefix;
        var arg = path.node.argument;
        var call = buildUnaryCall(path.node.operator, arg, before, inCond);
        // if it is typeof then if we are checking for undefined we might have an error when we 
        // use the undefined value as an argument to call doUnaryOperation
        if (path.node.operator == 'typeof' && t.isIdentifier(path.node.argument)) {
            //replace typeof x with typeof x === 'undefined' ? 'undefined' : doUnaryOperation(...)
            let checkUndefined = t.binaryExpression('===',
                t.unaryExpression('typeof', path.node.argument),
                t.stringLiteral('undefined'));
            path.replaceWith(t.conditionalExpression(
                checkUndefined,
                t.stringLiteral('undefined'),
                call));
            bookkeeping.markVisited(path.get('test'))
            bookkeeping.markVisited(path.get('test').get('left'));
            bookkeeping.markVisited(path.get('alternate'))
            bookkeeping.markVisited(path.get('consequent'))
            bookkeeping.markVisited(path)
            return;
        } else {
            // otherwise, replace with the call
            path.replaceWith(call);
        }
    } else {
        // this is for the server
        if (path.node.operator != "typeof" || t.isCallExpression(path.node.argument)) {
            // wrap the argument in a getValueOf call if it is not typeOf or if it is a call
            karousos.replaceWithValueOf(path.get("argument"));
        } else {
            // otherwise replace with typeof x == undefined ? undefined : typeof getValueOf(argument)
            path.replaceWith(
                t.conditionalExpression(
                    t.binaryExpression(
                        "==",
                        bookkeeping.copy(path.node),
                        t.stringLiteral("undefined")
                    ),
                    t.stringLiteral("undefined"),
                    t.unaryExpression("typeof", karousos.buildGetValueOf(path.get("argument")))
                )
            );
            bookkeeping.markVisited(path);
            bookkeeping.markVisited(path.get("test"));
            bookkeeping.markVisited(path.get("test").get("left"));
            bookkeeping.markVisited(path.get("test").get("left").get("argument"));
            bookkeeping.markVisited(path.get("alternate"));
            bookkeeping.markVisited(path.get("alternate").get("argument"));
            bookkeeping.markVisited(path.get("alternate").get("argument").get("arguments")[0]);
        }
    }
}

//build a call to our function doUnaryOperation of the karousosModule
function buildUnaryCall(op, arg, before, inCond) {
    return builders.buildCall(inspect.karousosModule, 'doUnaryOperation', [
        t.stringLiteral(op),
        arg,
        builders.getIdentifier(before.toString()),
        builders.getIdentifier(inCond.toString())
    ])
}