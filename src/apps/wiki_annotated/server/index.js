// ===========================================
// Wiki.js
// Licensed under AGPLv3
// ===========================================

const path = require('path')
const { nanoid } = require('nanoid')
const { DateTime } = require('luxon')


let WIKI = {
  IS_DEBUG: process.env.NODE_ENV === 'development',
  IS_MASTER: true,
  ROOTPATH:path.join(__dirname, '..'),
  INSTANCE_ID: nanoid(10),
  SERVERPATH: path.join(__dirname),
  Error: require('./helpers/error'),
  configSvc: require('./core/config'),
  kernel: require('./core/kernel'),
  startedAt: DateTime.utc()
}
global.WIKI = WIKI
//karousos.recordAccess(WIKI, requestID, handlerID, false, true);

//karousos.recordAccess(WIKI.IS_DEBUG, requestID, handlerID, false, true,WIKI,"IS_DEBUG");
//karousos.recordAccess(WIKI.IS_MASTER, requestID, handlerID, false, true,WIKI,"IS_MASTER");
//karousos.recordAccess(WIKI.ROOTPATH, requestID, handlerID, false, true,WIKI,"ROOTPATH");
//karousos.recordAccess(WIKI.INSTANCE_ID, requestID, handlerID, false, true,WIKI,"INSTANCE_ID");
//karousos.recordAccess(WIKI.SERVERPATH, requestID, handlerID, false, true,WIKI,"SERVERPATH");
//karousos.recordAccess(WIKI.Error, requestID, handlerID, false, true,WIKI,"Error");
//karousos.recordAccess(WIKI.configSvc, requestID, handlerID, false, true,WIKI,"configSvc");
//karousos.recordAccess(WIKI.kernel, requestID, handlerID, false, true,WIKI,"kernel");
//karousos.recordAccess(WIKI.startedAt, requestID, handlerID, false, true,WIKI,"startedAt");


WIKI.configSvc.init()

// ----------------------------------------
// Init Logger
// ----------------------------------------

//WIKI.logger = require('./core/logger').init('MASTER')
 WIKI.logger={
    info:console.log,
    error:console.log,
    warn:console.log,
  }
 /* karousos.recordAccess(WIKI.logger, requestID, handlerID, false, true,WIKI,"logger");
  karousos.recordAccess(WIKI.logger.info, requestID, handlerID, false, true,WIKI.logger,"info");
  karousos.recordAccess(WIKI.logger.error, requestID, handlerID, false, true,WIKI.logger,"error");
  karousos.recordAccess(WIKI.logger.warn, requestID, handlerID, false, true,WIKI.logger,"warn");
*/

// ----------------------------------------
// Start Kernel
// ----------------------------------------

WIKI.kernel.init()

// ----------------------------------------
// Register exit handler
// ----------------------------------------

process.on('SIGINT', () => {
  WIKI.kernel.shutdown()
})
process.on('message', (msg) => {
  if (msg === 'shutdown') {
    WIKI.kernel.shutdown()
  }
})
