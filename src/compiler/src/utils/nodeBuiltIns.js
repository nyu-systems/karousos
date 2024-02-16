// This file contains various functions that help the compiler recognize so native Node.js functions

const t = require('@babel/types')
const debug = require('debug')('compiler')
const {
    isCallToNodeGroup,
} = require('./inspect.js')
const assert = require('assert')

module.exports = {

    // Checks if the required module is a node primitive module and if so it returns the module name
    getRequiredNodeCoreModuleOrMethod(path, state) {
        if (t.isObjectProperty(path.parentPath)) {
            return ['', null]
        }
        assert(t.isExpressionStatement(path.parentPath) || t.isAssignmentExpression(path.parentPath) || t.isVariableDeclarator(path.parentPath) || t.isMemberExpression(path.parentPath))
        if (!t.isStringLiteral(path.node.arguments[0])) {
            return ['', null]
        }
        module = path.node.arguments[0].value
        if (!detSyncCallNode.has(module)) {
            return ['', null]
        }
        var module = path.node.arguments[0].value
        var nodePath = path.parentPath
        while (!t.isAssignmentExpression(nodePath) && !t.isVariableDeclarator(nodePath) && !t.isExpressionStatement(nodePath)) {
            assert(t.isMemberExpression(nodePath) && t.isIdentifier(nodePath.node.property))
            let methodName = nodePath.node.property.name
            module = module + '.' + methodName
            nodePath = nodePath.parentPath
        }
        if (t.isExpressionStatement(nodePath)) {
            return ['', null]
        }
        return [module, nodePath]
    },

    // Checks if this is a call to a node.js core module that emits a promise
    isCallToDetNodeCorePromiseEmitEvent(path, state) {
        return isCallToNodeGroup(path, callDetNodePromiseEmitEvent, false)
    },

    // Checks if this is a call to a node.js primitive module that takes a callback
    isCallToNodeBuiltInWithCallback(path, state) {
        if (path.node.arguments.length == 0) {
            return [false, -1, 0]
        }
        var ret = isCallToNodeGroup(path, callNodeCoreWithCb, true)
        if (ret[0] && path.node.arguments.length > ret[1] && mayBeFunction(path.node.arguments[ret[1]])) return ret

        return [false, -1, 0]
    },

    //Assert module

    isAssertRejectOrThrow(path, state) {
        return isCallToNodeGroup(path, this.assertRejectOrThrow)
    },

    isSetUncaughtExceptionCaptureCallback(path, state) {
        return isCallToNodeGroup(path, processSetUncaughtExceptionCaptureCallback)
    },

    isCallToEventsOnce(path, state) {
        return isCallToNodeGroup(path, this.eventsOnceCall, false)
    },

    isUtilCallbackify(path, state) {
        return isCallToNodeGroup(path, new Map([
            ['util', new Map([
                ['callbackify']
            ])]
        ]), false)
    }
}

// Check if a token may correspond to a function
function mayBeFunction(node) {
    return t.isFunctionExpression(node) || t.isArrowFunctionExpression(node) ||
        t.isIdentifier(node) || t.isMemberExpression(node)
}

const callDetNodePromiseEmitEvent = new Map([
    ['dns', new Map([
        ['promises', new Map([
            ['lookup'],
            ['loookupService'],
        ])]
    ])],
    ['fs', new Map([
        ['promises', new Map([
            ['access'],
            ['appendFile'],
            ['chmod'],
            ['chown'],
            ['copyFile'],
            ['lchmod'],
            ['lchown'],
            ['link'],
            ['lstat'],
            ['mkdir'],
            ['mkdtemp'],
            ['open'],
            ['readdir'],
            ['readFile'],
            ['readlink'],
            ['realpath'],
            ['rename'],
            ['rmdir'],
            ['stat'],
            ['symlink'],
            ['truncate'],
            ['unlink'],
            ['utimes'],
            ['writeFile']
        ])]
    ])]
]);

const callNodeCoreWithCb = new Map([
    ['crypto', new Map([
        ['generateKeyPair', [2, 3]],
        ['pbkf2', [5, 2]],
    ])],
    ['dns', new Map([
        ['lookup', ['last', 3]],
        ['lookupService', [2, 3]],
    ])],
    ['fs', new Map([
        ['access', ['last', 1]],
        ['ftruncate', ['last', 1]],
        ['mkdir', ['last', 1]],
        ['truncate', ['last', 1]],
        ['appendFile', ['last', 1]],
        ['copyFile', ['last', 1]],
        ['symlink', ['last', 1]],
        ['writeFile', ['last', 1]],
        ['fstat', ['last', 2]],
        ['lstat', ['last', 2]],
        ['mkdtemp', ['last', 2]],
        ['open', ['last', 2]],
        ['readdir', ['last', 2]],
        ['readFile', ['last', 2]],
        ['readlink', ['last', 2]],
        ['realpath', ['last', 2]],
        ['stat', ['last', 2]],
        ['write', ['last', 3]],
        ['close', [1, , 1]],
        ['exists', [1, , 1]],
        ['fdatasync', [1, , 1]],
        ['fsync', [1, , 1]],
        ['rmdir', [1, , 1]],
        ['unlink', [1, , 1]],
        ['chmod', [2, , 1]],
        ['fchmod', [2, , 1]],
        ['lchmod', [2, , 1]],
        ['link', [2, , 1]],
        ['rename', [2, , 1]],
        ['chown', [3, , 1]],
        ['fchown', [3, , 1]],
        ['futimes', [3, , 1]],
        ['lchown', [3, , 1]],
        ['utimes', [3, , 1]],
        ['chmod', [5, 1]],
        ['read', [5, 3]]
    ])],
    ['zlib', new Map([
        ['brotliCompress', ['last, 2']],
        ['brotliDecompress', ['last, 2']],
        ['deflate', ['last, 2']],
        ['deflateRaw', ['last, 2']],
        ['gunzip', ['last, 2']],
        ['gzip', ['last, 2']],
        ['inflate', ['last, 2']],
        ['inflateRaw', ['last, 2']],
        ['unzip', ['last, 2']]
    ])],
    ['queueMicrotask', [0, 0]],
    ['stream', new Map([
        ['finished', ['last', 1]],
        ['pipeline', ['last', 1]]
    ])],
]);

