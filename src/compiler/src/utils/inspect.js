const t = require('@babel/types');
const debug = require('debug')('compiler');
const assert = require('assert');
const karousosModule = 'karousos';
var unsafe = new Map()

//Define all the functions that are exported
module.exports = {
    karousosModule,
    globalModules,
    extractName,
    getFunctionParentID,
    getPreviousStatement,
    getNextStatement,
    getSuffix,
    isFunctionDecl,
    isIdentifierOrSimpleMemberExp,
    propertyOneOf,
    identifierOneOf,
    isOneOfTheObjectMethods,
    isLoop,
    isLengthProperty,
    isLiteral,
    isCall,
    isApply,
    findCallee,
    isRequire,
    initialize_unsafe,
    setUnsafeBinding,
    isCallToNodeGroup,
    isReflectConstruct,
    isDetSyncCallToJsBuiltIn,
    mayBeCalledInternally,
    isOn,
    isSuperMethod,
    isFunctionConstructor,
    isGeneratorFunctionConstructor,
    isAsyncFunctionConstructor,
    isSymbolIterator,
    isEvery,
    isCallToAtomics,
    isAtomicWait,
    isAtomicNotify,
    isPromiseConstructor,
    isReflectConstructOfPromise,
    isPromiseRejectOrResolve,
    isPromiseRaceOrAll,
    isCallToPromise,
    isNext,
    isReturnOrThrow,
    isReflectApply,
    inWhileCondition,
    inFunctionDeclaration,
    inCondition,
    inConditionalExpression,
    inLoop,
    findTopLevelWhile,
    parentIsExpression,
    grandparentIsExpression,
}

var globalModules = new Map([
    ['Buffer', 'buffer.Buffer'],
    ['clearImmediate', 'timers.clearImmediate'],
    ['clearInterval', 'timers.clearInterval'],
    ['clearTimeout', 'timers.clearTimeout'],
    ['console'],
    ['Error'],
    ['AssertionError', 'Error'],
    ['RangeError', 'Error'],
    ['ReferenceError', 'Error'],
    ['SyntaxError', 'Error'],
    ['SystemError', 'Error'],
    ['TypeError', 'Error'],
    ['process'],
    ['queueMicrotask'],
    ['setImmediate', 'timers.setImmediate'],
    ['setInterval', 'timers.setInterval'],
    ['setTimeout', 'timers.setTimeout'],
    ['TextDecoder', 'util.TextDecoder'],
    ['TextEncoder', 'util.TextEncoder'],
    ['URL', 'url.URL'],
    ['URLSearchParams', 'url.URLSearchParams'],
    ['require', 'module.require'],
    ['Boolean'],
    ['global'],
    ['eval'],
    ['uneval'],
    ['escape'],
    ['unescape'],
    ['isFinite'],
    ['isNan'],
    ['parseFloat'],
    ['parseInt'],
    ['decodeURI'],
    ['decodeURIComponent'],
    ['encodeURI'],
    ['encodeURIComponent'],
    ['Object'],
    ['Function'],
    ['Symbol'],
    ['Error'],
    ['EvalError'],
    ['InternalError'],
    ['RangeError'],
    ['ReferenceError'],
    ['SyntaxError'],
    ['TypeError'],
    ['URIError'],
    ['Number'],
    ['BigInt'],
    ['Math'],
    ['Date'],
    ['String'],
    ['regExp'],
    ['Array'],
    ['Int8Array'],
    ['Uint8Array'],
    ['Uint8ClampedArray'],
    ['Int16Array'],
    ['Uint16Array'],
    ['Int32Array'],
    ['Uint32Array'],
    ['Float32Array'],
    ['Float64Array'],
    ['Map'],
    ['WeakMap'],
    ['Set'],
    ['WeakSet'],
    ['ArrayBuffer'],
    ['SharedArrayBuffer'],
    ['Atomics'],
    ['JSON'],
    ['Promise'],
    ['Reflect'],
    ['Proxy'],
    ['Intl'],
    ['WebAssembly']
])

