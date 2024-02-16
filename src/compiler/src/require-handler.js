"use strict";

const t = require('@babel/types');
const assert = require('assert');
const debug = require('debug')('add-rep-col');
const fs = require('fs')
const bookkeeping = require('./utils/bookkeeping');
const modifiers = require('./utils/modifiers');
const karousos = require('./utils/karousos');
const nodeBuiltIns = require('./utils/nodeBuiltIns');

function requiredExpress(path, state) {
    if (!t.isStringLiteral(path.node.arguments[0]) || path.node.arguments[0].value != 'express') {
        return false
    }
    //replace with our express
    path.get('arguments')[0].replaceWith(t.stringLiteral(process.env.EXPRESS_PATH))
    return true
}

module.exports = {
    //check the required module name and save it in the state
    handleRequire(path, state) {
        var moduleName, parentPath
        modifiers.insertBefore(path, karousos.buildPushContext())
        if (requiredExpress(path, state)) {
            return
        }
        [module, parentPath] = nodeBuiltIns.getRequiredNodeCoreModuleOrMethod(path, state)
        //update the required modules if needed
        if (state.opts.required) {
            if (t.isStringLiteral(path.node.arguments[0])) {
                // If this is a node_module and NO_NODE_MODULES=false, then add it to the required 
                // modules that we are saving in the state
                var required = path.node.arguments[0].value
                if (required.startsWith("./") || required.startsWith("../") ||
                    required == ".." || required == "." ||
                    required.endsWith(process.env.SUFFIX) ||
                    state.opts.ignore.includes(required)) return;
                if (fs.existsSync(process.env.DST_NODE_MODULES + "/" + required) &&
                    process.env.NO_NODE_MODULES == 'false') {
                    state.opts.required.add(required)
                    path.get('arguments')[0].replaceWith(t.stringLiteral(required + process.env.SUFFIX))
                    return;
                }
            }
            // Wrap the require into a call to the karousos' library's handleRequire 
            path.get('arguments')[0].replaceWith(karousos.buildHandleRequire(path.node.arguments[0]))
            bookkeeping.markVisited(path.get('arguments')[0])
            bookkeeping.markVisited(path)
        }
    }
}