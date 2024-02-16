"use strict";

const {
    Graph
} = require('./graph');
const assert = require('assert');
const {
    commonClasses,
    toEventStr
} = require(process.env.KAR_HOME + '/src/karousos_utils');
const fs = require('fs');
const jsonParse = require('json-cycle').parse;
const {
    isUndefined
} = require('./utils');
var globH = require('./globalHandlers');
const {
    getValueOf
} = require('./wrappers')
const Measurements = require(process.env.KAR_HOME + "/src/measurements");
const {
    isEqual
} = require('lodash');
const record_hl_size = parseInt(process.env.RECORD_HLOG || 0);

// Internal state for consistent ordering verification

var graph = new Graph();
var ridToData = new Map();
var ridToMethod = new Map();
// Map from requests we have seen so far to boolean indicating if we have encountered the request's 
// response
var seenRequests = new Map();
var responseNo = 0; // How many responses we have seen
var committed = new Set(); //set of committed transactions
var lastModification = new Map();
var readMap = new Map(); //Map from write ops to read ops that read from them
var record_statelog_size = parseInt(process.env.ONLY_STATE_LOG || 0);

//The different isolation levels
const isolationLvl = {
    SERIALIZABILITY: 3,
    SNAPSHOT_ISOLATION: 2,
    READ_COMMITTED: 1,
    READ_UNCOMMITTED: 0,
}

module.exports = {
    isolationLvl,
    loadReports,
    preprocess,
}

// Read in the advice and the trace. Initialize internal state 
// Initializes ridToResponse, reports, accessDetector, cfg, cftIDs 
async function loadReports(
    traceFile,
    reportsDir,
    inOrder,
    ridToResponse,
    reports,
    accessDetector,
    cfg,
    cftIDs
) {
    // Initialize state of the module
    graph = new Graph();
    ridToData = new Map();
    ridToMethod = new Map();
    seenRequests = new Map();
    responseNo = 0;
    committed = new Set();
    readMap = new Map();
    // Read the advice and trace. Add real time edges
    var order = loadTraceAndAddRealTimeEdges(traceFile, inOrder, ridToResponse);
    var cfgInfo = await loadReportsFromDir(reportsDir, order, reports, accessDetector, cfg, cftIDs);
    return cfgInfo;
}

// read the trace, 
// and update the graph by adding (rid, 0) and (rid, infty)
// and the real time edges following the algorithm from Orochi
// If the verifier executes all requests in order, it returns the order of 
// the request ids in the trace.
// Checks that the trace is balanced
function loadTraceAndAddRealTimeEdges(traceFile, inOrder, ridToResponse) {
    if (!fs.existsSync(traceFile)) {
        return;
    }
    var data = fs.readFileSync(traceFile, 'utf-8');
    var lines = data.split('\n');
    var frontier = new Set();
    var edgesTo = new Map();
    var order = [];
    var trace_len = lines.length - 1;
    for (let i = 0; i < lines.length; i++) {
        let ln = lines[i].split(',');
        if (ln[0] == 'REQUEST') {
            parseRequestFromTrace(ln[1], ln[2], ln.slice(3).join(','), frontier, edgesTo);
            if (inOrder) {
                order.push(ln[1]);
            }
        } else if (ln[0] == 'RESPONSE') {
            parseResponseFromTrace(ln[1], ln.slice(2).join(','), frontier, ridToResponse, edgesTo);
        }
    }
    checkBalancedTrace(trace_len);
    return order;
}


function parseRequestFromTrace(rid, method, data, frontier, edgesTo) {
    //check that each requestID appears once
    assert(!seenRequests.has(rid));
    //save the requestID as 'seen'
    seenRequests.set(rid, false);
    //save the headers and information on the request
    var dataObj = JSON.parse(data);
    ridToData.set(rid, dataObj);
    ridToMethod.set(rid, method);
    let ridStart = infoToNodeLbl(rid, undefined, 'init');
    // The request start node of the first request in the trace has in-depth zero.
    // The below call will mark this node as a node with in-depth zero the first time 
    // this function is called
    graph.addFirst(ridStart);
    var frontier_copy = [];
    for (let i = 0; i < frontier.length; i++) {
        graph.addEdge(frontier[i], ridStart); //time precedence edges
        frontier_copy[i] = frontier[i];
    }
    edgesTo.set(ridStart, frontier_copy);
}