// Produce a string that name of the variable
function extractName(path) {
    var out = ''
    var curPath = path
    while (t.isMemberExpression(curPath.node)) {
        if (t.isIdentifier(curPath.node.property) || t.isStringLiteral(curPath.node.property)) {
            if (t.isIdentifier(curPath.node.property)) {
                out = '.' + curPath.node.property.name + out
            } else {
                out = '.' + curPath.node.property.value + out
            }
        }
        curPath = curPath.get('object')
    }
    assert(t.isIdentifier(curPath) || t.isThisExpression(curPath) || t.isCallExpression(curPath) || t.isNewExpression(curPath) || t.isSuper(curPath) || t.isUnaryExpression(curPath) || t.isLogicalExpression(curPath))
    if (t.isIdentifier(curPath)) {
        out = curPath.node.name + out
    } else if (t.isCallExpression(curPath) || t.isNewExpression(curPath)) {
        out = extractName(curPath.get('callee')) + out
    } else if (t.isThisExpression(curPath)) {
        out = 'this' + out
    } else if (t.isSuper(curPath)) {
        out = 'super' + out
    } else {
        out = 'compute' + out
    }
    return out
}

// get the name of the function in which the current path belongs
function getFunctionParentID(path) {
    var fn = path.getFunctionParent()
    if (!fn) {
        return 'main'
    }
    if (fn.node.id) {
        return fn.node.id.name
    }
    if (fn.node.key) {
        return extractName(fn.get('key'))
    }
    if (t.isVariableDeclarator(fn.parent)) {
        return extractName(fn.parentPath.get('id'))
    }
    if (t.isAssignmentExpression(fn.parent)) {
        return extractName(fn.parentPath.get('left'))
    }
    return ''
}

// get the statement that appers right before the parent of the path
function getPreviousStatement(path, i) {
    let stmt = path.getStatementParent()
    if (stmt.key < i) {
        return stmt
    } else {
        return stmt.getSibling(stmt.key - i)
    }
}

// get the statement that appers right after the parent of the path
function getNextStatement(path, i) {
    let stmt = path.getStatementParent()
    return stmt.getSibling(stmt.key + i)
}

// returns the property if the node is a member expression. otherwise it returns the node
function getSuffix(node) {
    if (t.isMemberExpression(node)) {
        return node.property
    }
    return node

}

// Check if this variable is built from member expressions and identifiers only
function isIdentifierOrSimpleMemberExp(path) {
    if (t.isIdentifier(path)) {
        return true;
    }
    if (t.isMemberExpression(path)) {
        return isIdentifierOrSimpleMemberExp(path.get('object')) &&
            isIdentifierOrSimpleMemberExp(path.get('property'))
    }
    return false;
}


// Check if an identifier is str if str is a string or if
// the identifier is one of the elements in str.
function identifierOneOf(path, str) {
    if (path == undefined || path == null) {
        return false
    }
    var node = path
    if (path.node) {
        node = path.node
    }
    if (Array.isArray(str)) {
        return t.isIdentifier(node) && !path.scope.bindings[node.name] && str.includes(node.name);
    }
    return t.isIdentifier(node) && !path.scope.bindings[node.name] && node.name.includes(str)
}

// Check if the node corresponds to a member expression whose property is in properties
// properties can be an array or a single string.
function propertyOneOf(path, properties) {
    if (path == undefined || path == null) {
        return false
    }
    var node = path
    if (path.node != undefined) {
        node = path.node
    }
    if (Array.isArray(properties)) {
        return t.isMemberExpression(node) && t.isIdentifier(node.property) && properties.includes(node.property.name)
    }
    return t.isMemberExpression(node) && t.isIdentifier(node.property) && node.property.name == properties
}
// Check if the node corresponds to a member expression whose property is in properties
// and the object is in object. object/properties can be arrays or single strings.
function isOneOfTheObjectMethods(path, object, properties) {
    if (path == undefined || path == null) {
        return false
    }
    var node = path
    if (path.node != undefined) {
        node = path.node
    }
    if (Array.isArray(object)) {
        return t.isMemberExpression(node) && t.isIdentifier(node.object) && object.includes(node.object.name) && propertyOneOf(node, properties)
    } else {
        return t.isMemberExpression(node) && t.isIdentifier(node.object) && node.object.name == object && propertyOneOf(node, properties)
    }
}


