const http = require('http');
const karousos = require(process.env.KAR_HOME + '/src/verifier-lib');
const Measurements = require(process.env.KAR_HOME + '/src/measurements');
const port = 3000;
const assert = require('assert');
const _ = require('lodash');
const shuffle = require('shuffle-array');

// Initialize the measurements module
Measurements.init(true, true);

// Read in the isolation level
let isolationLvl;
switch (process.env.ISOLATION_LEVEL) {
    case "3":
        isolationLvl = karousos.isolationLvl.SERIALIZABILITY;
        break;
    case "2":
        isolationLvl = karousos.isolationLvl.SNAPSHOT_ISOLATION;
        break;
    case "1":
        isolationLvl = karousos.isolationLvl.READ_COMMITTED;
        break;
    case "0":
        isolationLvl = karousos.isolationLvl.READ_UNCOMMITTED;
        break;
    default:
        isolationLvl = karousos.isolationLvl.SERIALIZABILITY;
};

// Whether we want to execute the verifier without batching 
// (the verifier executes requests one by one in the order that the 
// server executed them)
let inOrder = process.env.IN_ORDER || false;

// Initialize the karousos library
karousos.initialize();

let traceFile = process.env.ADVICE_DIR + process.env.TRACE_LOC;
let reportsDir = process.env.ADVICE_DIR + process.env.REPORTS_LOC;
let writeLogFile = process.env.ADVICE_DIR + process.env.WRITELOG_LOC;

async function main() {
    // Read in the advice
    Measurements.readAdviceStarts();
    var {
        cfg,
        order
    } = await karousos.loadReports(traceFile, reportsDir, inOrder);
    Measurements.readAdviceEnds();
    // Run the initialization phase 
    Measurements.initStarts();
    var targetApp = require(process.env.DST_MAIN_CODE);
    Measurements.initEnds();

    //1. Preprocess 
    Measurements.preprocessStarts();
    karousos.preprocess(isolationLvl, writeLogFile);
    Measurements.preprocessEnds();

    //2. ReExec 
    async function run(order) {
        console.log('RUNNINGG');
        var cftIDs = []; // the ids of the control flow groups in order
        var cfgInfos = []; // the parameters of each control flow group 
        if (inOrder) {
            // the control flow groups are the requests themselves 
            cftIDs = order;
            for (let cftID of cftIDs) {
                assert(cfg.has(parseInt(cftID)));
                cfgInfos.push(cfg.get(parseInt(cftID)));
            }
        } else {
            // the control flow groups are the ones in the advice
            for (let [cft, cfgInfo] of cfg) {
                cftIDs.push(cft);
                cfgInfos.push(cfgInfo);
            }
        }
        // send the requests to the application as multivalues
        // comment out this line and uncomment the next one to run groups more
	// out of order
	var order = [...Array(cftIDs.length).keys()];
	if (process.env.DET_ORDER == "0") {
		console.log("Executing groups in random order!");
		order = shuffle(order);
	}
	for (let i of order) {
	    cft = cftIDs[i];
            cfgInfo = cfgInfos[i];
            var url = karousos.createMultivalue(cfgInfo.urls);
            var method = karousos.createMultivalue(cfgInfo.methods);
            var body = karousos.createMultivalue(cfgInfo.bodys, true);
            await sendRequest(cft, cfgInfo, url, body, method);
            karousos.requestEnds(cfgInfo.rids, cft.toString());
        }
        // 3. postprocess 
        setTimeout(() => {
            karousos.end();
            console.log('exiting...');
            process.exit();
        }, 1000);
    }

    setTimeout(run,  5000, order);
}

main();

function sendRequest(cft, cfgInfo, url, body, method) {
    console.log('running', cft, cfgInfo.rids, method, url, body);
    var options = {
        headers: {
            'x-request-id': cft,
            'user-agent': 'Karousos',
            'Content-type': 'application/json'
        },
        method: method,
        timeout: 60050000,
    }
    return new Promise((resolve, reject) => {
        // prints out the responses. TODO: Remove this
        function callback(res) {
            res.on('data', d => {
                console.log('info is', d.toString());
                resolve();
            })
        }
		let req;
		if(typeof url !==typeof "a")  req = http.request((url.karousos_value)[0], options, callback);
		else  req = http.request(url, options, callback);
        req.on('error', (err) => {
            // print out the error
            console.log('err is', err);
            reject(err);
        })
        req.on('timeout', () => {
            // if any of the requests time out print that the request timed out and exit
            console.log('request timed out');
            reject(new Error("request timed out"));
        })
        // keep the socket alive
        req.setSocketKeepAlive(true);
        if (!_.isEmpty(body)) {
            // send the body of the request 
            req.write(JSON.stringify(body));
        }
        req.end();
    })
}
