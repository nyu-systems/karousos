"use strict";

const babelHelp = require('@babel/helper-plugin-utils');
const t = require('@babel/types');
const assert = require('assert');
const common = require('./common');
const bookkeeping = require('./utils/bookkeeping');
const karousos = require('./utils/karousos');
const debug = require('debug')('compiler');
const simd = require('./simd');

/* This is the main entrance to the plugin*/

Object.defineProperty(exports, "__esModule", {
    value: true
});

// Export the mainVisitor
exports.default = babelHelp.declare((api, options, dirname) => {
    return mainVisitor
});

var mainVisitor = {

    visitor: {

        Program(path, state) {
            common.handleProgram(path, state);
        },

        TaggedTemplateExpression(path) {
            common.handleTaggedTemplateExpression(path);
        },

        VariableDeclaration(path, state) {
            common.handleVariableDeclaration(path, state);
        },

        VariableDeclarator(path, state) {
            common.handleVariableDeclarator(path, state);
        },

        ConditionalExpression(path, state) {
            if (bookkeeping.alreadyVisited(path)) {
                return;
            }
            common.handleConditionalExpression(path);
        },

        AssignmentPattern(path, state) {
            common.handleAssignmentPattern(path, state);
        },

        AssignmentExpression(path, state) {
            common.handleAssignmentExpression(path, state);
        },

        NewExpression(path, state) {
            common.handleNewExpression(path, state, mainVisitor.visitor);
        },

        CallExpression(path, state) {
            common.handleCallExpression(path, state);
        },

        FunctionDeclaration(path, state) {
            common.handleFunctionDeclaration(path, state, mainVisitor.visitor);
        },

        ArrowFunctionExpression(path, state) {
            common.handleFunctionExpression(path, state, mainVisitor.visitor);
        },

        FunctionExpression(path, state) {
            common.handleFunctionExpression(path, state, mainVisitor.visitor);
        },

        ClassExpression(path, state) {
            common.handleClass(path, state, mainVisitor.visitor);
        },

        ClassDeclaration(path, state) {
            common.handleClass(path, state, mainVisitor.visitor);
        },

        ObjectMethod(path, state) {
            common.handleObjectMethod(path, state, mainVisitor.visitor);
        },

        ClassMethod(path, state) {
            common.handleObjectMethod(path, state);
        },

        ObjectProperty(path, state) {
            common.handleObjectProperty(path, state, mainVisitor.visitor);
        },

        ClassProperty(path, state) {
            common.handleObjectProperty(path, state);
        },

        ReturnStatement(path, state) {
            common.handleReturnOrThrow(path, state, 'success');
        },

        ThrowStatement(path, state) {
            common.handleReturnOrThrow(path, state, 'fail');
        },

        AwaitExpression(path, state) {
            common.handleAwait(path);
        },

        YieldExpression(path, state) {
            common.handleYield(path, state);
        },

        CatchClause(path, state) {
            common.handleCatchClause(path, state);
        },

        TryStatement(path, state) {
            common.handleTryStatement(path, state);
        },

        ForOfStatement(path, state) {
            common.handleForOfStatement(path);
        },

        SpreadElement(path, state) {
            common.handleSpreadElement(path);
        },

        Identifier(path, state) {
            common.handleIdentifier(path, state);
        },

        MemberExpression(path, state) {
            common.handleMemberExpression(path, state);
        },

        IfStatement(path, state) {
            common.handleIfStatement(path);
        },

        SwitchStatement(path, state) {
            common.handleSwitchStatement(path);
        },

        SwitchCase(path) {
            common.handleSwitchCase(path);
        },

        DoWhileStatement(path, state) {
            common.handleDoWhileStatement(path, state, mainVisitor.visitor)
        },

        ForInStatement(path, state) {
            common.handleForInStatement(path);
        },

        ForStatement(path, state) {
            common.handleForStatement(path, state, mainVisitor.visitor);
        },

        WhileStatement(path, state) {
            common.handleWhileStatement(path, state, mainVisitor.visitor);
        },

        LogicalExpression(path, state) {
            common.handleLogicalExpression(path, state);
        },

        UnaryExpression(path, state) {
            if (bookkeeping.alreadyVisited(path)) return;
            // make the argument be a member expression or an identifier
            karousos.formatArgsRec(path, [path.get('argument')], false);
            // handle the identifier or the member expression
            if (t.isIdentifier(path.get('argument'))) {
                common.handleIdentifier(path.get('argument'), state);
            } else if (t.isMemberExpression(path.get('argument'))) {
                common.handleMemberExpression(path.get('argument'), state);
            }
            simd.handleUnaryExpression(path, state);
        },

        BinaryExpression(path, state) {
            // make the arguments be member expressions or identifiers
            if (bookkeeping.alreadyVisited(path)) return;
            karousos.formatArgsRec(path, [path.get('left'), path.get('right')], false);
            common.handleBinaryExpression(path, state);
            simd.handleBinaryExpression(path, state);
        },

        UpdateExpression(path, state) {
            common.handleUpdateExpression(path, state);
        },

        SequenceExpression(path, state) {
            common.handleSequenceExpression(path, state);
        },

        ContinueStatement(path, state) {
            common.handleContinueStatement(path, state);
        },

        LabeledStatement(path, state) {
            common.handleLabeledStatement(path)
        },

        ThisExpression(path, state) {
            common.handleThisExpression(path, state);
        }
    }
}