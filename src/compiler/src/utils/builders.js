"use strict"

/*******************************************************/
/*******Functions to build inspect statements ***********/
/*******************************************************/

const t = require('@babel/types')
const debug = require('debug')('compiler')
const inspect = require('./inspect')

module.exports = {
    generateUid,
    getIdentifier,
    buildAllVariableDeclarationsFromObjectExpression,
    buildAllVariableDeclarationsFromArrayPattern,
    buildAssignmentStatement,
    buildVariableDeclaration,
    buildMultiVariableDeclaration,
    buildCall,
    buildCallStatement,
    buildIfStatement,
    buildThrowErrMsg
}

// Generate a unique identifier
function generateUid(path, name) {
    var res = path.scope.generateUidIdentifier(name);
    res.visitedObjID = true;
    return res
}

// create an identifier from the input if the input is a str. otherwise it returns the input
function getIdentifier(str) {
    return (typeof(str) === 'string' || str instanceof String) ? t.identifier(str) : str
}


// Break variable declarations of the form var {} = .. to individual variable declarations
function buildAllVariableDeclarationsFromObjectExpression(kind, obj) {
    var decl = []
    for (let i = 0; i < obj.properties.length; i++) {
        let p = obj.properties[i]
        let pName
        if (t.isObjectProperty(p)) {
            pName = p.key
        } else if (t.isRestElement) {
            pName = p.argument
        } else {
            throw new Error('property inside object pattern not recognized')
        }
        decl.push(t.variableDeclarator(pName))
    }
    return t.variableDeclaration(kind, decl)
}

// Break variable declarations of the form var [..] = .. to individual variable declarations 
function buildAllVariableDeclarationsFromArrayPattern(kind, obj) {
    var decl = [];
    for (let i = 0; i < obj.elements.length; i++) {
        decl.push(t.variableDeclarator(obj.elements[i]));
    }
    return t.variableDeclaration(kind, decl)
}

function buildAssignmentStatement(operator, l, r) {
    let node = t.expressionStatement(
        t.assignmentExpression(operator, getIdentifier(l), getIdentifier(r))
    );
    node.expression.visited = true;
    return node;
}


function buildVariableDeclaration(type, id, initializer) {
    var node;
    if (initializer === undefined) {
        node = t.variableDeclaration(type, [
            t.variableDeclarator(getIdentifier(id))
        ])
    } else {
        node = t.variableDeclaration(type, [
            t.variableDeclarator(getIdentifier(id), getIdentifier(initializer))
        ])
    }
    node.visited = true;
    node.declarations[0].visited = true;
    return node;
}

function buildMultiVariableDeclaration(type, ids, initializers) {
    if (ids.length != initializers.length) {
        throw new Error('ids length must match initializers length')
    }
    var declarations = []
    for (let i = 0; i < ids.length; i++) {
        declarations.push(t.variableDeclarator(getIdentifier(ids[i]), getIdentifier(initializers[i])))
    }
    return t.variableDeclaration(type, declarations)
}

function buildCall(objName, objMethod, args) {
    if (objMethod == undefined) {
        return t.callExpression(getIdentifier(objName), args)
    }
    return t.callExpression(
        t.memberExpression(
            getIdentifier(objName), getIdentifier(objMethod)), args
    )
}

function buildCallStatement(objName, objMethod, args) {
    return t.expressionStatement(buildCall(objName, objMethod, args))
}

function buildIfStatement(test, cons, alt) {
    if (test == null || test == undefined) {
        throw new Error('cannot build if statement')
    }
    return t.ifStatement(test, cons, alt)
}

function buildThrowErrMsg(errMsg) {
    return t.throwStatement(t.newExpression(getIdentifier('Error'), [t.stringLiteral(errMsg)]))
}