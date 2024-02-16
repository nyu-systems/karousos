"use strict";

const assert = require('assert')
const {
    commonClasses,
    builtins,
    reportCollectionDeactivated,
    reportCollectionActivated,
    mapToObject,
    checkObjectsSoftEquality,
} = require(process.env.KAR_HOME + '/src/karousos_utils');
const cc = commonClasses;
const deactivatedLbl = 'DEACTIVATED_LABEL';
const initLbl = "";
const {
    PrimitiveWrapper,
    Multivalue
} = require('./src/wrappers');
const {
    merge,
    mergeWith,
    cloneDeep
} = require('lodash');

class HandlerLabel {
    constructor(rid, hid, lbl, graph) {
        this.lbl = lbl;
        this.opNo = 0;
        this.rid = rid;
        this.hid = hid;
        this.graph = graph;
    }

    computeLabelForChild(eid) {
        var ret = this.lbl + '/' + eid.toString();
        return ret;
    }
}

function findParent(lbl) {
    assert(lbl != undefined && lbl != null);
    if (lbl == "-1:") return null;
    if (lbl == initLbl) return "-1:";
    if (lbl.indexOf("/") == -1) return initLbl;
    return lbl.slice(0, lbl.lastIndexOf("/"));
}

class Log {
    // Initializes a map from the log in advice
    // the map maps each (lbl + opnum) to [read, value, prev_lbl, prev_opnum]
    constructor(log_in_advice) {
        if (!log_in_advice) {
            return;
        }
        this.initialize(log_in_advice)
    }

    // sets the map to the input log
    initialize(log) {
        this.map = log;
    }

    get(lbl, opnum) {
        if (!this.map) return;
        return this.map.get(lbl + "-" + opnum);
    }

    set_internal(lbl, entry) {
        return this.map.set(lbl, entry);
    }

    set(lbl, opnum, isRead, value, prev_lbl, prev_opnum) {
        if (!this.map) this.initialize();
        return this.map.set(lbl + "-" + opnum, [
            isRead,
            value,
            prev_lbl,
            prev_opnum
        ]);
    }

    has(lbl, opnum) {
        if (!this.map) return false;
        var string = lbl + "-" + opnum;
        return this.map.has(string);
    }

    is(lbl, opnum, isRead, value, prev_lbl, prev_opnum) {
        if (!this.map) return false;
        var val = this.map.get(lbl, opnum);
        return val[0] == isRead && val[1] == value && val[2] == prev_lbl && val[3] == prev_opnum;
    }

    size() {
        if (!this.map) return 0;
        return this.map.size;
    }

    getMap() {
        if (!this.map) return;
        return this.map;
    }
}

class ObjectLog {
    // Initialize the object logs from the advice
    constructor(log_from_advice) {
        this.read_observers = [];
        this.write_observers = new Map();
        this.initializer = undefined;
        this.log = new Log(log_from_advice);
        this.obj_dict = new Map(); // map from writes to their values
    }

    // Erase all data in the log
    flush() {
        this.log = undefined;
        this.obj_dict = undefined;
    }

