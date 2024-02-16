"use strict";

const t = require('@babel/types');
const inspect = require('./utils/inspect');
const bookkeeping = require('./utils/bookkeeping');
const modifiers = require('./utils/modifiers');
const karousos = require('./utils/karousos');
const builders = require('./utils/builders');
const prom = require('./promise-babel.js');
// depending on the mode some transformations are turned off;
const mode = parseInt(process.env.ADVICE_MODE || 0);

module.exports = {
    handleAwait,
    handleForAwaitOf,
}

function handleAwait(path) {
    if (bookkeeping.alreadyVisited(path)) {
        return
    }
    // if it is not inside an assignment or variable declarator temporarily 
    // save the result in another variable/statement 
    if (!t.isAssignmentExpression(path.parent) &&
        !t.isVariableDeclarator(path.parent) &&
        !t.isExpressionStatement(path.parent)
    ) {
        let awaitRes = builders.generateUid(path, 'awaitRes')
        let toAdd = builders.buildVariableDeclaration('var', awaitRes, path.node)
        modifiers.insertBefore(path, [toAdd])
        path.replaceWith(awaitRes)
        path.skip()
        bookkeeping.alreadyVisited(path)
        return
    }
    // These transformations don't happen for some modes
    if (mode >= 5) return;
    var toAdd = [] // the statements we need to add before the statement
    var awaitRes = path.node.argument
    // if the argument is not an identifier or a member expression, 
    // save the result in a temporary variable and replace the argument with this variable
    if (!inspect.isIdentifierOrSimpleMemberExp(path.get('argument'))) {
        awaitRes = builders.generateUid(path, 'callRes')
        toAdd.push(builders.buildVariableDeclaration('var', awaitRes, path.node.argument))
        path.node.argument = awaitRes
    }
    bookkeeping.markVisited(path);
    // Add before:  
    // [ var res = argument ]
    // var evt = createAwaitEvtType();
    // Register(evt, [evt], 'succcess', true)
    // checkNotPromise(res)
    // res = addRidHidIfNeeded(res);
    // Add after: 
    // GetAndupdateHandlerID(res)
    var noProm = karousos.buildCheckNotPromise(awaitRes)
    var evtName = builders.generateUid(path, 'evt');
    var retEvent = karousos.buildCreateAwaitRetEvtType();
    var declEvent = builders.buildVariableDeclaration('var', evtName, retEvent);
    var register = karousos.buildRegisterEvent(
        evtName,
        t.ArrayExpression([evtName]),
        'success',
        t.identifier('true')
    );
    modifiers.insertBefore(
        path.getStatementParent(),
        toAdd.concat(
            [
                declEvent,
                register,
                noProm,
                karousos.buildAddRidHidIfNeeded(awaitRes)
            ]
        )
    );
    modifiers.insertAfter(
        path.getStatementParent(),
        karousos.buildGetAndUpdateHandlerID(evtName, t.arrayExpression([evtName]), 'success')
    );
    // Now replace the await call with 
    // if (checkPromisSuperObj(res)){
    // 	 setRetEventTypes(evt, res.retEventTypes)
    //	 await res.karContents
    // } else { 
    // 	await res
    // 	emit evt
    // } 
    //Check if it is a promise super object
    var test = karousos.buildCheckPromiseSuperObj(awaitRes)
    var setRetEventTypes = karousos.buildSetRetEventTypes(
        t.arrayExpression([evtName]),
        t.memberExpression(
            builders.getIdentifier(awaitRes),
            builders.getIdentifier('retEventTypes')
        ),
        t.identifier('true')
    );
    var callAwaitContents = t.awaitExpression(
        t.memberExpression(path.node.argument, builders.getIdentifier('karContents'))
    )
    var toAdd1, toAdd2, option;
    if (t.isAssignmentExpression(path.parent)) {
        toAdd1 = builders.buildAssignmentStatement(
            path.parent.operator,
            path.parent.left,
            callAwaitContents
        );
        toAdd2 = path.getStatementParent().node
        option = 0
    } else if (t.isVariableDeclarator(path.parent)) {
        let kind =
            path.parentPath.parent.kind != 'const' ?
            path.parentPath.parent.kind :
            'var';
        if (t.isObjectPattern(path.parent.id)) {
            path.getStatementParent().insertBefore(
                builders.buildAllVariableDeclarationsFromObjectExpression(
                    kind,
                    path.parent.id
                )
            )
        } else if (t.isArrayPattern(path.parent.id)) {
            path.getStatementParent().insertBefore(
                builders.buildAllVariableDeclarationsFromArrayPattern(
                    kind,
                    path.parent.id
                )
            )
        } else {
            path.getStatementParent().insertBefore(
                builders.buildVariableDeclaration(kind, path.parent.id)
            )
        }
        toAdd1 = builders.buildAssignmentStatement('=', path.parent.id, callAwaitContents)
        toAdd2 = builders.buildAssignmentStatement('=', path.parent.id, path.node)
        option = 0
    } else {
        toAdd1 = t.expressionStatement(callAwaitContents)
        toAdd2 = path.getStatementParent().node
        option = 1
    }
    var stmt = path.getStatementParent()
    var toEmit = karousos.buildEmitEvent('success', undefined, t.arrayExpression([evtName]))
    path.getStatementParent().replaceWith(
        builders.buildIfStatement(
            test,
            t.blockStatement([setRetEventTypes, toAdd1]),
            t.blockStatement([toAdd2, toEmit])
        )
    )
    if (option == 0) {
        bookkeeping.markVisited(stmt.get('consequent').get('body')[1].get('expression').get('right'))
        bookkeeping.markVisited(stmt.get('alternate').get('body')[0].get('expression').get('right'))
    } else {
        bookkeeping.markVisited(stmt.get('consequent').get('body')[1].get('expression'))
        bookkeeping.markVisited(stmt.get('alternate').get('body')[0].get('expression'))
    }
    path.skip()
}

// You are not expected to understand this.
function handleForAwaitOf(path) {
    var iter = builders.generateUid(path, 'iter')
    var id
    if (t.isVariableDeclaration(path.node.left)) {
        if (path.node.left.declarations.length > 1) {
            throw new Error('too many declarations in for await of statement')
        }
        id = path.node.left.declarations[0].id
        path.node.left.declarations[0].id = iter
        let ifStmt = extractValue(id)
        path.get('body').unshiftContainer('body', [
            builders.buildVariableDeclaration(path.node.left.kind, id,
                t.awaitExpression(iter)),
            ifStmt
        ])
    } else {
        id = path.node.left
        path.node.left = iter
        let ifStmt = extractValue(id)
        path.get('body').unshiftContainer('body', [
            builders.buildAssignmentStatement('=', id,
                t.awaitExpression(iter)),
            ifStmt
        ])
    }
}

function extractValue(id) {
    let test = t.binaryExpression('!=',
        t.memberExpression(id, builders.getIdentifier('done')),
        builders.getIdentifier('undefined'))
    let ifStmtInt = builders.buildIfStatement(
        t.memberExpression(id, builders.getIdentifier('done')),
        t.blockStatement([t.breakStatement()]),
    )
    let update = builders.buildAssignmentStatement('=',
        id, t.memberExpression(id, builders.getIdentifier('value'))
    )
    return builders.buildIfStatement(test, t.blockStatement([ifStmtInt, update]))
}