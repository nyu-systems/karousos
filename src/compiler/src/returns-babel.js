const t = require('@babel/types')
const prom = require('./promise-babel')
const debug = require('debug')('add-rep-col')
const assert = require('assert')
const mode = parseInt(process.env.ADVICE_MODE || 0) //what advice to collect;
const inspect = require('./utils/inspect');
const bookkeeping = require('./utils/bookkeeping');
const modifiers = require('./utils/modifiers');
const karousos = require('./utils/karousos');
const builders = require('./utils/builders');

// This visitor parses a tree and only modifies calls to next, that are not in a variable 
// declarator or an assignment. It places any such call in a separate statement
var myVisitor = {
    Visit: {
        CallExpression(path) {
            if (
                inspect.isNext(path) &&
                !t.isVariableDeclarator(path.parent) &&
                !t.isAssignmentExpression(path.parent)
            ) {
                var res = builders.generateUid(path, 'res')
                modifiers.insertBefore(
                    path,
                    [builders.buildVariableDeclaration('var', res, path.node)]
                )
                path.replaceWith(res)
            }
        }
    }
}

module.exports = {
    addEmitBeforeReturnOrThrow(path, type, state) {
        if (bookkeeping.alreadyVisited(path)) {
            return
        }
        // if the argument is a conditional expression convert it to 
        // if (test) return cons else return alt
        if (t.isConditionalExpression(path.node.argument)) {
            let res = builders.generateUid(path, 'res')
            assert(t.isReturnStatement(path.node) || t.isThrowStatement(path.node))
            var createStmt = t.isReturnStatement(path.node) ? t.returnStatement : t.throwStatement;
            path.replaceWith(t.ifStatement(path.node.argument.test,
                t.blockStatement([createStmt(path.node.argument.consequent)]),
                t.blockStatement([createStmt(path.node.argument.alternate)]),
            ))
            return
        }
        // traverse everything in the return statement so that all calls to next are in 
        // variable declarators or assignment statements
        path.traverse(myVisitor.Visit, {})
        var arg = path.node.argument
        var argPath = path.get('argument')
        // handle calls to promise
        if (inspect.isCallToPromise(argPath) && mode < 5) {
            prom.handlePromiseInReturn(path, state)
            return
        }
        // if the argument is complex move it to a separate statement and replace with
        // identifier
        if (
            arg != null &&
            !t.isFunctionExpression(arg) &&
            !t.isArrowFunctionExpression(arg) &&
            !inspect.isLiteral(arg) &&
            !t.isIdentifier(arg) &&
            !t.isThisExpression(arg)
        ) {
            modifiers.putInSeparateStatement(argPath);
        }
        // if the argument is not null wrap it in karousos.maybeReturnPromise
        // otherwise, emit the event
        if (path.node.argument != null) {
            var retCall = karousos.buildMaybeReturnPromise(path);
            path.replaceWith(retCall);
        } else {
            let toEmit = karousos.buildEmitEvent(type)
            path.getStatementParent().insertBefore(toEmit)
        }
        bookkeeping.markVisited(path)
    },
}