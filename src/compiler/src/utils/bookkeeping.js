const t = require('@babel/types');
const _ = require('lodash');
const deepcopy = _.cloneDeep;

module.exports = {
    markVisited,
    alreadyVisited,
    markVisitedParams,
    alreadyVisitedParams,
    markVisitedArgs,
    alreadyVisitedArgs,
    newStateForMaybeCalledInternally,
    newStateWithObjName,
    newStateForInPromise,
    newStateForSuper,
    newStateForLoop,
    copy,
}

function markVisited(path) {
    path.node.visited = true
}

function alreadyVisited(path) {
    return path.node.visited
}

function markVisitedParams(path) {
    path.node.visitedParams = true
}

function alreadyVisitedParams(path) {
    return path.node.visitedParams
}

function markVisitedArgs(path) {
    path.node.visitedArgs = true
}

function alreadyVisitedArgs(path) {
    return path.node.visitedArgs
}

// Create new ops that are the same as the current opts but maybeCalledInternally is set to true
function newStateForMaybeCalledInternally(state, objName) {
    return {
        objName: state.objName,
        resolveFunc: state.resolveFunc,
        ionCoreModules: state.ionCoreModules,
        rejectFunc: state.rejectFunc,
        inPromise: state.inPromise,
        opts: state.opts,
        file: state.file,
        superName: state.superName,
        loopCond: state.loopCond,
        maybeCalledInternally: true
    }
}

// Create new ops that are the same as the current opts but set the objName to the current objName
function newStateWithObjName(state, objName) {
    return {
        objName,
        resolveFunc: state.resolveFunc,
        rejectFunc: state.rejectFunc,
        ionCoreModules: state.ionCoreModules,
        inPromise: state.inPromise,
        opts: state.opts,
        file: state.file,
        superName: state.superName,
        loopCond: state.loopCond,
        maybeCalledInternally: state.maybeCalledInternally
    }
}

// Create new ops that are the same as the current opts but appropriate set the resolveFunc,
// the rejectFunc, and the inPromise.
function newStateForInPromise(state, params) {
    var resolveFunc = params.length > 0 ? params[0].name : undefined
    var rejectFunc = params.length > 1 ? params[1].name : undefined
    var inPromise = true
    return {
        resolveFunc,
        rejectFunc,
        inPromise,
        objName: state.objName,
        opts: state.opts,
        file: state.file,
        superName: state.superName,
        loopCond: state.loopCond,
        ionCoreModules: state.ionCoreModules,
        maybeCalledInternally: state.maybeCalledInternally
    }
}

function newStateForSuper(state, superName) {
    return {
        superName: superName,
        resolveFunc: state.resolveFunc,
        rejectFunc: state.rejectFunc,
        inPromise: state.inPromise,
        opts: state.opts,
        file: state.file,
        objName: state.objName,
        loopCond: state.loopCond,
        maybeCalledInternally: state.maybeCalledInternally
    }
}

function newStateForLoop(state, cond) {
    return {
        superName: state.superName,
        resolveFunc: state.resolveFunc,
        rejectFunc: state.rejectFunc,
        inPromise: state.inPromise,
        opts: state.opts,
        file: state.file,
        objName: state.objName,
        loopCond: cond,
        maybeCalledInternally: state.maybeCalledInternally
    }
}

function copy(o) {
    return deepcopy(o);
}