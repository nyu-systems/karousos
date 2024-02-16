"use strict";

const {
    compileOnlyRequired,
    transformFunction
} = require(process.env.KAR_HOME + '/src/compiler/compile_functions')
const fs = require('fs');
const builtins = require('./builtins');

var generatorFuncProto = Object.getPrototypeOf(function*() {});
var asyncFuncProto = Object.getPrototypeOf(async function() {});

// Compiles the code of the new function and creates the new function
exports.newFunction = function(isGenerator, isAsync, ...args) {
    var funcType;
    if (isAsync) {
        funcType = asyncFuncProto.constructor;
    } else if (isGenerator) {
        funcType = generatorFuncProto.constructor;
    } else {
        funcType = Function.constructor;
    }
    // First, create the function
    var func = funcType(...args);
    // Transform the function
    var code = transformFunction(func, true, process.env.IS_VERIFIER == "true", false);
    // add require, requestID, handlerID, retEventTypes, objID as arguments.
    // require is an argument because we want this function to require the same 
    // modules as the rest of the code (so that the server-lib and verifier-lib)
    // modules are initialized
    var start = code.indexOf('{');
    var end = code.lastIndexOf('}');
    var body = code.slice(start + 1, end);
    var func3 = funcType(...['require', 'requestID', 'handlerID',
        'retEventTypes', 'objID'
    ].concat(args.slice(0, args.length - 1)).concat(body));
    // Now wrap this function in a function that passes require as an argument
    var func4 = function(...funcArgs) {
        return func3.apply(this, [require].concat(funcArgs));
    };
    // mark the function
    func4.isNewFunction = true;
    return func4;
}

// Handle a call to require
exports.handleRequire = function(name, requireThis) {
    let srcName = process.env.DST_NODE_MODULES + "/" + name;
    let suffix = '';
    // If this is a call to a builtin module, or a call to one of 
    // our modules, or a call to the main code, do nothing
    if (['.', '..'].includes(name) ||
        builtins.nodeModules.has(name) ||
        name.startsWith('./') || name.startsWith('../') ||
        name == process.env.KAR_HOME + '/src/measurements' ||
        name.startsWith(process.env.DST_MAIN_CODE) ||
        name.endsWith('.json')) {
        return name;
    }
    // Figure out what is the name of the module that is required
    if (name.includes("/")) {
        suffix = name.slice(name.indexOf('/'));
        name = name.slice(0, name.indexOf('/'));
        srcName = process.env.DST_NODE_MODULES + "/" + name;
    }
    // Figure out what is the name of the compiled module
    var dstName = srcName + process.env.SUFFIX;
    // Check if the compiled module exists and, if not, compile it
    if (!fs.existsSync(dstName) && fs.existsSync(srcName)) {
        console.log("PARSING", srcName);
        try {
            // check if there exists an annotated version of this module in annotated libs
            // and if so, use this version to produce the compiled module
            let annotated_name = process.env.ANNOTATED_LIBS + name + process.env.ANNOTATED_SUFFIX;
            if (fs.existsSync(annotated_name)) {
                srcName = annotated_name
            }
            compileOnlyRequired(srcName, dstName, process.env.IS_VERIFIER == "true", []);
        } catch (err) {
            console.log(err);
            throw err;
        }
        console.log("done");
    }
    // Return the name of the compiled module
    return name + process.env.SUFFIX + suffix;
}