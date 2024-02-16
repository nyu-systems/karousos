"use strict";

const assert = require('assert')
const {
    builtins,
    commonClasses,
    reportCollectionDeactivated,
    reportCollectionActivated,
    mapToObject,
} = require(process.env.KAR_HOME + '/src/karousos_utils');
const cc = commonClasses;
const deactivatedLbl = 'DEACTIVATED_LABEL';
const {
    PrimitiveWrapper,
    getValueOf
} = require('./src/wrappers')
const jsonStringify = require('json-cycle').stringify;
const fs = require('fs');
const {
    cloneDeep
} = require('lodash');
// Map from request ids to the map from the ids of the objects they modify to the modifications
// We flush these to disk at the end of each request
const {
    performance,
    PerformanceObserver
} = require('perf_hooks');

Error.stackTraceLimit = Infinity;

class HandlerLabel {
    constructor(lbl) {
        this.lbl = lbl;
    }

    computeLabelForChild(eid) {
        var ret = this.lbl + '/' + eid.toString();
        return ret;
    }

}

class Log {
    // contains a map from (hid + opnum) to [read, value, prev_hid, prev_opnum]
    constructor() {
        this.map = new Map();
    }

    get(hid, opnum) {
        return this.map.get(hid + "-" + opnum);
    }

    // detele an entry from the log
    del(hid, opnum) {
        this.map.delete(hid + "-" + opnum);
    }

    // delete all entries from the log
    clear() {
        this.map.clear();
    }

    set(hid, opnum, isRead, value, prev_hid, prev_opnum) {
        return this.map.set(
            hid + "-" + opnum,
            jsonStringify(mapToObject([isRead, mapToObject(value), prev_hid, prev_opnum]))
        );
    }

    has(hid, opnum) {
        return this.map.has(hid + "-" + opnum);
    }

    is(hid, opnum, isRead, value, prev_hid, prev_opnum) {
        var val = this.map.get(hid + "-" + opnum);
        return val[0] == isRead && val[1] == value && val[2] == prev_hid && val[3] == prev_opnum;
    }

    size() {
        return this.map.size;
    }

    getMap() {
        return this.map;
    }
}

class ObjectLog {
    // We keep the following information for each object:
    // The most recent lbl and hid that modify the object, the opnum of the latest operation
    // that modifies the object, the most recent value, whether it is a global object,
    // and the string that corresponds to the object id
    constructor(lbl, hid, opnum, value, isGlobalObj, objIDStr) {
        this.lbl = lbl;
        this.hid = hid.toString();
        this.opnum = opnum;
        this.last_write = value;
        this.parent_lbl = null;
        this.parent_hid = null;
        this.parent_opnum = null;
        this.isGlobalObj = isGlobalObj;
        this.objIDStr = objIDStr;
    }

    // Initialize an empty log
    initialize_log() {
        this.log = new Log();
    }

    recordAccess(lbl, hid, opnum, isRead, value, doubleValue, rid, isOrochiJs, writesToGlobalObjects) {
        // If we are operating under K_naive_batch, then all accesses are logged/considered
        // r-concurrent
        if (isOrochiJs ||
            rConcurrent(this.lbl, lbl)
        ) {
            let t0 = performance.now();
            if (!this.log) this.initialize_log();
            // Log the previous access if it is not already logged
            if (!(this.log.has(this.hid, this.opnum))) {
                this.log.set(
                    this.hid,
                    this.opnum, false,
                    this.last_write,
                    this.parent_hid,
                    this.parent_opnum
                );
            }
            // the value is empty if the access is a read
            var newVal = isRead ? "" : value;
            if (this.isGlobalObj) {
                // If this is an access to a global object, initialize the writesToGlobalObjects
                if (!writesToGlobalObjects.get(rid).has(this.objIDStr)) {
                    writesToGlobalObjects.get(rid).set(this.objIDStr, new Map());
                }
                // If it is a read on a global obj, always flush it to memory and don't
                // update any other memory
                if (isRead) {
                    writesToGlobalObjects.get(rid).get(this.objIDStr).set(
                        hid.toString() + "-" + opnum,
                        jsonStringify(mapToObject([isRead, mapToObject(newVal), this.hid, this.opnum]))
                    );
                } else {
                    // Update the internal log and flush the previous write into
                    // writesToGlobalObjects. No one will read from it again
                    this.log.set(hid, opnum, isRead, newVal, this.hid, this.opnum);
                    let prev_entry = this.log.get(this.hid, this.opnum);
                    writesToGlobalObjects.get(rid).get(this.objIDStr).set(
                        this.hid + "-" + this.opnum,
                        prev_entry
                    );
                    this.log.del(this.hid, this.opnum);
                }
            } else {
                // record the new access in the log
                this.log.set(hid, opnum, isRead, newVal, this.hid, this.opnum);
            }

            let t1 = performance.now()
        }

        // If it is not a read we need to update the last writer and the last value written
        if (!isRead) {
            this.parent_lbl = this.lbl;
            this.parent_hid = this.hid;
            this.parent_opnum = this.opnum;
            this.lbl = lbl;
            this.hid = hid;
            this.opnum = opnum;
            this.last_write = value;
        }
    }
}

