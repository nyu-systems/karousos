const fs = require('fs');
const newLine = '\r\n';
const assert = require('assert');
const {performance, PerformanceObserver} = require('perf_hooks');
const util = require('util')
const debug = util.debuglog('performance');
const {Buffer} = require('buffer');

module.exports = {
	// Initialize the measurements module 
	init(writeMeasurements = true){
		this.writeMeasurements = writeMeasurements;
		// number of requests that are currently active. Used to measure active-time
		this.active_reqs = 0;
		// requests to ignore and requests per thread
		this.ignore_reqs = parseInt(process.env.IGNORE_REQS) || 0; 
		this.reqs_per_thread = parseInt(process.env.TOT_REQS) || 0
		// advice size and size of individual parts of the advice
		this.advice_size = 0;
		this.statelog_size = 0;
		this.hlog_size = 0;
		// Write down the measurements to the appropriate files
		this.obs = new PerformanceObserver((items) => {
  			items.getEntries().forEach((entry) => {
				switch(entry.name) {
					case 'init':
						var file = process.env.INITIALIZATION_MEASUREMENTS;
						break;
					case 'reexec':
						var file = process.env.REQUEST_MEASUREMENTS;
						break;
					case (entry.name.match(/^req-/) || '').input:
						var file = process.env.REQUEST_MEASUREMENTS;
						break;
					case 'preprocess':
					case 'postprocess':
					case 'read-advice':
						var file = process.env.PROCESS_ADVICE_MEASUREMENTS;
						break;
					case 'active-time':
						var file = process.env.ACTIVE_TIME_MEASUREMENTS;
						break;
					default:
						throw new Error("Unupported mark!")
				}
				if (this.writeMeasurements){
					appendToCsv(file, entry.name + ',' + entry.duration.toString() + newLine);
				}
  			})
		})
		this.obs.observe({entryTypes: ['measure']});
		this.requests = new Map(); // used to keep track of the request ids that have been encountered
		this.initPhase = false; // Used to make sure that no requests arrive before the initialization finishes
		//leave a blank line in the documents we will save the results
		appendToCsv(process.env.INITIALIZATION_MEASUREMENTS, newLine);
		appendToCsv(process.env.REQUEST_MEASUREMENTS, newLine);
		appendToCsv(process.env.PROCESS_ADVICE_MEASUREMENTS, newLine);
	},

	// Add the size of contents to the total advice size
	add_to_advice(contents){
		if (contents instanceof String || typeof contents == "string"){
			this.advice_size += Buffer.byteLength(contents, 'utf8');	
		}else{
			this.advice_size += contents.byteLength;
		}
	},

	// Add the size of the contents to the size of the variable/state logs	
	add_to_statelog(contents){
		if (contents instanceof String || typeof contents == "string"){
			this.statelog_size += Buffer.byteLength(contents, 'utf8');	
		}else{
			this.statelog_size += contents.byteLength;
		}
	},

	// Add the size of the contents to the size of the handler logs
	add_to_hlog(contents){
		if (contents instanceof String || typeof contents == "string"){
			this.hlog_size += Buffer.byteLength(contents, 'utf8');	
		}else{
			this.hlog_size += contents.byteLength;
		}
	},

	// Save the advice size to the appropriate files
	write_advice_size(){
		if (this.writeMeasurements){
			appendToCsv(process.env.ADVICE_SIZE_MEASUREMENTS, "total," + this.advice_size.toString());
			if (this.statelog_size > 0){
				appendToCsv( process.env.ADVICE_SIZE_MEASUREMENTS, newLine + "state_log," + this.statelog_size.toString());
			}	
			if (this.hlog_size > 0){
				appendToCsv( process.env.ADVICE_SIZE_MEASUREMENTS, newLine + "h_log," + this.hlog_size.toString());
			}
		}
	},

	// Save the size of each of the groups
	saveGroups(cfgInfo){
		var file = process.env.GROUP_INFO;
		var group_info = "";
		for (let [cft, info] of cfgInfo){
			group_info += info.rids.length.toString() + "//";
		}
		fs.writeFileSync(file, group_info);
	},

	// Mark the time when initialization starts
	initStarts(){
		if (!this.writeMeasurements) return;
		performance.mark('init-start');	
		this.initPhase = true;
	},

	// Mark the time when initialization ends
	initEnds(){
		if (!this.writeMeasurements) return;
		performance.mark('init-end');
		performance.measure('init', 'init-start', 'init-end');
		this.initPhase = false;
	},

	// Mark the time when request with id rid starts and modify active time
	requestStarts(rid){
		// Check that initialization has finished
		assert(!this.initPhase);
		if (!this.writeMeasurements) return;
		if (this.requests.has(rid)) return;
		performance.mark('req-start-' + rid.toString());
		this.requests.set(rid, 1);
		// Do not add this request to active time unless this is a request
		// that we don't ignore. HACK: Each thread with id rid is sends 
		// requests with ids this.reqs_per_thread*thread_id + i 
		// with i = 0...reqs_per_thread. We ignore the first ignore_reqs 
		// of each thread
		if ((rid % this.reqs_per_thread) < this.ignore_reqs) {
			return;
		}
		// If there were no active requests prior to this request mark 
		// the start of the active time
		if (this.active_reqs == 0){
			performance.mark('active-time-start');
		}
		// Increment the number of current active requests
		this.active_reqs+=1;
	},

	// Mark the request end time
	requestEnds(rid){
		// Check that initialization has finished
		assert(!this.initPhase);
		if (!this.writeMeasurements) return;
		performance.mark('req-end-' + rid.toString());
		performance.measure('req-' + rid.toString(), 'req-start-' + rid.toString(), 'req-end-' + rid.toString());
		// Do not add this request to active time unless this is a request
		// that we don't ignore. 
		if ((rid % this.reqs_per_thread) < this.ignore_reqs) {
			return;
		}
		// Decrease the number of current active requests
		this.active_reqs-=1;
		// If there are no active requests, record the time 
		// that the server was serving requests for
		if (this.active_reqs == 0){
			performance.mark('active-time-end');
			performance.measure('active-time', 'active-time-start', 'active-time-end');
		}
	},

	// Mark the preprocess start time
	preprocessStarts(){
		// Make sure that init has finished
		assert(!this.initPhase);
		if (!this.writeMeasurements) return;
		performance.mark('preprocess-start');
	},

	// Mark the preprocess end time
	preprocessEnds(){
		// Make sure that init has finished
		assert(!this.initPhase);
		if (!this.writeMeasurements) return;
		performance.mark('preprocess-end');
		performance.measure('preprocess', 'preprocess-start', 'preprocess-end');
	},

	// Mark the time when the verifier starts reading the advice
	readAdviceStarts(){
		assert(!this.initPhase);
		if (!this.writeMeasurements) return;
		performance.mark('read-advice-start');
	},

	// Mark the time when the verifier finishes reading the advice
	readAdviceEnds(){
		if (!this.writeMeasurements) return;
		performance.mark('read-advice-end');
		performance.measure('read-advice', 'read-advice-start', 'read-advice-end');
	},
	
	// Mark the time when reexecution starts at the verifier
	reExecStarts(){
		if (!this.writeMeasurements) return;
		performance.mark('reexec-start');
	},

	// Mark the time whe reexecution finishes at the verifier
	reExecEnds(){
		if (!this.writeMeasurements) return;
		performance.mark('reexec-end');
		performance.measure('reexec', 'reexec-start', 'reexec-end');
	},
	
	// Mark the time when postprocess starts at the verifier
	postprocessStarts(){
		if (!this.writeMeasurements) return;
		performance.mark('postprocess-start');
	},

	// Mark the time when postprocess ends at the verifier
	postprocessEnds(){
		if (!this.writeMeasurements) return;
		performance.mark('postprocess-end');
		performance.measure('postprocess', 'postprocess-start', 'postprocess-end');
	},
}

function appendToCsv(file, t){
	var err = fs.appendFileSync(file, t);
	if (err){
		throw err;
	}
}


