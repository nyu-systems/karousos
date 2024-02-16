"use strict"

const t = require('@babel/types')
const debug = require('debug')('compile')
const bookkeeping = require('./utils/bookkeeping');
const modifiers = require('./utils/modifiers');
const karousos = require('./utils/karousos');
const builders = require('./utils/builders');
const prom = require('./promise-babel')

module.exports = {
    handleYield(path, state) {
        if (bookkeeping.alreadyVisited(path)) {
            return
        }
        // Wrap the yield in a block statement
        if (!t.isBlockStatement(path.getStatementParent().parent)) {
            path.parentPath.replaceWith(t.BlockStatement([path.getStatementParent().node]))
            path.skip()
            return
        }

        var arg = path.node.argument;
        var argPath = path.get('argument');
        if (
            arg == null ||
            t.isBinaryExpression(arg) ||
            t.isUnaryExpression(arg) ||
            t.isArrayExpression(arg) ||
            t.isStringLiteral(arg) ||
            t.isArrowFunctionExpression(arg) ||
            t.isNumericLiteral(arg) ||
            t.isFunctionExpression(arg) ||
            t.isObjectExpression(arg) ||
            t.isLogicalExpression(arg) ||
            t.isUpdateExpression(arg) ||
            t.isSpreadElement(arg)
        ) {
            // The item in yield is ready. emit the event and set the hid of the generator to 
            // the current hid
            let toEmit = karousos.buildEmitEvent('success')
            modifiers.insertBefore(
                path.getStatementParent(), [
                    toEmit,
                    karousos.buildSetHidForObjID(builders.getIdentifier('objID'))
                ]
            )
            modifiers.insertAfter(
                path.getStatementParent(),
                karousos.buildGetHidForObjID(builders.getIdentifier('objID'))
            )
            bookkeeping.markVisited(path)
            return
        } else if (t.isAwaitExpression(path.get('argument'))) {
            // move the await before the yield. emit the event after the await
            let awaitRes = builders.generateUid(path, 'awaitRes')
            let decl = builders.buildVariableDeclaration('var', awaitRes, path.argument)
            let toEmit = karousos.buildEmitEvent('success')
            path.getStatementParent().insertBefore([decl, toEmit])
            path.get('argument').replaceWith(awaitRes)
        } else if (t.isCallExpression(path.node.argument) || t.isNewExpression(path.node.argument)) {
            // move the call outside of the yield. No need to emit an event since the event will be
            // emitted from the call
            var call = path.get('argument')
            var res = builders.generateUid(path, 'res')
            var decl = builders.buildVariableDeclaration('var', res, path.node.argument)
            modifiers.insertBefore(path, [decl])
            path.get('argument').replaceWith(res);
            bookkeeping.markVisited(path.get('argument'));
        }
        // In any case if the argument is not null then wrap the result in a maybeReturnPromise
        if (path.node.argument != null) {
            var retCall = karousos.buildMaybeReturnPromise(path);
            path.replaceWith(retCall);
        } else {
            // if the argument is null, emit the event
            let toEmit = karousos.buildEmitEvent('success')
            path.getStatementParent().insertBefore(toEmit)
        }
        // add a setHidForObjID before the yield and a getHidForObjID after the yield
        modifiers.insertBefore(path, karousos.buildSetHidForObjID(builders.getIdentifier('objID')))
        modifiers.insertAfter(path, karousos.buildGetHidForObjID(builders.getIdentifier('objID')))
        bookkeeping.markVisited(path);
    },
}