function parseResponseFromTrace(rid, data, frontier, ridToResponse, edgesTo) {
    //check no duplicate response
    if (!seenRequests.has(rid)) {
        console.log(rid);
        console.log("Error: Response for a non existent request");
        process.exit();
    }
    if (seenRequests.get(rid)) {
        console.log('Error: Found 2 responses for same request');
    }
    //save that we have seen the response
    seenRequests.set(rid, true);
    ridToResponse.set(rid, data);
    responseNo += 1;

    //update the frontier
    let ridStart = infoToNodeLbl(rid, undefined, 'init');
    let ridEnd = infoToNodeLbl(rid, undefined, 'inf');

    for (const r in edgesTo.get(ridStart)) {
        frontier.delete(r)
    }
    frontier.add(ridEnd);
    edgesTo.delete(ridStart)
}

// We have already checked that each request only has one response. 
// The trace is balanced if the length of trace is 2*number of responses in the trace
function checkBalancedTrace(traceLength) {
    assert(responseNo * 2 == traceLength);
}

// Converts rid, hid, idx to a node label. If there is no hid, the hid does not appear in the label
function infoToNodeLbl(rid, hid, idx) {
    return rid + '-' + (hid || "") + "-" + idx
}

//read the reports and the cft groups
//this is given as input a directory with the advice
async function loadReportsFromDir(fname_reqs, order, reports, accessDetector, cfg, cftIDs) {
    if (!fs.existsSync(fname_reqs)) throw new Error('dir does not exist. Cannot read reports');
    // read the variable logs for global objects (marked as -1). 
    // We call variable logs object ols in the implementation. 
    // initialize the concurrent access detector with them
    // Also measure the size of the logs
    seenRequests.set("-1", true);
    if (fs.existsSync(process.env.ADVICE_DIR + process.env.OBJECT_OLS_LOC + "/-1.json")) {
        var contents = "";
        var objectOls = new Map();
        await new Promise((resolve, reject) => {
            const size = fs.statSync(process.env.ADVICE_DIR + process.env.OBJECT_OLS_LOC + "/-1.json").size;
            var readStream = fs.createReadStream(process.env.ADVICE_DIR + process.env.OBJECT_OLS_LOC + "/-1.json", {
                highWaterMark: size,
                encoding: 'utf8'
            });
            readStream.on('data', function(chunk) {
                Measurements.add_to_advice(chunk);
                if (record_statelog_size) {
                    Measurements.add_to_statelog(chunk);
                }
                contents += chunk;
                contents = parseObjectOls(contents, objectOls, false);
            })
            readStream.on('end', () => {
                contents = parseObjectOls(contents, objectOls, true);
                accessDetector.setObjectOls(objectOls);
                resolve()
            })
        })
    }
    // Now read in the handler logs, transaction logs, responseEmittedBy, and opcounts
    var contents = fs.readFileSync(fname_reqs, 'utf8');
    Measurements.add_to_advice(contents);
    if (record_hl_size != 0) {
        Measurements.add_to_hlog(contents);
    }
    // parse the contents of the file as an array [[rid, advice for rid in JSON format]]
    var data_reqs = contents.split("\n").filter(x => x != "").map(x => x.split("//"));
    // HACK: Sort by the request id
    data_reqs.sort((x, y) => parseInt(x[0]) - parseInt(y[0]));
    seenRequests.delete("-2", true);
    // map from the tags that the server assigned to shorter tags that verifier uses for efficiency
    var cftToShortID = new Map();
    // Map from tags (the shorter tags that the verifier uses) to the request ids and inputs
    // of the requests in the group 
    var cfgInfo = new Map();
    //check that number of filenames equals the number of requests in the trace
    assert(data_reqs.length - 1 == responseNo);
    // first detect the control flow groups and give a short id to each of them
    // save the URLs and methods
    var first, second, i = 0; // HACK
    for (var [requestID, contents] of data_reqs) {
        var data = JSON.parse(contents);
        var cft = JSON.stringify(data.cft);
        if (requestID == -1) {
            reports.hls[requestID] = data.hls;
        } else {
            // check that the request appears in the trace
            assert(seenRequests.has(requestID));
            // always give a new cft to the request if we are running in order
            if (!cftToShortID.has(cft) || order.length > 0) {
                cftIDs.push(cft);
                var cftID = cftIDs.length - 1;
                cftToShortID.set(cft, cftID);
            } else {
                var cftID = cftToShortID.get(cft);
            }
            // HACK: keep track of the group in which the first request belongs to
            // and the group that the second request belongs to
            if (i == 0) {
                first = cftID;
            }
            if (i == 1) {
                second = cftID;
            }
            // add the metadata of the request in cfgInfo[cftID]
            var prevCftGroup = (cfgInfo.get(cftID) || {}).rids || [];
            var prevUrls = (cfgInfo.get(cftID) || {}).urls || [];
            var prevMethods = (cfgInfo.get(cftID) || {}).methods || [];
            var prevContents = (cfgInfo.get(cftID) || {}).contents || [];
            var prevPaths = (cfgInfo.get(cftID) || {}).paths || [];
            var prevTitles = (cfgInfo.get(cftID) || {}).titles || [];
            var prevIds = (cfgInfo.get(cftID) || {}).ids || [];
            var prevBodys = (cfgInfo.get(cftID) || {}).bodys || [];
            let body = ridToData.get(requestID).body;
            if (cfgInfo.has(cftID)) {
                // either update the already existing entry for cftID
                let info = cfgInfo.get(cftID);
                info.rids.push(requestID);
                info.methods.push(ridToMethod.get(requestID));
                info.urls.push(ridToData.get(requestID).url);
                info.contents.push(ridToData.get(requestID).content);
                info.paths.push(ridToData.get(requestID).path);
                info.titles.push(ridToData.get(requestID).title);
                info.ids.push(ridToData.get(requestID).id);
                info.bodys.push(body ? body : {});
            } else {
                // or create a new entry
                cfgInfo.set(cftID, {
                    'rids': [requestID],
                    'methods': [ridToMethod.get(requestID)],
                    'urls': [ridToData.get(requestID).url],
                    'contents': [ridToData.get(requestID).content],
                    'paths': [ridToData.get(requestID).path],
                    'titles': [ridToData.get(requestID).title],
                    'ids': [ridToData.get(requestID).id],
                    'bodys': [body ? body : {}]
                })
            }
            // The order so far is sequence of ids. Now make it a sequence of cftIDs
            if (order.length > 0) {
                let idx = order.findIndex(x => x == requestID);
                assert(idx != -1);
                order[idx] = cftID
            }
            // cfg maps control flow tag ids to the ids of the requests that are in the group
            if (cfg.has(cftID)) {
                cfg.get(cftID).push(requestID);
            } else {
                cfg.set(cftID, [requestID])
            }
            reports.hls[requestID] = data.hls;
            reports.txls[requestID] = data.txls;
            reports.opcounts[requestID] = data.opcounts;
            reports.responseEmittedBy[requestID] = data.responseEmittedBy;
            i++;
        }
    }
    // HACK so that the group in which the first request belongs to is always 
    // returned first while iterating through the map
    if (first && second && cfgInfo.get(second).rids.length == 1) {
        //Re-insert second in cfgInfo;
        let tmp = cfgInfo.get(second);
        cfgInfo.delete(second);
        cfgInfo.set(second, tmp);
    }
    seenRequests.delete("-1");
    return {
        cfg: cfgInfo,
        order
    };
}