    access(lbl, hid, opnum, isRead, value, doubleValue, rid, needToMerge, isMultivalue) {
        if (isRead) {
            // If the read is recorded or we are operating under naive log, read from the advice
            if ((
                    this.log.has(hid, opnum) ||
                    process.env.OROCHI_JS == "true"
                )) {
                //do not check Client_MySQL2 as there is a promise
                if (value && value.constructor && (value.constructor.name == "Client_MySQL2")) return value

                var [isReadRec, valRec, hidW, opnumW] = this.log.get(hid, opnum);
                // Check that the recorded op is a read and that the dictating write is also
                // recorded
                assert(isReadRec);
                assert(this.log.has(hidW, opnumW));
                var [isReadW, valW, _, _] = this.log.get(hidW, opnumW);
                if (isReadW) return new Error("Server misbehaved: Reading from read");
                this.updateReadObservers(hidW, opnumW, hid, opnum);
                // Return the new object. We always need to merge because we return the recorded
                // value that belongs to no class
                needToMerge.value = true;
                var toReturn;
                if (valW && valW.karousos_x && valW.karousos_x instanceof Array) {
                    //console.log("read: "+rid+" ",valW,value)

                    toReturn = cloneDeep(valW);
                } else if (value instanceof Map) {
                    //console.log("read: "+rid+" ",valW,value)

                    var map = new Map();
                    for (const property in valW) {
                        map.set(property, valW[property])
                    }
                    toReturn = map
                } else {
                    toReturn = value instanceof Function ? value : valW;
                }
                return toReturn;
            }
            // If this is the initialization or when the advice collection is
            // deactivated, return the current value
            if (rid == -1 || lbl == deactivatedLbl) {
                return value;
            }
            // Find the dictatind write by climbing up the handler tree
            // HACK: Only clone Arrays. We also need to clone objects probably
            var dictating = lbl;
            var i = 0;
            while (dictating != null) {
                if (this.obj_dict.has(dictating)) {
                    var entry = this.obj_dict.get(dictating);
                    this.updateReadObservers(dictating, entry.opnum, lbl, opnum);
                    if (
                        entry.isMultivalue ||
                        (entry.karousos_value instanceof Array)
                    ) return cloneDeep(entry.karousos_value);
                    if (
                        entry.karousos_x && entry.karousos_x instanceof Array
                    ) {
                        return cloneDeep(entry.karousos_x);
                    }
                    return entry.value;

                }
                dictating = findParent(dictating);
            }
            needToMerge.return_init = true;
            return value;
        }
        //if we reached here it is a write
        if ((
                this.log.has(hid, opnum) ||
                process.env.OROCHI_JS == "true"
            )) {
            // If the write is already recorded in the log, check that
            // the recorded value
            var [isReadRec, valRec, hidRec, opnumRec] = this.log.get(hid, opnum);
            if (isReadRec) return new Err("Server recorded a read instead of write");
            // Check that the recorded value and the value produced at the verifier are the same
            try {
                //do not check promise-based objecct
                if (!(
                        (
                            value &&
                            value.constructor &&
                            (value.constructor.name == "Client_MySQL2")
                        )
                    )) {
                    assert(equals(valRec, value));
                }
            } catch (err) {
                console.log("ERROR HERE", err)
                console.log("values", valRec);
                console.log("-------------------", value)
                console.log("lbl and opnum are", lbl, opnum, hidRec, opnumRec);
                console.log("equals returned", equals(valRec, value, undefined, true));
                console.trace();
                process.exit();
            }
            this.updateWriteObservers(hidRec, opnumRec, hid, opnum);
        } else {
            // The write is not recorded. Need to update write observers.
            // Find the dictating write by climbing up the handler tree
            var current = lbl;
            var i = 0;
            var opnum_this = opnum;
            while (current != null) {
                if (this.obj_dict.has(current)) {
                    let {
                        v,
                        opnum
                    } = this.obj_dict.get(current);
                    this.updateWriteObservers(current, opnum, lbl, opnum_this);
                    break;
                }
                current = findParent(current);
            }
            opnum = opnum_this;
            // If there is no parent that wrote the object, this is the initializer
            if (current == null) {
                assert(!this.initializer);
                this.initializer = current;
            }
        }
        // Update the obj_dict
        this.obj_dict.set(lbl, {
            'value': convertValue(value, isMultivalue),
            'opnum': opnum,
            'isMultivalue': isMultivalue
        });
        return value;
    }

    updateReadObservers(hidW, opnumW, hidR, opnumR) {
        // Do not update the read observers if the read is from init
        // or the write was issued while the report collection was deactivated
        if (hidR == initLbl || hidR == deactivatedLbl || hidW == deactivatedLbl) return;
        var write_lbl = hidW + '?' + opnumW;
        var read_lbl = hidR + '?' + opnumR;
        assert(write_lbl != read_lbl)
        this.read_observers.push(write_lbl + ';' + read_lbl);
    }

    updateWriteObservers(hidPrev, opnumPrev, hidCur, opnumCur) {
        // Do not update the write observers if the new write is from init
        // or the dict write was issued while the report collection was deactivated
        if (hidCur == initLbl || hidCur == deactivatedLbl || hidPrev == deactivatedLbl) return;
        var prev_lbl = hidPrev + '?' + opnumPrev;
        var cur_lbl = hidCur + '?' + opnumCur;
        try {
            assert(!this.write_observers.has(prev_lbl));
        } catch (err) {
            console.log("Each write should only be overwritten once", prev_lbl, cur_lbl);
            console.log(err);
            process.exit();
        }
        this.write_observers.set(prev_lbl, cur_lbl);
    }
}

class ConcurrentAccessDetector {
    // Initialize the detector with the graph at the end of preprocess. We will add edges to it
    constructor(graph) {
        this.hidToLbl = new Map();
        this.objects = new Map(); // map from object ids to their logs
        this.graph = graph; //the graph from consistent ordering verification.
        this.lblToHid = new Map();
    }

    setGraph(graph) {
        this.graph = graph;
    }

    setObjectOls(objectOls) {
        for (let [objID, ol] of objectOls) {
            assert(!this.objects.has(objID));
            this.objects.set(objID, new ObjectLog(ol));
        }
    }

