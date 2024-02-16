"use strict";

const assert = require('assert')
const deepcopy = require('lodash').cloneDeep
const MAX_LENGTH = 12;

class eventID {

    constructor(hid, opnum, eType) {
        if (hid == undefined) {
            console.log('eventID called with hid undefined')
            console.trace()
            process.exit()
        }
        this.hid = turnToHandlerID(hid);
        this.opnum = opnum;
        this.eType = eType.toString();
        this.string = 'eid(' +
            this.hid.toString() +
            ',' +
            this.opnum.toString() +
            ',' +
            this.eType.toString() +
            ')';
    }

    toString() {
        return this.string;
    }
}

class objectID {
    //either creates an objectID = (hid, objNum) or if we want to assign
    //an objectID to a property, it creates an objectID of the form(parentObjID, method)
    constructor(rid, hid, objNum, parentObjID, method) {
        //if we create an objectID for an objectProperty
        if (!isUndefined(parentObjID)) {
            if (isUndefined(method)) {
                console.log("Method cannot be undefined", method)
                console.trace();
                process.exit();
            }
            this.parentObjID = turnToObjectID(parentObjID);
            this.method = method;
            this.isObjectMethod = true;
            this.string = this.parentObjID.string + ',' + this.method.toString();
            this.createdWhenDeactivated = rid == -2 || this.parentObjID.createdWhenDeactivated
            if (parentObjID.requestID == -2) rid = parentObjID.requestID
        } else {
            if (isUndefined(objNum)) {
                throw new Error('objectID constructor called with undefined objectNumber');
            }
            if (isUndefined(hid)) {
                throw new Error('objectID constructor called with undefined handlerID');
            }
            this.hid = turnToHandlerID(hid);
            this.objNum = objNum;
            this.isObjectMethod = false;
            this.string = this.hid.toString() + ',' + this.objNum.toString();
            this.createdWhenDeactivated = rid == -2;
        }
        //Ignore rid inside the verifier. 
        if (rid == -1 || rid == -2 || process.env.IS_VERIFIER != "true") {
            this.requestID = rid;
            this.isGlobalObj = rid == -1;
            this.uniqueID = rid + '-' + this.string;
        }
    }

    isOwnedByObject() {
        return this.parentObjID != undefined
    }

    toString() {
        return this.string;
    }

    getRequestID() {
        return this.requestID;
    }
}

// Handler ids contain the object id and the event id. Also compute a hash that corresponds to the 
// handler
class handlerID {
    constructor(fname, eid) {
        this.fname = turnToObjectID(fname);
        this.eid = turnToEventID(eid);
        if (this.eid) {
            this.hash = hashCode(this.fname.toString().concat(this.eid.toString()))
        } else {
            // Request handlers have special handler ids that only depend on the name of the function
            this.hash = "reqHandler:" + this.fname.toString();
        }
    }

    toString() {
        return this.hash.toString()
    }
}

// The handler for initialization
var globalHandler = new handlerID('global', '');

class TxID {
    constructor(handlerID, num) {
        this.handlerID = turnToHandlerID(handlerID);
        this.num = num;
        this.string = "txId(" + this.handlerID.toString() + "," + this.num.toString() + ")";
    }

    toString() {
        return this.string;
    }
}

class eventType {
    constructor(eventName, success) {
        this.eventName = eventName;
        this.success = success;
    }
}

class register {
    constructor(hid, opnum, handlerName, events, success, forAlreadyEmitted) {
        this.hid = turnToHandlerID(hid).toString();
        this.opnum = opnum;
        this.handlerName = turnToObjectID(handlerName).toString();
        assert(!events || events instanceof Array)
        // convert the events to the appropriate classes. Used by the verifier
        for (let i = 0; i < (events ? events.length : 0); i++) {
            events[i] = turnToEventID(events[i]);
            events[i] = turnToObjectID(events[i]);
            events[i] = turnToHandlerID(events[i]);
            events[i] = turnToError(events[i]);
            events[i] = events[i].toString();
        }
        this.events = events;
        this.success = success;
        this.forAlreadyEmitted = forAlreadyEmitted ? true : false
    }