// Parse the specific format of object ols
function parseObjectOls(contents, objectOls, end) {
    var lines = contents.split("//////");
    if (!end && lines.length == 1) {
        return contents;
    }
    if (!end) {
        contents = lines[lines.length - 1];
        lines = lines.slice(0, -1);
    }
    for (let line of lines) {
        if (line == "") continue;
        var [obj, accesses] = line.split("////");
        var accesses = accesses.split("//");
        if (!objectOls.has(obj)) {
            objectOls.set(obj, new Map());
        }
        for (var i = 0; i < accesses.length; i += 2) {
            var k = accesses[i];
            var v = accesses[i + 1];
            objectOls.get(obj).set(k, jsonParse(v))
        }
    }
    return contents
}

function preprocess(isolationLvl, writeLogFile, reports, OpMap, activatedHandlers, cfg) {
    addProgramAndBoundaryEdges(reports);
    addHandlerRelatedEdges(reports, OpMap, activatedHandlers, cfg);
    addExternalStateEdges(reports, OpMap);
    var adya_graph = new Graph();
    if (writeLogFile != null) processWriteLogAndIsolationLvlVer(
        writeLogFile,
        isolationLvl,
        adya_graph,
        reports
    );
    adya_graph.checkAcyclic();
    console.log('Consistent ordering verification and isolation level verification pass!');
    delete reports.hls;
    return graph;
}