const processSetUncaughtExceptionCaptureCallback = new Map([
    ['process', new Map([
        ['setUncaughtExceptionCaptureCallback']
    ])]
]);

const eventsOnceCall = new Map([
    ['events', new Map([
        ['once']
    ])]
]);

const assertRejectOrThrow = new Map([
    ['assert', new Map([
        ['doesNotReject'],
        ['doesNotThrow'],
        ['rejects'],
        ['throws']
    ])]
]);

const detSyncCallNode = new Map([
    ['assert', new Map([
        [''],
        ['AssertionError'],
        ['deepEqual'],
        ['deepStrictEqual'],
        ['equal'],
        ['notDeepEqual'],
        ['notDeepStrictEqual'],
        ['notEqual'],
        ['notStrictEqual'],
        ['ok'],
        ['ifError'],
        ['strictEqual'],
        ['fail'],
        ['strict', new Map([]
            [''],
            ['AssertionError'],
            ['deepEqual'],
            ['equal'],
            ['notDeepEqual'],
            ['notEqual'],
            ['ok'],
            ['ifError'],
            ['fail']
        )]
    ])],
    ['buffer', new Map([
        ['Buffer', new Map([
            ['alloc'],
            ['allocUnsafe'],
            ['allocUnsafeSlow'],
            ['byteLength'],
            ['compare'],
            ['concat'],
            ['from'],
            ['isBuffer'],
            ['isEncoding'],
        ])]
    ])],
    ['console', new Map([
        ['Console'],
        ['assert'],
        ['clear'],
        ['count'],
        ['countReset'],
        ['debug'],
        ['dir'],
        ['dirxml'],
        ['error'],
        ['group'],
        ['groupCollapsed'],
        ['groupEnd'],
        ['info'],
        ['log'],
        ['table'],
        ['time'],
        ['timeEnd'],
        ['timeLog'],
        ['trace'],
        ['warn'],
        ['markTimeline'],
        ['profile'],
        ['profileEnd'],
        ['timeStamp'],
        ['timeline'],
        ['timelineEnd']
    ])],
    ['crypto', new Map([
        ['createCipher'],
        ['createCipheriv'],
        ['createDecipher'],
        ['createDecipheriv'],
        ['createDiffieHellman'],
        ['createECDH'],
        ['createHash'],
        ['createHmac'],
        ['createPrivateKey'],
        ['createPublicKey'],
        ['createSecretKey'],
        ['createSign'],
        ['createVerify'],
        ['generateKeyPairSync'],
        ['getCiphers'],
        ['getCurves'],
        ['getDiffieHellman'],
        ['getFips'],
        ['getHashes'],
        ['pbkdf2Sync'],
        ['privateDecrypt'],
        ['privateEncrypt'],
        ['publicDecrypt'],
        ['publicEncrypt'],
        ['scryptSync'],
        ['setEngine'],
        ['setFips'],
        ['sign'],
        ['timingSafeEqual'],
        ['verify'],
        ['Certificate', new Map([
            ['exportChallenge'],
            ['exportPublicKey'],
            ['verifySpkac']
        ])]
    ])],
    ['dns', new Map([
        ['getServers'],
        ['setServers'],
        ['promises', new Map([
            ['Resolver'],
            ['getServers'],
            ['setServers'],
        ])],
        ['Resolver', new Map([
            ['getServers'],
            ['setServers'],
            ['cancel']
        ])],
    ])],
    ['Error', new Map([
        ['captureStackTrace']
    ])],
    ['fs', new Map([
        ['accessSync'],
        ['appendFileSync'],
        ['chmodSync'],
        ['chownSync'],
        ['closeSync'],
        ['copyFileSync'],
        ['createReadStream'],
        ['createWriteStream'],
        ['existsSync'],
        ['fchmodSync'],
        ['fchownSync'],
        ['fdatasyncSync'],
        ['fstatSync'],
        ['fsyncSync'],
        ['ftruncateSync'],
        ['futimesSync'],
        ['lchmodSync'],
        ['lchownSync'],
        ['linkSync'],
        ['lstatSync'],
        ['mkdirSync'],
        ['mkdtempSync'],
        ['openSync'],
        ['readdirSync'],
        ['readFileSync'],
        ['readlinkSync'],
        ['readSync'],
        ['realpathSync'],
        ['renameSync'],
        ['rmdirSync'],
        ['statSync'],
        ['symlinkSync'],
        ['truncateSync'],
        ['unlinkSync'],
        ['unwatchFile'],
        ['utimesSync'],
        ['watch'],
        ['watchFile'],
        ['writeFileSync'],
        ['writeSync'],
        ['realpathSync', new Map([
            ['native']
        ])]
    ])],
    ['path', new Map([
        ['basename'],
        ['dirname'],
        ['extname'],
        ['format'],
        ['isAbsolute'],
        ['join'],
        ['normalize'],
        ['parse'],
        ['relative'],
        ['resolve'],
        ['toNamespacedPath']

    ])],
    ['process', new Map([
        ['abort'],
        ['emitWarning'],
        ['exit'],
    ])],
    ['querystring', new Map([
        ['decode'],
        ['encode'],
        ['escape'],
        ['parse'],
        ['stringify'],
        ['unescape']
    ])],
    ['readline', new Map([
        ['clearLine'],
        ['clearScreenDown'],
        ['createInterface'],
        ['cursorTo'],
        ['emitKeypressEvents'],
        ['moveCursor']

    ])],
    ['string_decoder', new Map([
        ['end'],
        ['write']
    ])],
    ['url', new Map([
        ['URL', ],
        ['URLSearchParams'],
        ['domainToASCII'],
        ['domainToUnicode'],
        ['fileURLToPath'],
        ['format'],
        ['pathToFileURL'],
        ['parse'],
        ['resolve']
    ])],
    ['util', new Map([
        ['promisify'],
        ['debuglog'],
        ['deprecate'],
        ['format'],
        ['formatWithOptions'],
        ['getSystemErrorName'],
        ['inherits'],
        ['inspect'],
        ['isDeepStrictEqual'],
        ['TextDecoder'],
        ['types', new Map([
            ['isAnyArrayBuffer'],
            ['isArgumentsObject'],
            ['isArrayBuffer'],
            ['isAsyncFunction'],
            ['isBigInt64Array'],
            ['isBigUint64Array'],
            ['isBooleanObject'],
            ['isBoxedPrimitive'],
            ['isDataView'],
            ['isDate'],
            ['isExternal'],
            ['isFloat32Array'],
            ['isFloat64Array'],
            ['isGeneratorFunction'],
            ['isGeneratorObject'],
            ['isInt8Array'],
            ['isInt16Array'],
            ['isInt32Array'],
            ['isMap'],
            ['isMapIterator'],
            ['isModuleNamespaceObject'],
            ['isNativeError'],
            ['isNumberObject'],
            ['isPromise'],
            ['isProxy'],
            ['isRegExp'],
            ['isSet'],
            ['isSetIterator'],
            ['isSharedArrayBuffer'],
            ['isStringObject'],
            ['isSymbolObject'],
            ['isTypedArray'],
            ['isUint8Array'],
            ['isUint8ClampedArray'],
            ['isUint16Array'],
            ['isUint32Array'],
            ['isWeakMap'],
            ['isWeakSet'],
            ['isWebAssemblyCompiledModule']
        ])]
    ])],
    ['v8', new Map([
        ['cachedDataVersionTag'],
        ['getHeapSpaceStatistics'],
        ['getHeapSnapshot'],
        ['getHeapStatistics'],
        ['setFlagsFromString'],
        ['writeHeapSnapshot']
    ])],
    ['vm', new Map([
        ['Script'],
        ['compileFunction'],
        ['createContext'],
        ['isContext'],
        ['runInContext'],
        ['runInNewContext'],
        ['runInThisContext']
    ])],
    ['zlib', new Map([
        ['createBrotliCompress'],
        ['createBrotliDecompress'],
        ['createDeflate'],
        ['createDeflateRaw'],
        ['createGunzip'],
        ['createGzip'],
        ['createInflate'],
        ['createInflateRaw'],
        ['createUnzip'],
        ['brotliCompressSync'],
        ['brotliDecompressSync'],
        ['deflateSync'],
        ['deflateRawSync'],
        ['gunzipSync'],
        ['gzipSync'],
        ['inflateSync'],
        ['inflateRawSync'],
        ['unzipSync']
    ])],
    ['module', new Map([
        ['createRequire'],
        ['createRequireFromPath'],
        ['require', new Map([
            ['resolve', new Map([
                ['paths']
            ])]
        ])]
    ])],
    ['events', new Map([
        ['EventEmitter', new Map([
            ['listenerCount']
        ])]
    ])],
    ['stream', new Map([
        ['Writable'],
        ['Readable'],
        ['Duplex'],
        ['Transform'],
        ['PassThrough']
    ])],
    ['tty', new Map([
        ['WritableStream'],
        ['ReadableStream']
    ])],
]);