    toString() {
        return "(Register," + this.hid.toString() + "," + this.opnum.toString() + "," +
            this.handlerName.toString() + "," + this.events.toString() + ")";
    }
}

class unregister {
    constructor(hid, opnum, handlerName, events, success) {
        this.hid = turnToHandlerID(hid).toString();
        this.opnum = opnum;
        this.handlerName = turnToObjectID(handlerName).toString();
        assert(!events || events instanceof Array)
        // convert the events to the appropriate classes. Used by the verifier
        for (let i = 0; i < (events ? events.length : 0); i++) {
            events[i] = turnToEventID(events[i]);
            events[i] = turnToObjectID(events[i]);
            events[i] = turnToHandlerID(events[i]);
            events[i] = turnToError(events[i]);
            events[i] = events[i].toString();
        }
        this.events = events;
        this.success = success;
    }

    toString() {
        return "(Unregister," + this.hid.toString() + "," + this.opnum.toString() + "," +
            this.handlerName.toString() + "," + this.events.toString() + ")";
    }
}

class unregisterAll {
    constructor(hid, opnum, events, success) {
        this.hid = turnToHandlerID(hid).toString();
        this.opnum = opnum;
        assert(!events || events instanceof Array)
        for (let i = 0; i < (events ? events.length : 0); i++) {
            events[i] = turnToEventID(events[i]);
            events[i] = turnToObjectID(events[i]);
            events[i] = turnToHandlerID(events[i]);
            events[i] = turnToError(events[i]);
            events[i] = events[i].toString();
        }
        this.events = events;
        this.success = success;
    }

    toString() {
        return "(UnregisterAll," + this.hid.toString() + "," + this.opnum.toString() + "," +
            this.events.toString() + ")";
    }
}

class emit {
    constructor(hid, opnum, eventType, success) {
        this.hid = turnToHandlerID(hid).toString();
        this.opnum = opnum;
        this.eventType = turnToEventID(eventType);
        this.eventType = turnToObjectID(this.eventType);
        this.eventType = turnToHandlerID(this.eventType);
        this.eventType = turnToError(this.eventType).toString();
        this.success = success;
    }

    toString() {
        if (this.handlers !== undefined) {
            return "(Emit," +
                this.hid.toString() + "," +
                this.opnum.toString() + "," +
                this.eventType.toString() + "," +
                this.success.toString() + "," +
                this.handlers.toString() + ")";
        } else {
            return "(Emit," +
                this.hid.toString() + "," +
                this.opnum.toString() + "," +
                this.eventType.toString() + "," +
                this.success.toString() + ")";
        }
    }
}

class stateOp {
    constructor(optype, opcontents, hid, opnum, key) {
        var forVerifier = process.env.IS_VERIFIER == "true";
        this.optype = optype;
        this.key = key;
        // the opcontents for the verifier are the given opcontents
        if (forVerifier) {
            this.opcontents = opcontents;
        } else if (optype == 'read') {
            // the opcontents for the server are an object containing 
            // the request id, txId, and txNum of the read value
            var contents = opcontents.karousos_x ? opcontents.karousos_x : opcontents;
            if (contents.length == 1) {
                this.opcontents = {
                    'rid': contents[0].ionRequestID,
                    'tid': contents[0].ionTxID.toString(),
                    'txnum': contents[0].ionTxNum
                }
            } else {
                console.log("ERROR: Read from non-existent value!");
                console.trace();
                process.exit();
            }
        } else {
            // if this is the server and this is a write, copy the opcontents
            this.opcontents = deepcopy(opcontents);
        }
        this.hid = turnToHandlerID(hid).toString();
        this.opnum = opnum;
    }