    newRid(rid) {
        assert(!this.hidToLbl.has(rid));
        this.hidToLbl.set(rid, new Map());
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
            var newHandlerLbl = new HandlerLabel(rid, hid, lbl_str, this.graph);
            this.hidToLbl.get(rid).set(hid.toString(), newHandlerLbl);
        } catch (err) {
            console.log(err);
            process.exit();
        }
    }

    accessObject(
        cftID,
        rid,
        hid,
        opnum,
        objID,
        value,
        isRead,
        doubleValue,
        index,
        needToMerge,
        isMultivalue
    ) {
        var lbl;
        var objIDStr = objIDtoString(rid, objID);
        // Return the current value if the object was created when the report collection was
        // deactivated
        if (cc.objIDCreatedWhenDeactivated(objID)) return value;
        // If the report collection is deactivated, read from the logs if the object
        // is already in objects. otherwise return the current value
        if (reportCollectionDeactivated(rid)) {
            if (this.objects.has(objIDStr)) {
                value = this.objects.get(objIDStr).access(
                    deactivatedLbl,
                    rid + ":" + hid.toString(),
                    -1,
                    isRead,
                    value,
                    doubleValue,
                    rid,
                    needToMerge,
                    isMultivalue,
                    index
                );
            }
            return value;
        }
        // Otherwise, put the object id in objects if it is not there already
        // and consult the logs and obj_dict
        assert(this.hidToLbl.has(cftID) && this.hidToLbl.get(cftID).has(hid.hash.toString()));
        if (!this.objects.has(objIDStr)) {
            this.objects.set(objIDStr, new ObjectLog());
        }
        var thisHidLbl = this.hidToLbl.get(cftID).get(hid.hash.toString());
        var thisHidLbl = rid.toString() + ":" + thisHidLbl.lbl;
        value = this.objects.get(objIDStr).access(
            thisHidLbl,
            rid + ":" + hid.toString(),
            opnum,
            isRead,
            value,
            doubleValue,
            rid,
            needToMerge,
            isMultivalue
        );
        return value;
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
    // adds ww, wr, rw edges
    addEdgesToGraph() {
        // iterate over all objects and their read observers and write observers
        this.objects.forEach((objectAccess, obj) => {
            objectAccess.flush();
            var readObservers = objectAccess.read_observers;
            var writeObservers = objectAccess.write_observers;
            //add wr edges
            readObservers.forEach(entry => {
                var [write, read] = entry.split(';');
                var writeObj = strToObj(write);
                var [rid, ...rest] = writeObj.lbl.split(":");
                var writeLbl = rest.join(":");
                var writeInfo;
                if (this.lblToHid.has(writeLbl)) {
                    writeInfo = {
                        rid,
                        hid: this.lblToHid.get(writeLbl)
                    };
                } else {
                    writeInfo = {
                        rid,
                        hid: writeLbl
                    };
                };
                var writeNode = infoToNodeLbl(
                    writeInfo.rid,
                    writeInfo.hid,
                    writeObj.opnum
                );
                var readObj = strToObj(read);
                var [rid, ...rest2] = readObj.lbl.split(":");
                var readLbl = rest2.join(":");
                var readInfo;
                if (this.lblToHid.has(readLbl)) {
                    readInfo = {
                        rid,
                        hid: this.lblToHid.get(readLbl)
                    };
                } else {
                    readInfo = {
                        rid,
                        hid: readLbl
                    };
                };
                var readNode = infoToNodeLbl(
                    readInfo.rid,
                    readInfo.hid,
                    readObj.opnum
                )
                //if the read happens between different handlers add an edge
                if (readInfo.rid != writeInfo.rid || readInfo.hid != writeInfo.hid) {
                    this.graph.addEdge(writeNode, readNode);
                } else {
                    //otherwise make sure that the we are reading from a previous value
                    assert(readObj.opnum > writeObj.opnum);
                }
                //add the anti-depend edge
                var next_write = writeObservers.get(write);
                if (!next_write) return;
                var nextWriteObj = strToObj(next_write);
                var [rid, nextWriteLbl] = nextWriteObj.lbl.split(":");
                var nextWriteInfo;
                if (this.lblToHid.has(nextWriteLbl)) {
                    nextWriteInfo = {
                        rid,
                        hid: this.lblToHid.get(nextWriteLbl)
                    };
                } else {
                    nextWriteInfo = {
                        rid,
                        hid: nextWriteLbl
                    };
                };
                var nextWriteNode = infoToNodeLbl(
                    nextWriteInfo.rid,
                    nextWriteInfo.hid,
                    nextWriteObj.opnum
                );
                var readEnd = infoToNodeLbl(
                    readInfo.rid,
                    readInfo.hid,
                    readObj.opnum
                );
                if (nextWriteInfo.rid != -1) {
                    if (readInfo.rid != nextWriteInfo.rid || readInfo.hid != nextWriteInfo.hid) {
                        this.graph.addEdge(readEnd, nextWriteNode);
                    } else {
                        assert(nextWriteObj.opnum > readObj.opnum);
                    }
                }
            })
            writeObservers.forEach((thisWrite, prevWrite) => {
                //add w-w edges
                var thisWriteObj = strToObj(thisWrite);
                var prevWriteObj = strToObj(prevWrite);
                var thisWriteLbl = thisWriteObj.lbl;
                var prevWriteLbl = prevWriteObj.lbl;
                var thisWriteInfo;
                if (this.lblToHid.has(thisWriteLbl)) {
                    thisWriteInfo = this.lblToHid.get(thisWriteLbl);
                } else {
                    let inf = thisWriteLbl.split(":");
                    thisWriteInfo = {
                        rid: inf[0],
                        hid: inf.slice(1).reduce((acc, curr) => acc + curr, "")
                    };
                };
                var prevWriteInfo;
                if (this.lblToHid.has(prevWriteLbl)) {
                    prevWriteInfo = this.lblToHid.get(prevWriteLbl);
                } else {
                    let inf = prevWriteLbl.split(":");
                    prevWriteInfo = {
                        rid: inf[0],
                        hid: inf.slice(1).reduce((acc, curr) => acc + curr, "")
                    };
                };
                var thisWriteNode = infoToNodeLbl(
                    thisWriteInfo.rid,
                    thisWriteInfo.hid,
                    thisWriteObj.opnum
                );
                var prevWriteNode = infoToNodeLbl(
                    prevWriteInfo.rid,
                    prevWriteInfo.hid,
                    prevWriteObj.opnum
                );
                if (prevWriteInfo.rid != -1) {
                    if (thisWriteInfo.rid != prevWriteInfo.rid || thisWriteInfo.hid != prevWriteInfo.hid) {
                        this.graph.addEdge(prevWriteNode, thisWriteNode);
                    } else {
                        assert(thisWriteObj.opnum > prevWriteObj.opnum);
                    }
                }
            })
        })
    }
}

