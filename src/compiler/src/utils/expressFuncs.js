const t = require('@babel/types')
const debug = require('debug')('compiler')
const inspect = require('./inspect.js')
const build = require('./builders.js')
const assert = require('assert')

module.exports = {
    // Check if this is a call to express and, if so, add the name of the function to ionCoreModules of the state    
    handleCallToExpress(path, state) {
        var callee = inspect.findCallee(path)
        if (!state.ionCoreModules || !t.isIdentifier(callee) || !state.ionCoreModules.has(callee.node.name) || state.ionCoreModules.get(callee.node.name) != 'express') {
            return false
        }
        assert(t.isVariableDeclarator(path.parent) || t.isAssignmentExpression(path.parent))
        var name
        if (t.isVariableDeclarator(path.parent)) {
            name = path.parent.id
        } else {
            name = path.parent.left
        }
        assert(t.isIdentifier(name))
        state.ionCoreModules.set(name.name, 'expressApp')
        return true
    },
}