    toString() {
        return '(' + this.optype + ', ' + this.key + ',' + this.opcontents + ')'
    }
}

class nonDetOp {
    constructor(hid, opnum, result) {
        this.hid = hid.toString();
        this.opnum = opnum;
        this.result = result
    }

    toString() {
        return '(' + this.hid.toString() + "," + this.opnum.toString() + "," + this.result + ')'
    }
}

class checkEvents {
    constructor(hid, opnum, eventEmitter, fn, args) {
        this.hid = hid.toString();
        this.opnum = opnum
        this.eventEmitter = turnToObjectID(eventEmitter).toString();
        this.fn = fn
        this.args = args
    }

    toString() {
        return '(' + this.hid.toString() + "," + this.opnum + ':' +
            this.eventEmitter + '.' + this.fn + '(' + this.args.toString() + ')' + ')'
    }
}

// Compute the handler id from the handler name and the details of the event. Used in the verifier
function computeHid(hname, phid, pidx, peType) {
    return hashCode(hname + 'eid(' + phid + ',' + pidx + ',' + peType + ')')
}

// Check if the object id was created when the advice collection was deactivated
function objIDCreatedWhenDeactivated(objID) {
    return objID.createdWhenDeactivated;
}

/******************* Utils ******************/

function turnToHandlerID(obj) {
    if (isUndefined(obj) || (obj instanceof handlerID) || isUndefined(obj.fname) ||
        isUndefined(obj.eid)) {
        return obj;
    }

    return new handlerID(obj.fname, obj.eid)
}

function turnToEventID(obj) {
    if (
        isUndefined(obj) ||
        (obj instanceof eventID) ||
        isUndefined(obj.hid) ||
        isUndefined(obj.opnum) ||
        isUndefined(obj.eType)
    ) {
        return obj;
    }
    return new eventID(obj.hid, obj.opnum, obj.eType);
}

function turnToObjectID(obj) {
    //check if it is already an objectID or it does not have the properties
    if (
        isUndefined(obj) ||
        obj instanceof objectID ||
        (
            (isUndefined(obj.hid) || isUndefined(obj.objNum)) &&
            (isUndefined(obj.parentObjID) || isUndefined(obj.method))
        )
    ) {
        //if so, return the object
        return obj;
    }
    //otherwise return an objID instance
    return new objectID(obj.requestID, obj.hid, obj.objNum, obj.parentObjID, obj.method);
}


function turnToTxID(obj) {
    //check if it is already a txID or it does not have the properties
    if (
        isUndefined(obj) ||
        obj instanceof TxID ||
        isUndefined(obj.handlerID) ||
        isUndefined(obj.num)
    ) {
        //if so, return the object
        return obj;
    }
    //otherwise return an objID instance
    return new TxID(obj.handlerID, obj.num);
}

function turnToError(obj) {
    if (obj instanceof Error) {
        return 'error';
    }
    return obj;
}

// Computes a hash of the input string
var hashCode = function(s) {
    var h = 0,
        l = s.length,
        i = 0;
    if (l > 0)
        while (i < l)
            h = (h << 5) - h + s.charCodeAt(i++) | 0;
    var res = h.toString();
    // Pad the result so that the size of advice does not depend on the size 
    if (res.length > MAX_LENGTH) {
        console.log(res + "longer than MAX_LENGTH. Aborting!")
        process.exit();
    }
    while (res.length < MAX_LENGTH) {
        res = " " + res
    }
    return res;
};

function isUndefined(x) {
    return typeof x === 'undefined' || x == null
}

module.exports = {
    eventID,
    objectID,
    globalHandler,
    handlerID,
    TxID,
    eventType,
    register,
    unregister,
    unregisterAll,
    emit,
    stateOp,
    nonDetOp,
    checkEvents,
    computeHid,
    objIDCreatedWhenDeactivated,
    turnToTxID,
    turnToError,
}