// This module checks for r-concurrent accesses to objects and records them
class ConcurrentAccessDetector {
    constructor(isOrochiJs) {
        this.hidToLbl = new Map(); // maps each handler id to the handler label
        this.objects = new Map(); // all objects that have been modified
        this.objectsByRid = new Map(); // The object ids that each request creates
        this.isOrochiJs = isOrochiJs;
        if (isOrochiJs) {
            this.globalObjOls_fname = process.env.ADVICE_DIR_OROCHI_JS + process.env.OBJECT_OLS_LOC + "/-1.json";
            this.folder = process.env.ADVICE_DIR_OROCHI_JS + process.env.OBJECT_OLS_LOC;
        } else {
            this.globalObjOls_fname = process.env.ADVICE_DIR + process.env.OBJECT_OLS_LOC + "/-1.json";
            this.folder = process.env.ADVICE_DIR + process.env.OBJECT_OLS_LOC;
        }
        this.writesToGlobalObjects = new Map();
    }

    newRid(rid) {
        assert(!this.hidToLbl.has(rid));
        this.hidToLbl.set(rid, new Map());
        this.writesToGlobalObjects.set(rid, new Map())
    }

    eraseRid(rid) {
        this.hidToLbl.delete(rid);
    }

    // Called when a new handler starts running
    //compute and save the label that corresponds to this handler
    newHandlerID(rid, hid, parentHid) {
        try {
            // do
            if (reportCollectionDeactivated(rid)) {
                return;
            }
            var lbl_str;
            if (!reportCollectionActivated(rid)) {
                lbl_str = ''; // Default label for init
            } else if (parentHid != undefined) {
                // Compute the label of the new handler from the label of the parent
                let parentLbl = this.hidToLbl.get(rid).get(parentHid.toString());
                assert(parentHid != undefined);
                lbl_str = parentLbl.computeLabelForChild(hid.eid);
            } else {
                // Custom label for request handlers
                lbl_str = rid + ":" + hid.toString();
            }
            var newHandlerLbl = new HandlerLabel(lbl_str);
            this.hidToLbl.get(rid).set(hid.toString(), newHandlerLbl);
        } catch (err) {
            console.log(err);
            process.exit();
        }
    }

    accessObject(rid, hid, opnum, objID, value, isRead, doubleValue) {
        if (
            !(objID instanceof String) &&
            (typeof objID != "string") &&
            objID.requestID != -1 &&
            objID.requestID != -2 &&
            objID.requestID != rid &&
            rid != -2
        ) {
            console.log("Accessing an object that belongs to another request", objID, rid);
            console.trace();
            process.exit();
        }
        try {
            // We do not keep any logs for objects created when the advice collection is deactivated
            if (objID.createdWhenDeactivated) return;
            var objIDStr = objIDtoString(objID);
            // If the report collection is deactivated, only record the access if the object
            // already has a log
            if (reportCollectionDeactivated(rid)) {
                if (this.objects.has(objIDStr)) {
                    this.objects.get(objIDStr).recordAccess(
                        deactivatedLbl,
                        rid + ":" + hid.toString(),
                        -1,
                        isRead,
                        value,
                        doubleValue,
                        rid,
                        this.isOrochiJs,
                        this.writesToGlobalObjects
                    );
                }
                return;
            }
            // Otherwise, initialize the log and record the access
            var thisHidLbl = this.hidToLbl.get(rid).get(hid.toString());
            assert(this.hidToLbl.has(rid) && this.hidToLbl.get(rid).has(hid.toString()));
            if (!this.objects.has(objIDStr)) {
                this.objects.set(
                    objIDStr,
                    new ObjectLog(undefined, "", undefined, undefined, objID.isGlobalObj, objIDStr)
                );
                // Mark the object as created by the request id
                if (!this.objectsByRid.has(rid)) {
                    this.objectsByRid.set(rid, new Set([objIDStr]));
                } else {
                    this.objectsByRid.get(rid).add(objIDStr);
                }
            }
            this.objects.get(objIDStr).recordAccess(
                thisHidLbl.lbl,
                rid + ":" + hid.toString(),
                opnum,
                isRead,
                value,
                doubleValue,
                rid,
                this.isOrochiJs,
                this.writesToGlobalObjects
            );
        } catch (err) {
            console.log(objID, objIDStr);
            console.log(err);
            process.exit();
        }
    }

