//Main prover
const Measurements = require(process.env.KAR_HOME + '/src/measurements');
const karousos = require(process.env.KAR_HOME + '/src/server-lib');
// Initialize the measurements module
Measurements.init(true, true);

// Start the server and measure the initialization time
Measurements.initStarts();
var targetApp = require(process.env.DST_MAIN_CODE);
Measurements.initEnds();

// Save advice for request id = -1 (the non-deterministic bits)
karousos.saveReportsForRid(-1, false);

// Shut down the server after KEEP_ALIVE_FOR ms have passed
setTimeout(() => {
	// Save the variable logs
	karousos.saveObjectOls(true);
	process.exit();
}, parseInt(process.env.KEEP_ALIVE_FOR));