function addProgramAndBoundaryEdges(reports) {
    for (let [rid, _] of seenRequests) {
        var ridStart = infoToNodeLbl(rid, undefined, 'init');
        var ridEnd = infoToNodeLbl(rid, undefined, 'inf');
        for (let hid in reports.opcounts[rid]) {
            var opcount = reports.opcounts[rid][hid];
            var hidStart = infoToNodeLbl(rid, hid, 'init');
            var hidEnd = infoToNodeLbl(rid, hid, 'inf');
            //add edge to request handler from (rid, 0)
            if (hid.startsWith('reqHandler:')) {
                graph.addEdge(ridStart, hidStart);
            }
            //add the intermediate program edges
            if (opcount == 0) {
                graph.addEdge(hidStart, hidEnd);
            } else {
                var prev, thisNode;
                for (let i = 0; i < opcount; i++) {
                    prev = i == 0 ? hidStart : infoToNodeLbl(rid, hid, i - 1);
                    thisNode = infoToNodeLbl(rid, hid, i);
                    graph.addEdge(prev, thisNode);
                }
                graph.addEdge(thisNode, hidEnd);
            }
        }
        //add edge to response node from the last operation of handler prior to the deliver response
        let op = reports.responseEmittedBy[rid];
        let opnum = op.opnum == 0 ? 'init' : op.opnum - 1; //0 indexed logs
        let emittedBy = infoToNodeLbl(rid, op.hid, opnum);
        graph.addEdge(emittedBy, ridEnd);
    }
}