    // adds a reference from a new obj to an already existing object
    addReference(rid, hid, objOld, objIDnew, isRead) {
        try {
            if (
                builtins.isOfType(objOld, Function, 'function') ||
                builtins.isPrimitiveType(objOld) ||
                objOld instanceof PrimitiveWrapper
            ) {
                //new object was copied from old one by value not by reference
                this.accessObject(rid, hid, objIDnew, objOld, !!isRead, false);
                return;
            }
            var objIDold = objOld.objID;
            // If either of the objects was created while advice collection was deactivated,
            // exit
            if (objIDnew.createdWhenDeactivated) return;
            if (objIDold.createdWhenDeactivated) return;
            var objIDStrOld = objIDtoString(objIDold);
            var objIDStrNew = objIDtoString(objIDnew);
            // If this is the same object, return
            if (objIDStrOld == objIDStrNew) {
                return;
            }
            // If we have not recorded the prior object, it must be because it was created while
            // the advice collection was deactivated. Make sure that this is indeed the case
            if (!this.objects.has(objIDStrOld)) {
                var objIDStrDeactivated = "-2:" + objIDold.toString();
                assert(this.objects.has(objIDStrDeactivated));
            }
            // Make the new object id point to the ObjectLog of the previous object
            this.objects.set(objIDStrNew, this.objects.get(objIDStrOld));
            // Add this object, to ones that belong to the request id
            if (!this.objectsByRid.has(rid)) {
                this.objectsByRid.set(rid, new Set([objIDStr]));
            } else {
                this.objectsByRid.get(rid).add(objIDStrNew);
            }
        } catch (err) {
            console.log(err);
            process.exit();

        }
    }

    // Save the variable logs for the specidied requests
    saveObjectOls(requestID) {
        var ridObj = this.objectsByRid.get(requestID)
        var fname = this.folder + "/" + requestID + ".json";
        var firstObj = true;
        var line = "";
        // Save all variable logs for objects that the request has created
        // and delete them
        if (ridObj) {
            for (let objStr of ridObj) {
                var objAccess = this.objects.get(objStr);
                if (objAccess.log && objAccess.log.size() > 0) {
                    line += objStr + "////";
                    var first = true;
                    for (let [k, v] of objAccess.log.getMap()) {
                        if (!first) {
                            line += "//";
                        } else {
                            first = false;
                        }
                        line += k + "//" + v;
                    }
                    line += "//////"
                }
                this.objects.delete(objStr);
            }
        }
        // Save all accesses to global variables that the request did
        // and flush these accesses from memory
        if (line != "") fs.appendFileSync(fname, line);
        if (this.writesToGlobalObjects.has(requestID)) {
            line = "";
            for (let [objStr, accesses] of this.writesToGlobalObjects.get(requestID)) {
                if (accesses.size > 0) {
                    line += objStr + "////";
                    var first = true;
                    for (let [k, v] of accesses) {
                        if (!first) {
                            line += "//";
                        } else {
                            first = false;
                        }
                        line += k + "//" + v;
                    }
                    line += "//////"
                }
            }
            if (line != "") fs.appendFileSync(this.globalObjOls_fname, line);
        }
        this.writesToGlobalObjects.delete(requestID);
    }

    // Get the logs as a map
    getLogs() {
        var advice = new Map();
        this.objects.forEach((info, objID) => {
            if (info.log && info.log.size() > 0) {
                advice.set(objID, info.log.getMap());
            }
        })
        return advice;
    }
}

exports.ConcurrentAccessDetector = ConcurrentAccessDetector;

// Returns the globally unique id of the object.
function objIDtoString(objID) {
    if (builtins.isOfType(objID, String, 'string')) return objID;
    return objID.uniqueID;
}


// Checks if two labels are rconcurrent by checking if one is a prefix of the other
function rConcurrent(lbl1, lbl2) {
    try {
        if (lbl1 == deactivatedLbl || lbl2 == deactivatedLbl || lbl1 == null) {
            return false;
        }

        //log the first access
        if (lbl1 == "") {
            return true;
        }
        assert(lbl1 == lbl2 || !(lbl1.startsWith(lbl2)));

        return !(lbl2.startsWith(lbl1));

    } catch (err) {
        console.log('lbl2 is a prefix of lbl1. This is weird because online exec follows activation')
        console.log('lbl2', lbl2);
        console.trace();
        return false;
    }
}