// check if the current path corresponds to the definition of a function (any function)
function isFunctionDecl(path) {
    return t.isArrowFunctionExpression(path) || t.isFunctionDeclaration(path) ||
        t.isFunctionExpression(path) || t.isObjectMethod(path) || t.isClassMethod(path);
}


// Check if this is a loop
function isLoop(path) {
    return t.isDoWhileStatement(path) ||
        t.isWhileStatement(path) ||
        t.isForStatement(path) ||
        t.isForOfStatement(path) ||
        t.isForInStatement(path)
}

// Check if this is a x.length and that it is not in a statement like x.length = ..
function isLengthProperty(path) {
    return t.isIdentifier(path.node.property) && path.node.property.name == 'length' &&
        !path.node.computed && (!t.isAssignmentExpression(path.parent) ||
            !t.isMemberExpression(path.parent.left) ||
            !t.isIdentifier(path.parent.left.property) ||
            path.parent.left.property.name != 'length')
}

// Check if the node is a literal
function isLiteral(path) {
    return t.isNullLiteral(path) || t.isNumericLiteral(path) ||
        t.isStringLiteral(path) || t.isRegExpLiteral(path) ||
        t.isTemplateLiteral(path) || t.isBooleanLiteral(path)
}

/****************************************************************/
/*********************JS-builtIns********************************/
/****************************************************************/

// Takes as input a call. Checks if the callee is x.call
function isCall(path) {
    if (path == undefined) {
        return false
    }
    var callee = path.node != undefined ? path.get('callee').node : path.callee
    return propertyOneOf(callee, 'call')
}

// Takes as input a call. Checks if the callee is x.apply
function isApply(path) {
    if (path == undefined) {
        return false
    }
    var callee = path.node != undefined ? path.get('callee').node : path.callee
    return propertyOneOf(callee, 'apply') && !isOneOfTheObjectMethods(callee, 'Reflect', 'apply')
}

// Find the name of the function that is being called.
function findCallee(path) {
    if (!path) return path
    if (path.node === undefined) throw new Error('findCalleePath called on a non path')
    if (path.node === null) return null
    var callee = path.get('callee')
    // If the call is apply or call then the function that is being called is the object of the
    // member expression
    if (isCall(path) || isApply(path)) {
        callee = callee.get('object')
    }
    return callee
}

// Check if the call is require
function isRequire(path, state) {
    var callee = findCallee(path)
    return identifierOneOf(callee, 'require') ||
        isOneOfTheObjectMethods(callee, 'module', 'require')
}

// Initialize unsafe where we keep track of the bindings.
function initialize_unsafe() {
    unsafe = new Map()
}

// Save the new binding
function setUnsafeBinding(path) {
    if (t.isIdentifier(path.node.left) && path.scope.bindings[path.node.left.name] && !path.scope.bindings[path.node.left.name].unsafe) {
        path.scope.bindings[path.node.left.name].unsafe = path.node.loc
    }
    try {
        let name = extractName(path.get('left'))
        unsafe.set(name)
    } catch (err) {}
}

