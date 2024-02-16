const fs = require('fs');
const babel = require("@babel/core");
const fsExtra = require('fs-extra');
const plugin = require('./src/babel-plugin.js')
var opts; // global opts for babel

// Compile the given file or all the js files in the given folder
function compileAllFiles(input, output, isVerifier, ignore) {
    initializeOpts('', isVerifier, false, false, ignore);

    if (isDirectory(input)) {
        compileFilesInDir(input, transform, output, ignore, isVerifier)
    } else if (input.endsWith('.js')) {
        transform(input, output, isVerifier)
    }
}

exports.compileAllFiles = compileAllFiles;

// In this case, we are only given the entry point for the server ande compile it. 
// We only compile the modules that are required. If NO_NODE_MODULES=true we don't compile the modules
// in node_modules.
function compileOnlyRequired(input, output, isVerifier, ignore) {
    var required = new Set();
    initializeOpts('', isVerifier, false, false, ignore, required);
    if (isDirectory(input)) {
        compileFilesInDir(input, transform, output, [], isVerifier, required, false)
    } else if (input.endsWith('.js')) {
        transform(input, output, isVerifier, required)
        for (let file of required) {
            let input_mod_path = process.env.SRC_NODE_MODULES + "/" + file;
            let output_mod_path = process.env.DST_NODE_MODULES + "/" + file + process.env.SUFFIX;
            if (!fs.existsSync(output_mod_path)) {
                compileFilesInDir(input_mod_path, transform, output_mod_path, [], isVerifier, required, false)
            }
        }
    }
}

exports.compileOnlyRequired = compileOnlyRequired

// Simple transform function that transforms a piece of code, not necessarily a script
// Used to transform code in new Function(code), and eval(code)
function transformFunction(func, isNewFunction, isVerifier, isEval) {
    initializeOpts('func', isVerifier, isNewFunction, isEval);
    const ret = babel.transformSync(func, opts);
    return ret.code;
}

exports.transformFunction = transformFunction;

//compile all files  on a dir recursively one by one 
//and apply a transformation
function compileFilesInDir(dirname, transform, outDir, ignore, isVerifier, required, inNodeModules) {
    //make dir if not exists
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);
    //transform the names if needed
    if (!dirname.endsWith('/')) dirname = dirname + "/";
    if (!outDir.endsWith('/')) outDir = outDir + "/";
    var files = fs.readdirSync(dirname)
    for (let file of files) {
        var fname = dirname + file
        var outName = outDir + file
        if (!fs.existsSync(fname)) continue;
        //skip scripts and test. just copy them
        if (['scripts', 'test', '@babel'].includes(file)) {
            console.log('skipping', fname)
            fsExtra.copy(fname, outName, {
                dereference: true
            }, err => {
                if (err) {
                    console.log(fname, outName)
                    throw err
                }
            })
            continue;
        }
        //skip files that already exist
        if (fs.existsSync(outName) && !isDirectory(fname)) {
            console.log('skipping', outName)
            continue
        }
        // Skip .min.js files if needed. Just copy them
        if (process.env.IGNORE_MIN_JS == "true" && fname.endsWith(".min.js")) {
            console.log('skipping')
            fsExtra.copy(fname, outName, err => {
                if (err) throw err
            })
            continue
        }
        //check if we need to ignore this file or dir because the user asked us to
        if (ignore.includes(fname) || ignore.includes(fname + '/')) {
            console.log('skipping', fname)
            fsExtra.copy(fname, outName, err => {
                if (err) {
                    throw err
                }
            })
            continue
        }
        if (isDirectory(fname) && !fname.startsWith('.')) {
            //Compile the files in the directory. 
            if (inNodeModules && required != undefined) {
                console.log("In Node modules", inNodeModules, outName)
                // If we are compiling a node module, place the compiled function
                // in node_modules/module_name$SUFFIX
                outName = outName + process.env.SUFFIX
            }
            compileFilesInDir(fname, transform, outName, ignore, isVerifier, required, fname.endsWith("node_modules"))
        } else if (fname.endsWith('.js')) {
            //Compile the js file
            console.log('Parsing ', fname)
            transform(fname, outName, isVerifier)
            console.log('DONE\n')
        } else {
            // Skip all files that are not written in javascript
            console.log('skipping', fname)
            fs.copyFileSync(fname, outName)
        }
    }
    // Parse any required modules
    if (required != undefined) {
        for (let file of required) {
            if (file.endsWith("/")) file = file.slice(0, -1)
            let prefix = process.env.DST_NODE_MODULES
            let input_mod = prefix + "/" + file
            let output_mod = prefix + "/" + file + process.env.SUFFIX
            if (!fs.existsSync(output_mod) && isDirectory(input_mod)) {
                parseFilesInDirSerially(input_mod, transform, output_mod, ignore, isVerifier, required, false)
            }
        }
    }
}

//runs the compiler on a file and transforms it
function transform(filename, outName, isVerifier) {
    try {
        console.log('transforming', filename);
        var sourceCode = fs.readFileSync(filename, 'utf-8');
        // First, read in the AST
        const {
            ast
        } = babel.transformSync(sourceCode, {
            filename,
            ast: true,
            code: false,
            sourceType: 'script'
        });
        const res1 = babel.transformFromAstSync(ast, sourceCode, {
            filename,
            ast: true
        })
        opts.filename = filename; //set the filename
        // Apply the transformation on the AST of the input code
        const {
            code
        } = babel.transformFromAstSync(res1.ast, res1.code, opts)
        // Write out the file
        fs.writeFileSync(outName, code)
        console.log('Done transforming', outName)
    } catch (err) {
        // Ignore babel parse errors
        if (err.code == 'BABEL_PARSE_ERROR') {
            console.log('Babel parse error', filename, err)
            fs.copyFileSync(filename, outName)
        } else {
            throw err
        }
    }
}

// We have one opts struct that we modify accordingly whenever we call the babel transpiler. 
// We have one opts struct because otherwise we get visitor._exploded error
function initializeOpts(filename, isVerifier, isNewFunction, isEval, ignore, required) {
    if (!opts) {
        // Initialize opts the first time this function is called
        opts = {
            plugins: [
                [plugin, {
                    isVerifier,
                    isNewFunction,
                    isEval,
                    ignore,
                    required
                }]
            ],
            sourceType: "script",
            filename: filename,
            babelrc: false,
        }
    } else {
        // set the fields of opts if opts is already initialized
        opts.plugins[0][1].isVerifier = isVerifier;
        opts.plugins[0][1].isNewFunction = isNewFunction;
        opts.plugins[0][1].isEval = isEval;
        opts.plugins[0][1].ignore = ignore;
        opts.plugins[0][1].required = required;
        opts.filename = filename;

    }
}

// Check if a file is a directory
function isDirectory(file) {
    let stats = fs.statSync(file)
    return stats.isDirectory()
}