function addHandlerRelatedEdges(reports, OpMap, activatedHandlers, cfg) {
    var emitted = new Map();
    for (let [cft, rids] of cfg) {
        activatedHandlers.set(cft, new Map());
        // the number of handlers that the first request in the group activates
        var num_activated_first = 0;
        OpMap.set(cft, new Map()); // Initialize the OpMap
        for (let rid of rids) {
            // The number of activated handlers for the first request id in the group
            var first = rids[0] == rid;
            // the number of activated handlers of the request. All requests should 
            // activate the same handlers num_activated_first
            var num_activated = 0;
            // That is a registered handler for already emitted events
            // only cares about events that the request has emitted
            var registeredHandlers = new Map();
            // keep all the emitted events. Need to keep this information because some 
            // handlers are registered for events that are already emitted. 
            emitted = new Map();
            // Keep track of the most recent node in the handler logs so that we add 
            // handler precedence edges
            let prevNode = null;
            for (let i = 0; i < reports.hls[rid].length; i++) {
                // parse the operation
                var op = reports.hls[rid][i];
                var t = getType(op);
                op.hid = op.hid.hash || op.hid;
                // Initialize the OpMap
                if (!OpMap.get(cft).has(op.hid.toString())) {
                    if (first) {
                        OpMap.get(cft).set(op.hid.toString(), new Map());
                    } else {
                        throw new Error("Server misbehaved when reporting control flow groups")
                    }
                }
                // Check that the operation is valid
                checkOpIsValid(rid, op, reports);
                // Check if the operation is the first operation in the group.
                // If so initialize op.result and the OpMap
                if (first) {
                    if (op.result) op.result = [op.result];
                    OpMap.get(cft).get(op.hid.toString()).set(op.opnum, op);
                } else {
                    // Otherwise, read the recorded operation from OpMap
                    let op_rec = OpMap.get(cft).get(op.hid.toString()).get(op.opnum);
                    // and update the recorded operation (of the first request, which is the one 
                    // that drives re-execution). 
                    if (op.result) {
                        assert(op_rec.result);
                        op_rec.result.push(op.result);
                    } else {
                        // HACK
                        for (let k of Object.keys(op)) {
                            if (op[k] instanceof Array) {
                                assert(op[k].length == op_rec[k].length);
                                for (let j = 0; j < op[k].length; j++) {
                                    assert(op[k][j] == op_rec[k][j]);
                                }
                            } else {
                                assert(op[k] == op_rec[k]);
                            }
                        }
                    }
                }
                if (t == 1) {
                    // Register operation: Update the registeredHandlers. If we register an event 
                    // from an already emitted operation, mark any activated handlers as activated
                    let tmp = [];
                    for (let evt of op.events) {
                        let evtStr = toEventStr(evt, op.success);
                        tmp.push(evtStr);
                        let prev = registeredHandlers.get(evtStr) || [];
                        registeredHandlers.set(
                            evtStr,
                            prev.concat([op.handlerName.string || op.handlerName])
                        );
                        if (op.forAlreadyEmitted && emitted.has(evtStr)) {
                            let emitOp = emitted.get(evtStr);
                            activateHandlers(
                                cft,
                                rid,
                                first,
                                op.handlerName.string || op.handlerName,
                                emitOp.type,
                                emitOp.info,
                                reports,
                                activatedHandlers
                            );
                            if (first) num_activated_first++;
                            num_activated++;
                        }
                    }
                } else if (t == 2) {
                    // Unregister  operation: update the registered handlers
                    if (op.events instanceof Array) {
                        for (let evt of op.events) {
                            op.handlerName = op.handlerName.string || op.handlerName;
                            let prev = registeredHandlers.get(toEventStr(evt, op.success)) || [];
                            prev.splice(prev.indexOf(op.handlerName));
                            registeredHandlers.set(toEventStr(evt, op.success), prev);
                        }
                    } else {
                        let prev = registeredHandlers.get(toEventStr(op.events, op.success)) || [];
                        registeredHandlers.set(toEventStr(op.events, op.success), prev.splice(prev.indexOf(op.handlerName.string || op.handlerName)));
                    }
                } else if (t == 3) {
                    // Unregister all operation: delete the events from the registered handlers
                    for (let evt of op.events) {
                        registeredHandlers.delete(toEventStr(evt, op.success));
                    }
                } else if (t == 4) {
                    // Emit operation
                    op.eventType = op.eventType.string || op.eventType.hash || op.eventType;
                    var evt = toEventStr(op.eventType, op.success);
                    var evtAny = toEventStr(op.eventType, 'any');
                    //find the invoked handlers from the registered handlers  and the global handlers
                    var invoked = registeredHandlers.get(evt) || [];
                    invoked = invoked.concat(registeredHandlers.get(evtAny) || []);
                    invoked = invoked.concat(
                        globH.inspectActivatedHandlersForEvt(op.eventType, "any") || []
                    );
                    //this is the position and information of the emit event 
                    let info = {
                        'hid': op.hid,
                        'idx': op.opnum,
                        'eType': op.eventType,
                        'string': op.hid.toString() + "," + op.opnum.toString() + "," + op.eventType.toString()
                    };
                    // mark all activated handlers in activated
                    for (let hname of invoked) {
                        activateHandlers(
                            cft,
                            rid,
                            first,
                            hname,
                            op.eventType,
                            info,
                            reports,
                            activatedHandlers
                        );
                        if (first) num_activated_first++;
                        num_activated++;
                    };
                    //add the event to the emitted events
                    emitted.set(evt, {
                        'type': op.eventType,
                        'info': info
                    });
                    emitted.set(evtAny, {
                        'type': op.eventType,
                        'info': info
                    });
                } else if (t == 5) {
                    // CheckEvents operation: We only handle listeners which returns the current 
                    // registered handlers and the global handlers
                    if (op.fn == 'listeners') {
                        let eventName = op.eventEmitter + ':' + +op.args[0];
                        let listeners = registeredHandlers.get(toEventStr(eventName, 'success')) || [];
                        checkEventsRes.set(i, listeners);
                    } else {
                        throw new Error('we do not handle this');
                    }
                }
                //add the handler op precedence edge
                var node = infoToNodeLbl(rid, op.hid, op.opnum);
                if (prevNode != null) {
                    graph.addEdge(prevNode, node);
                }
                prevNode = node;
            }
            // all requests in a group should activate the same number of handlers
            assert(num_activated == num_activated_first)
        }
    }
}

// Checks the fields of the recorded operation and checks what type of operation it is
function getType(op) {
    if (!isUndefined(op.handlerName) && !isUndefined(op.events)) {
        if (!isUndefined(op.forAlreadyEmitted)) {
            return 1; //"register";
        } else {
            return 2 //"unregister";
        }
    } else if (!isUndefined(op.events)) {
        return 3; //"unregisterAll";
    } else if (op.eventType) {
        return 4; //"emit"
    } else if (op.eventEmitter) {
        return 5; //"chcekEvents"
    } else {
        //It must be a nonDetOp
        return 6 //"nondet"
    }
}