// Checks if the call is a call to required module and returns
// the result of the check. You are not expected to understand this
function isCallToNodeGroup(path, group, returnMap, noBindings) {
    var callee = findCallee(path)
    var moduleName
    var cur = callee
    var methods = []
    var newCur
    // Try to extract the name of the module that is being called
    while (true) {
        if (t.isCallExpression(cur) && isRequire(cur) && t.isStringLiteral(cur.get('arguments')[0])) {
            moduleName = cur.node.arguments[0].value
            break;
        } else if (t.isMemberExpression(cur)) {
            if (!t.isIdentifier(cur.node.property)) {
                return returnMap ? [false, -1, 0] : false
            }
            methods = [cur.node.property.name].concat(methods)
            cur = cur.get('object')
        } else if (t.isIdentifier(cur)) {
            [methods, newCur] = extractBinding(cur, methods, noBindings)
            if (!newCur || (t.isIdentifier(newCur) && cur.node.name == newCur.node.name)) {
                moduleName = cur.node.name
                if (globalModules.has(moduleName)) {
                    moduleName = globalModules.get(moduleName) ?
                        globalModules.get(moduleName) :
                        moduleName
                    break;
                }
                return returnMap ? [false, -1, 0] : false
            }
            if (noBindings) {
                return returnMap ? [false, -1, 0] : false
            }
            cur = newCur
        } else {
            return returnMap ? [false, -1, 0] : false
        }
    }
    var methods = moduleName.split(".").concat(methods)
    var pos = group
    var strSoFar = ''
    //check if it matches group and it is not overwritten
    //by the user code
    for (let i = 0; i < methods.length; i++) {
        if (i != 0) strSoFar = strSoFar.concat('.')
        strSoFar = strSoFar.concat(methods[i])
        if (unsafe.has(strSoFar) || !pos || !(pos instanceof Map) || !(pos.has(methods[i]))) {
            return returnMap ? [false, -1, 0] : false
        }
        pos = pos.get(methods[i])
    }
    if (returnMap) {
        if (!Array.isArray(pos)) {
            return [false, -1, 0]
        }
        var index = pos[0],
            argNo = pos[1]
        if (index == 'last') {
            return [true, path.node.arguments.length - 1, argNo]
        }
        if (path.node.arguments.length - 1 > index) {
            return [true, -1, 0]
        }
        return [true, index, argNo]
    }
    if (pos != undefined && !pos.has('')) {
        return returnMap ? [false, -1, 0] : false
    }
    return true
}

function extractBinding(path, methods, noBindings) {
    var curPath = path
    while (curPath && curPath.node) {
        if (curPath.scope.bindings[path.node.name]) {
            break;
        }
        curPath = curPath.parentPath
    }
    if (!curPath || !curPath.node) {
        return [methods]
    }
    var binding = curPath.scope.bindings[path.node.name].path
    //Need to check that this binding appears before the use
    if (!path.node.loc || !binding.node.loc || (appearsBefore(path.node.loc, binding.node.loc) && !noBindings)) {
        return [methods]
    }
    //need to check that it is not overwritten by an assignment before
    if (curPath.scope.bindings[path.node.name].unsafe && !noBindings) {
        if (appearsBefore(curPath.scope.bindings[path.node.name].unsafe, path.node.loc)) {
            return [methods]
        }
    }
    if (t.isVariableDeclaration(binding)) {
        for (let i = 0; i < binding.node.declarations.length; i++) {
            let declId = binding.get('declarations')[i].get('id')
            if (t.isIdentifier(declId) && declId.node.name == path.node.name) {
                return [binding.get('declarations')[i].get('init'), methods]
            }
        }
    }
    if (t.isVariableDeclarator(binding)) {
        //update methods
        if (t.isObjectPattern(binding.get('id'))) {
            methods = [path.node.name].concat(methods)
        }
        return [methods, binding.get('init')]
    }
    if (t.isFunctionDeclaration(binding) || t.isFunctionExpression(binding)) {
        return [methods, binding]
    }
    if (t.isAssignmentExpression(binding) || t.isAssignmentPattern(binding)) {
        return [methods, binding.get('right')]
    }
    if (t.isFunctionExpression(binding.parent) || t.isArrowFunctionExpression(binding.parent) || t.isFunctionDeclaration(binding.parent)) {
        //return null literal so that the verifier rejects next
        return [methods, t.nullLiteral()]
    }
    return [methods]
}

function appearsBefore(pos1, pos2) {
    return pos1.end['line'] < pos2.start['line'] ||
        (pos1.end['line'] == pos2.start['line'] &&
            pos1.end['column'] < pos2.start['column'])
}

// Check if the call is Reflect.construct
function isReflectConstruct(path) {
    return isCallToNodeGroup(path, new Map([
        ['Reflect', new Map([
            ['construct']
        ])]
    ]), false, true)
}

