"use strict";

const babelHelp = require('@babel/helper-plugin-utils');
const t = require('@babel/types');
const assert = require('assert');
const karousos = require('./utils/karousos');
const modifiers = require('./utils/modifiers');

module.exports = {
    handleAssertRejectOrThrow(path, state) {
        if (path.node.arguments.length == 0) {
            return
        }
        var fn = path.node.arguments[0]
        //replace the callback with a function expression
        modifiers.replaceWithFunctionExpression(path, 0, -1, false)
        //add parameters to callback function t
        //and to the callback function that is called when the assert fails
        karousos.addParamsToCallback(path.get('arguments')[0], t.arrayExpression([]), t.stringLiteral(''))
        if (path.node.arguments.length > 1 && (
                t.isFunctionExpression(path.node.arguments[1]) ||
                t.isArrowFunctionExpression(path.node.arguments[1]))) {
            gkarousos.addParamsToCallback(path.get('arguments')[1], t.arrayExpression([]), t.stringLiteral(''))
        }
        gen.markVisited(path)
    }
}