function checkOpIsValid(rid, op, reports) {
    assert(reports.opcounts[rid][op.hid.toString()] !== undefined);
    assert(op.opnum < reports.opcounts[rid][op.hid.toString()] && op.opnum >= 0);
}


function activateHandlers(cft, rid, first, hname, eventType, info, reports, activatedHandlers) {
    try {
        // If this is the first request we parse in the group, modify activated handlers
        if (first) {
            var prev = activatedHandlers.get(cft).get(hname) || new Map();
            let prevArray = prev.get(eventType.toString()) || [];
            prevArray.push(info);
            prev.set(eventType.toString(), prevArray);
            activatedHandlers.get(cft).set(hname, prev);
        } else {
            // otherwise, ensure that the activated handler is already in activatedHandlers
            // because all requests in a group should activate the same handlers
            var array = activatedHandlers.get(cft).get(hname).get(eventType.toString());
            var found = false;
            for (let a of array) {
                if (a.string == info.string) {
                    found = true;
                }
            }
            assert(found);
        }
        assert(info.eType != undefined);
        // compute the handler id and add the activation edge
        var hid = commonClasses.computeHid(hname, info.hid, info.idx, info.eType);
        addEdge(rid, info.hid, info.idx, rid, hid, 'init');
    } catch (err) {
        console.log(err);
        process.exit();
    }
}

// Implementation of the pseudocode in the paper
function addExternalStateEdges(reports, OpMap) {
    for (let [rid, _] of seenRequests) {
        let txIds = Object.keys(reports.txls[rid]);
        for (let txId of txIds) {
            var log = reports.txls[rid][txId];
            if (log[log.length - 1].optype == "tx_commit") {
                committed.add(encode_committed(rid, txId));
            }
            var myWrites = new Map();
            var prevNode = null;
            for (let txnum = 0; txnum < log.length; txnum++) {
                //tid is already in json format so make it a string correctly
                var op = log[txnum];
                op.hid = op.hid.hash || op.hid;
                checkOpIsValid(rid, op, reports);
                //add the tx precedence edge
                var node = infoToNodeLbl(rid, op.hid.toString(), op.opnum);
                if (prevNode != null) graph.addEdge(prevNode, node);
                prevNode = node;
                if (op.optype == 'read') {
                    let ridW = getValueOf(op.opcontents.rid);
                    let tidW = getValueOf(op.opcontents.tid);
                    let txnumW = parseInt(getValueOf(op.opcontents.txnum));
                    try {
                        var write = reports.txls[ridW][tidW][txnumW];
                    } catch (err) {
                        console.log(ridW, tidW, op.opcontents.txnum, txnumW, wOpInfo);
                        console.log("Server misbehaved when reporting read");
                        process.exit();
                    }
                    assert(write.optype == 'write' && write.key.karousos_x || write.key == op.key);
                    // add read-from edge
                    addEdge(
                        ridW,
                        write.hid.toString(),
                        write.opnum,
                        rid,
                        op.hid.toString(),
                        op.opnum
                    );
                    //Update the readMap
                    let readMapKey = ridW + "/" + tidW.toString() + "/" + txnumW;
                    let prev = readMap.get(readMapKey) || [];
                    readMap.set(
                        readMapKey,
                        prev.concat([rid + "/" + txId.toString() + "/" + txnum])
                    );
                    //check that the transaction observes its writes
                    if (myWrites.has(op.key)) {
                        let last = myWrites.get(op.key);
                        if (encode_for_myWrites(ridW, tidW, txnumW) != last) {
                            console.log("Error: server does not read its writes");
                            process.exit();
                        }
                    }
                    //update opcontents
                    reports.txls[rid][txId][txnum].opcontents.result = write.opcontents;

                } else if (op.optype == 'write') {
                    // Update myWrites and lastModification if the operation is a write/PUT
                    myWrites.set(op.key, encode_for_myWrites(rid, txId, txnum));
                    if (committed.has(encode_committed(rid, txId))) {
                        lastModification.set(encode_for_last_modification(rid, txId, op.key), txnum);
                    }
                }
            }
        }
    }
}

// Different encodings for keys in maps
function encode_committed(rid, tid) {
    return rid + "/" + tid.toString();
}

function encode_for_last_modification(rid, txId, key) {
    return rid + "/" + commonClasses.turnToTxID(txId).toString() + "/" + (key.karousos_x || key);
}