//Check if the call is Reflect.construct(s) where s \in str
function isReflectConstructOf(path, str) {
    if (path == undefined) return false
    var args = path.node != undefined ? path.node.arguments : path.arguments
    if (Array.isArray(str)) {
        return isReflectConstruct(path) && args.length > 0 &&
            t.isIdentifier(args[0]) && str.includes(args[0].name) &&
            !path.scope.bindings[args[0].name]
    }
    return isReflectConstruct(path) && args.length > 0 &&
        t.isIdentifier(args[0]) && args[0].name == str &&
        !path.scope.bindings[args[0].name]
}

// Check if this is a deterministic call to a javascript builtin function.
// The check is not complete. Because of the dynamic nature of JavaScript,
// the compiler considers very few functions as native js functions.
// Most functions are considered non-native and the runtime figures out what they are.
function isDetSyncCallToJsBuiltIn(path) {
    return isSuper(path) ||
        isCallToGlobal(path)
}


function isSuper(path) {
    var callee = findCallee(path)
    return t.isSuper(callee)
}

function isCallToGlobal(path) {
    return isCallToNodeGroup(path, new Map([
        ['global', new Map([
            ['constructor']
        ])]
    ]), false, true)
}


// check if this is a function that could be called internally without an explicit call
// e.g. if it is a getter or a setter
function mayBeCalledInternally(path) {
    var fns = ['toString', 'toJSON', 'get', 'set', 'then', 'catch', 'finally'];
    if (path && (identifierOneOf(path, fns) ||
            propertyOneOf(path, fns))) return true
    if (t.isIdentifier(path)) {
        return fns.some(str => {
            return new RegExp('_' + str + "[0-9]+").test(path.node.name)
        });
    }
    return false;

}

// Check if this is a call to on
function isOn(path) {
    if (t.isMemberExpression(path.node) && t.isIdentifier(path.node.property) &&
        path.node.property.name == 'on') {
        return true;
    }
    return false;
}

// check if the input node is super.method
function isSuperMethod(path) {
    return t.isMemberExpression(path) && t.isIdentifier(path.node.property) && t.isSuper(path.node.object)
}
// Function Constructors
function isFunctionConstructor(path) {
    return isCallToNodeGroup(path, new Map([
        ['Function', new Map([
            [''],
            ['prototype'],
        ])],
        ['GeneratorFunction', new Map([
            [''],
            ['prototype'],
        ])],
        ['AsyncFunction', new Map([
            [''],
            ['prototype'],
        ])]
    ]), false, true)
}

function isGeneratorFunctionConstructor(path) {
    return isCallToNodeGroup(path, new Map([
        ['GeneratorFunction', new Map([
            [''],
            ['prototype'],
        ])],
    ]), false, true)
}

function isAsyncFunctionConstructor(path) {
    return isCallToNodeGroup(path, new Map([
        ['GeneratorFunction', new Map([
            [''],
            ['prototype'],
        ])],
    ]), false, true)
}

function isSymbolIterator(path) {
    return isOneOfTheObjectMethods(path, 'Symbol', ['asyncIterator', 'iterator'])
}

function isEvery(path) {
    var callee = findCallee(path)
    return propertyOneOf(callee, ['every', 'forEach'])
}

// Atomics

function isCallToAtomics(path) {
    return isCallToNodeGroup(path, new Map([
        ['Atomics', new Map([
            ['add'],
            ['and'],
            ['compareExchange'],
            ['isLockFree'],
            ['load'],
            ['or'],
            ['store'],
            ['sub'],
            ['xor']
        ])]
    ]), false, true)
}

function isAtomicWait(path) {
    return isCallToNodeGroup(path, new Map([
        ['Atomics', new Map([
            ['wait']
        ])]
    ]), false, true)
}

function isAtomicNotify(path) {
    return isCallToNodeGroup(path, new Map([
        ['Atomics', new Map([
            ['notify']
        ])]
    ]), false, true)
}

//Promises