exports.ConcurrentAccessDetector = ConcurrentAccessDetector;

function strToObj(info) {
    var entries = info.split("?");
    return {
        'lbl': entries[0],
        'opnum': parseInt(entries[1])
    }
}

function objIDtoString(rid, objID) {
    if (builtins.isOfType(objID, String, 'string')) return objID;
    return objID.uniqueID || (rid + "-" + objID.string);
}

function infoToNodeLbl(rid, hid, idx) {
    return rid + '-' + hid + "-" + idx
}

function equals(obj1, obj2, previous) {
    var obj_comp1 = mapToObject(obj1 && obj1.karousos_x ? obj1.karousos_x : obj1);
    var obj_comp2 = mapToObject(obj2 && obj2.karousos_x ? obj2.karousos_x : obj2);
    if (obj_comp1 == obj_comp2 || obj_comp2 instanceof Function || obj_comp1 instanceof Function) {
        return true;
    }
    if (previous == undefined) {
        previous = [];
    }
    if (obj_comp1 instanceof Object && obj_comp2 instanceof Object) {
        var [obj_to_iter, obj_to_check] = obj_comp1 != undefined && Object.keys(obj_comp1).length > Object.keys(obj_comp2).length ? [obj_comp1, obj_comp2] : [obj_comp2, obj_comp1];
        if (obj_to_check != undefined && obj_to_check != null && !Object.keys(obj_to_check).every(val => {
                let ret = Object.keys(obj_to_iter).indexOf(val) != -1 || obj_to_check[val] instanceof Function || val == "whereIs";
                return ret;
            })) {
            return false;
        }
        for (let property of Object.keys(obj_to_iter)) {
            if (previous.indexOf(obj_to_iter[property]) == -1 && !equals(obj_to_iter[property], obj_to_check[property], previous.concat(obj_to_iter)) && property != "whereIs") {
                return false;
            }
        }
        return true;
    }
    if (Object.keys(obj_comp1).length == 0 && Object.keys(obj_comp2).length == 0) {
        return true
    }
    return false;
}

// Convert the value in order to recorded. This is incomplete and special cased
function convertValue(value, isMultivalue) {
    if (!(value instanceof PrimitiveWrapper)) {
        if (isMultivalue || value instanceof Array) {
            return cloneDeep(value);
        }
        return value;
    }
    if (
        value instanceof PrimitiveWrapper &&
        value.karousos_x instanceof Array &&
        value.karousos_x[0] &&
        value.karousos_x[0].isMultivalue
    ) {
        return cloneDeep(value);
    }
    let value2 = new PrimitiveWrapper(value.karousos_x);
    Object.defineProperty(value2, 'objID', {
        value: value.objID,
        enumerable: false,
        configurable: true,
        writable: true
    })
    return value2;
}