function encode_for_myWrites(rid, txId, txnum) {
    return rid + "/" + txId + "/" + txnum;
}

function addEdge(rid1, hid1, idx1, rid2, hid2, idx2) {
    let node1 = infoToNodeLbl(rid1, hid1.toString(), idx1);
    let node2 = infoToNodeLbl(rid2, hid2.toString(), idx2);
    graph.addEdge(node1, node2);
}

// Processes the write order (writeLog) and does the isolation level verification
function processWriteLogAndIsolationLvlVer(file, I, adya_graph, reports) {
    //Read the write log and check that it is well formed
    var contents = fs.readFileSync(file);
    Measurements.add_to_advice(contents);
    var wlog = JSON.parse(contents);
    assert(wlog instanceof Array);
    //Rist check that the writeLog's size matches last modification
    assert(wlog.length == lastModification.size);
    var prevNode = null;
    var readFromLastMod = new Map();
    var lastModPerKey = new Map();
    for (let i = 0; i < wlog.length; i++) {
        assert(!isUndefined(wlog[i].rid, wlog[i].txid, wlog[i].txnum));
        let op = reports.txls[wlog[i].rid][wlog[i].txid][wlog[i].txnum];
        // check that each operation in the writelog is a last modification
        let lastModEntry = encode_for_last_modification(wlog[i].rid, wlog[i].txid, op.key);
        if (
            !lastModification.has(lastModEntry) ||
            lastModification.get(lastModEntry) != wlog[i].txnum
        ) {
            console.log("Error: Entry in write log not a last modification");
            process.exit();
        }
        //add write depend edges because they are needed in all isolation lvls
        var thisNode = encode_committed(wlog[i].rid, wlog[i].txid);
        if (lastModPerKey.has(op.key) && lastModPerKey.get(op.key) != thisNode) {
            adya_graph.addEdge(lastModPerKey.get(op.key), thisNode);
        }
        lastModPerKey.set(op.key, thisNode);
        //add anti-depend edges if the isolation level is serializability
        if (I >= isolationLvl.SERIALIZABILITY) {
            if (readFromLastMod.has(op.key)) {
                let reads = readFromLastMod.get(op.key);
                for (let i = 0; i < reads.length; i++) {
                    let [rid, tid] = reads[i].split("/");
                    let readTxLbl = encode_committed(rid, tid);
                    if (committed.has(readTxLbl) && readTxLbl != thisNode) {
                        adya_graph.addEdge(readTxLbl, thisNode);
                    }
                }
            }
        }
        //add read depend edges if the isolation level is greater that read uncommitted
        if (I > isolationLvl.READ_UNCOMMITTED) {
            let readMapKey = wlog[i].rid + "/" + wlog[i].txid + "/" + wlog[i].txnum;
            var reads = readMap.get(readMapKey) || [];
            readFromLastMod.set(op.key, reads);
            for (let i = 0; i < reads.length; i++) {
                var [rid, tid, _] = reads[i].split("/");
                let readTxLbl = encode_committed(rid, tid);
                if (committed.has(readTxLbl) && readTxLbl != thisNode) {
                    adya_graph.addEdge(thisNode, readTxLbl);
                }
            }
        }
    }
    //check phenomena G1a and G1b
    if (I > isolationLvl.READ_UNCOMMITTED) {
        checkAllReadFromLastModification(reports);
    }
    return wlog;
}

//checks for phenomena G1a and G1b
function checkAllReadFromLastModification(reports) {
    seenRequests.forEach((_, rid) => {
        let txIds = Object.keys(reports.txls[rid]);
        for (let txId of txIds) {
            var log = reports.txls[rid][txId];
            for (let txnum = 0; txnum < log.length; txnum++) {
                var op = reports.txls[rid][txId][txnum];
                if (op.optype == 'read') {
                    let ridW = op.opcontents.rid.karousos_x || op.opcontents.rid;
                    let tidW = commonClasses.turnToTxID(op.opcontents.tid.karousos_x || op.opcontents.tid);
                    let txnumW = parseInt(op.opcontents.txnum.karousos_x || op.opcontents.txnum);
                    if (
                        lastModification.get(encode_for_last_modification(ridW, tidW, op.key)) !=
                        txnumW
                    ) {
                        console.log(lastModification, ridW, tidW, op.key);
                        console.log("Error! Not last modification", tidW);
                        process.exit();
                    }
                }
            }
        }
    })
}