function isPromiseConstructor(path) {
    return isCallToNodeGroup(path, new Map([
            ['Promise']
        ]), false, true) &&
        (t.isFunctionExpression(path.node.arguments[0]) ||
            t.isArrowFunctionExpression(path.node.arguments[0]))
}

function isReflectConstructOfPromise(path) {
    return isReflectConstructOf(path, 'Promise')
}

function isPromiseRaceOrAll(path) {
    return isCallToNodeGroup(path, new Map([
        ['Promise', new Map([
            ['race'],
            ['all']
        ])]
    ]), false, true)
}

function isPromiseRejectOrResolve(path) {
    return isCallToNodeGroup(path, new Map([
        ['Promise', new Map([
            ['resolve'],
            ['reject']
        ])]
    ]), false, true)
}


function isCallToPromise(path, state) {
    var callee = findCallee(path)
    return isPromiseConstructor(path, state) ||
        isReflectConstructOfPromise(path, state) ||
        isPromiseRejectOrResolve(path, state) ||
        isPromiseRaceOrAll(path, state)
}


//Generators

function isNext(path) {
    var callee = findCallee(path)
    return propertyOneOf(callee, 'next')
}

function isReturnOrThrow(path) {
    var callee = findCallee(path)
    return propertyOneOf(callee, ['return', 'throw'])
}

//Reflection
function isReflectApply(path) {
    return isCallToNodeGroup(path, new Map([
        ['Reflect', new Map([
            ['apply']
        ])]
    ]), false, true)
}

// Check if the current node is inside the conditional of a while or loop
function inWhileCondition(path) {
    while (path && path.node && !t.isVariableDeclaration(path) &&
        !t.isExpressionStatement(path) &&
        !t.isBlockStatement(path)) {
        if (t.isDoWhileStatement(path) || t.isWhileStatement(path)) {
            return true
        }
        path = path.parentPath
    }
    return false
}


//checks if the operation is inside a condition of a while loop/ for loop/ if etc
function inCondition(path) {
    let parent = path.parentPath;
    return t.isDoWhileStatement(parent) ||
        t.isForInStatement(parent) || t.isForOfStatement(parent) ||
        t.isForStatement(parent) || t.isIfStatement(parent) ||
        t.isSwitchCase(parent) || t.isWhileStatement(parent)
}

// checks if the path is in a conditional expression
function inConditionalExpression(path) {
    do {
        if (path.node && t.isConditionalExpression(path)) {
            return true
        }
        path = path.parentPath

    } while (path && path.node && !t.isVariableDeclaration(path) &&
        !t.isExpressionStatement(path) &&
        !t.isBlockStatement(path) && !t.isObjectProperty(path) &&
        !t.isCallExpression(path) && !t.isNewExpression(path) &&
        !t.isTemplateLiteral(path))

    return false
}

// checks if the path is in a loop
function inLoop(path) {
    while (path && path.node &&
        !t.isExpressionStatement(path) &&
        !t.isBlockStatement(path)) {
        if (isLoop(path)) {
            return true
        }
        path = path.parentPath
    }
    return false
}

// Check if this path is in a function declaration
function inFunctionDeclaration(path) {
    while (path && path.node && !t.isVariableDeclaration(path) &&
        !t.isExpressionStatement(path) &&
        !t.isBlockStatement(path)) {
        if (t.isFunctionDeclaration(path) || t.isObjectProperty(path) || t.isClassProperty(path) || t.isClassBody(path) || t.isClassDeclaration(path)) {
            return true
        }
        path = path.parentPath
    }
    return false
}

// find the while statement that encloses this path
function findTopLevelWhile(path) {
    while (path && path.node && !t.isVariableDeclaration(path) &&
        !t.isExpressionStatement(path) &&
        !t.isBlockStatement(path)) {
        if (t.isDoWhileStatement(path) || t.isWhileStatement(path)) {
            return path
        }
        path = path.parentPath
    }
    return null;
}

function parentIsExpression(path) {
    return t.isExpressionStatement(path.parentPath)
}

function grandparentIsExpression(path) {
    return t.isExpressionStatement(path.parentPath.parentPath)
}