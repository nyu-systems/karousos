"use strict";

const {
    globalHandler,
    objectID
} = require('./commonClasses');
const {
    reportCollectionDeactivated,
    hasOwnProperty
} = require('./general');
const assert = require('assert');

//Map from rid to map from hid to number of objIDs assigned
var objNums = new Map();
objNums.set(-1, new Map()); //initialize the objectNums of init
objNums.set(-2, new Map()); //initialize the objectNums for when the advice collection is turned off

module.exports = {
    initObjNumForHid,
    initObjNumForRid,
    flushObjNums,
    createObjectID,
}

// Initialize the object nums 
exports.initObjNums = function() {
    objNums = new Map();
    objNums.set(-1, new Map());
    objNums.set(-2, new Map());
}

// Initialize the map for the request id
function initObjNumForRid(rid) {
    objNums.set(rid, new Map());
}

// Set the number of objects that the handler has created to 0
function initObjNumForHid(rid, hid) {
    objNums.get(rid).set(hid, 0);
}

// Detete the data associated with the given request id
function flushObjNums(rid) {
    objNums.delete(rid);
}

// Creates a new object id
function createObjectID(rid, hid, isRead, assignObjectID, parentObject, method) {
    try {
        // if we are creating a an objectID for an objectProperty, the object id is created based on
        // the parent
        if (parentObject != undefined) {
            assert(parentObject != null);
            //if the parent has no objectID assign an object id to the parent
            if (!hasOwnProperty(parentObject, 'objID')) {
                assignObjectID(parentObject, rid, hid, isRead);
            };
            var pObjID = parentObject.objID;
            if (pObjID != undefined) {
                return new objectID(rid, undefined, undefined, pObjID, method)
            }
        }
        // Create a special object id if the report collection is deactivated
        if (reportCollectionDeactivated(rid)) {
            return new objectID(rid, globalHandler, -1);
        }
        // Create a new object id using the current number of objects that the handler has created
        var objectNum = objNums.get(rid).get(hid) || 0;
        var objID = new objectID(rid, hid, objectNum);
        objNums.get(rid).set(hid, objectNum + 1);
        return objID;
    } catch (err) {
        console.log(err)
    }
}