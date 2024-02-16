"use strict";

const {
    reportCollectionDeactivated
} = require('./general');
const {
    globalHandler
} = require('./commonClasses');
const mode = parseInt(process.env.ADVICE_MODE || 0) //what advice to collect;

// map from request ids to map from the object ids of their generators to the 
// most recent handler that run the generator
var generatorHid = new Map();
generatorHid.set(-1, new Map());

module.exports = {
    initGeneratorHelpers,
    deleteGeneratorHelpers,
    setHandlerIDforObjectID,
    getHandlerIDforObjectID
}

function initGeneratorHelpers(rid) {
    if (mode >= 4) return;
    generatorHid.set(rid, new Map());
}

function deleteGeneratorHelpers(rid) {
    if (mode >= 4) return;
    generatorHid.delete(rid)
}

// sets the handler id of the generator obj
function setHandlerIDforObjectID(rid, hid, obj, assignObjectID) {
    if (mode >= 4) return obj;
    rid = rid.karousos_x ? rid.karousos_x : rid;
    if (reportCollectionDeactivated(rid)) return;
    if (!obj.objID) obj = assignObjectID(obj, rid, hid, true);
    obj.requestID = rid;
    if (obj.objID != undefined) {
        generatorHid.get(rid).set(obj.objID, hid);
    } else {
        generatorHid.get(rid).set(obj, hid);
    }
    return obj;
}

// gets the handler id of the generator obj
function getHandlerIDforObjectID(rid, hid, obj) {
    if (mode >= 4) return globalHandler;
    rid = rid.karousos_x ? rid.karousos_x : rid;
    if (reportCollectionDeactivated(rid)) return;
    if (obj == undefined) {
        return hid;
    }
    if (obj.objID != undefined) {
        var hidInit = generatorHid.get(rid).get(obj.objID);
        return updateHidIfNeeded(rid, hidInit);
    }
    if (generatorHid.get(rid).has(obj)) {
        var hidInit = generatorHid.get(rid).get(obj);
        return updateHidIfNeeded(rid, hidInit);
    }
    return updateHidIfNeeded(rid, hid);
}

function updateHidIfNeeded(rid, hid) {
    if (mode >= 4) return globalHandler;
    var newHid = hid;
    if (generatorHid.get(rid).has(hid)) {
        newHid = generatorHid.get(rid).get(hid);
    }
    return newHid;
}