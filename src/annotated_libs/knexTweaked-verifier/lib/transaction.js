// Transaction
// -------
const { EventEmitter } = require('events');
const Debug = require('debug');

const makeKnex = require('./util/make-knex');
const { callbackify } = require('util');
const { timeout, KnexTimeoutError } = require('./util/timeout');
const finallyMixin = require('./util/finally-mixin');

const debug = Debug('knex:tx');

const { uniqueId, isUndefined } = require('lodash');

// FYI: This is defined as a function instead of a constant so that
//      each Transactor can have its own copy of the default config.
//      This will minimize the impact of bugs that might be introduced
//      if a Transactor ever mutates its config.
function DEFAULT_CONFIG() {
  return {
    userParams: {},
    doNotRejectOnRollback: true,
  };
}

// Acts as a facade for a Promise, keeping the internal state
// and managing any child transactions.
class Transaction extends EventEmitter {
  constructor(client, container, config = DEFAULT_CONFIG(), outerTx = null) {
    super();
    this.userParams = config.userParams;
    this.doNotRejectOnRollback = config.doNotRejectOnRollback;

    const txid = (this.txid = uniqueId('trx'));

    this.client = client;
    this.logger = client.logger;
    this.outerTx = outerTx;
    this.trxClient = undefined;
    this._debug = client.config && client.config.debug;

    debug(
      '%s: Starting %s transaction',
      txid,
      outerTx ? 'nested' : 'top level'
    );

    // FYI: As you will see in a moment, this Promise will be used to construct
    //      2 separate Promise Chains.  This ensures that each Promise Chain
    //      can establish its error-handling semantics without interfering
    //      with the other Promise Chain.
    const basePromise = this._evaluateContainer(config, container);

    // FYI: This is the Promise Chain for EXTERNAL use.  It ensures that the
    //      caller must handle any exceptions that result from `basePromise`.
    this._promise = basePromise.then((x) => x);

    this._completed = false;

    // If there's a wrapping transaction, we need to wait for any older sibling
    // transactions to settle (commit or rollback) before we can start, and we
    // need to register ourselves with the parent transaction so any younger
    // siblings can wait for us to complete before they can start.
    this._previousSibling = Promise.resolve(true);
    if (outerTx) {
      if (outerTx._lastChild) this._previousSibling = outerTx._lastChild;

      // FYI: This is the Promise Chain for INTERNAL use.  It serves as a signal
      //      for when the next sibling should begin its execution.  Therefore,
      //      exceptions are caught and ignored.
      outerTx._lastChild = basePromise.catch(() => {});
    }
  }

  isCompleted() {
    return (
      this._completed || (this.outerTx && this.outerTx.isCompleted()) || false
    );
  }

  begin(conn) {
    return this.query(conn, 'BEGIN;');
  }

  savepoint(conn) {
    return this.query(conn, `SAVEPOINT ${this.txid};`);
  }

  commit(conn, value) {
    return this.query(conn, 'COMMIT;', 1, value);
  }

  release(conn, value) {
    return this.query(conn, `RELEASE SAVEPOINT ${this.txid};`, 1, value);
  }

  rollback(conn, error) {
    return timeout(this.query(conn, 'ROLLBACK', 2, error), 5000).then(() => {
    	karousos.recordStateOp(requestID, handlerID, 'tx_abort', null, this.trxClient.txId)
	})
	.catch(
      (err) => {
        if (!(err instanceof KnexTimeoutError)) {
          return Promise.reject(err);
        }
        this._rejecter(error);
      }
    );
  }

  rollbackTo(conn, error) {
    throw new Error('rolling back to save point not supported')
    return timeout(
      this.query(conn, `ROLLBACK TO SAVEPOINT ${this.txid}`, 2, error),
      5000
    ).catch((err) => {
      if (!(err instanceof KnexTimeoutError)) {
        return Promise.reject(err);
      }
      this._rejecter(error);
    });
  }

  query(conn, sql, status, value) {
    var q;
	if (karousos.reportCollectionActivated(requestID)){
		q = Promise.resolve({});
	}else{
		q = this.trxClient
      		.query(conn, sql)
	}
	q.catch((err) => {
        status = 2;
        value = err;
        this._completed = true;
        debug('%s error running transaction query', this.txid);
      })
      .then((res) => {
        if (status === 1) {
          this._resolver(value);
        }
        if (status === 2) {
          if (isUndefined(value)) {
            if (this.doNotRejectOnRollback && /^ROLLBACK\b/i.test(sql)) {
              this._resolver();
              return;
            }

            value = new Error(`Transaction rejected with non-error: ${value}`);
          }
          this._rejecter(value);
        }
        return res;
      });
    if (status === 1 || status === 2) {
      this._completed = true;
    }
    return q;
  }

  debug(enabled) {
    this._debug = arguments.length ? enabled : true;
    return this;
  }

  async _evaluateContainer(config, container) {
    // FYI: This is temporarily stalling things so that the constructor
    //      can finish initializing the Transaction.  Otherwise,
    //      `this.previousSibling` will still be `undefined`.
    await Promise.resolve();

    // Wait for the earlier Transactions to complete before proceeding.
    await this._previousSibling;
	//KAROUSOS MOFIFICATION
    return this.acquireConnection(config, async (connection) => {
      const trxClient = (this.trxClient = makeTxClient(
        this,
        this.client,
        connection
      ));
     const executionPromise = new Promise((resolver, rejecter) => {
        this._resolver = resolver;
        this._rejecter = rejecter;
      });
	  this.trxClient.txId = karousos.recordStateOp(requestID, handlerID, 'tx_start', null)
	  var prevRequestID = requestID;
	  var prevHandlerID = handlerID;
	  requestID = - 2;
	  handlerID = 'global'; 
      karousos.setCurrentHandler(requestID, handlerID);
	  karousos.pushContext(requestID, handlerID, retEventTypes, objID);
      const init = this.client.transacting
        ? this.savepoint(connection)
        : this.begin(connection);
      requestID = prevRequestID;
      handlerID = prevHandlerID; 
      karousos.setCurrentHandler(requestID, handlerID);
      karousos.pushContext(requestID, handlerID, retEventTypes, objID);
      await init;
	  
      Promise.resolve(makeTransactor(this, connection, trxClient))
        .then((transactor) => {
          transactor.executionPromise = executionPromise;

          // If we've returned a "thenable" from the transaction container, assume
          // the rollback and commit are chained to this object's success / failure.
          // Directly thrown errors are treated as automatic rollbacks.
          let result;
          try {
            result = container(transactor);
          } catch (err) {
            result = Promise.reject(err);
          }
          if (result && result.then && typeof result.then === 'function') {
            result
              .then((val) => {
                return transactor.commit(val);
              })
              .catch((err) => {
                return transactor.rollback(err);
              });
          }
          return null;
        })
        .catch((e) => {
          return this._rejecter(e);
        });

      return executionPromise;
    });
  }

  // Acquire a connection and create a disposer - either using the one passed
  // via config or getting one off the client. The disposer will be called once
  // the original promise is marked completed.
  acquireConnection(config, cb) {
    const configConnection = config && config.connection;
    return new Promise((resolve, reject) => {
      try {
        resolve(configConnection || this.client.acquireConnection());
      } catch (e) {
        reject(e);
      }
    }).then(async (connection) => {
      try {
       var prevRequestID = requestID;
		requestID = -2;
        connection.__knexTxId = this.txid;
		requestID = prevRequestID;

        return await cb(connection);
      } finally {
        if (!configConnection) {
          debug('%s: releasing connection', this.txid);
          this.client.releaseConnection(connection);
        } else {
          debug('%s: not releasing external connection', this.txid);
        }
      }
    });
  }

  then(onResolve, onReject) {
    return this._promise.then(onResolve, onReject);
  }

  catch(onReject) {
    return this._promise.catch(onReject);
  }

  asCallback(cb) {
    callbackify(() => this._promise)(cb);
    return this._promise;
  }
}
finallyMixin(Transaction.prototype);

// The transactor is a full featured knex object, with a "commit", a "rollback"
// and a "savepoint" function. The "savepoint" is just sugar for creating a new
// transaction. If the rollback is run inside a savepoint, it rolls back to the
// last savepoint - otherwise it rolls back the transaction.
function makeTransactor(trx, connection, trxClient) {
  const transactor = makeKnex(trxClient);

  transactor.withUserParams = () => {
    throw new Error(
      'Cannot set user params on a transaction - it can only inherit params from main knex instance'
    );
  };

  transactor.isTransaction = true;
  transactor.userParams = trx.userParams || {};

  transactor.transaction = function(container, options) {
    if (!options) {
      options = { doNotRejectOnRollback: true };
    } else if (isUndefined(options.doNotRejectOnRollback)) {
      options.doNotRejectOnRollback = true;
    }

    if (container) {
      return trxClient.transaction(container, options, trx);
    } else {
      return new Promise((resolve, _reject) => {
        trxClient.transaction(
          (nestedTrx) => {
            resolve(nestedTrx);
          },
          options,
          trx
        );
      });
    }
  };
  transactor.savepoint = function(container, options) {
    return transactor.transaction(container, options);
  };

  if (trx.client.transacting) {
    transactor.commit = (value) => trx.release(connection, value);
    transactor.rollback = (error) => trx.rollbackTo(connection, error);
  } else {
    transactor.commit = async (value) => {
		var prevRequestID = requestID;
		var prevHandlerID = handlerID;
		requestID = -2;
		handlerID = 'global'; 
		karousos.setCurrentHandler(requestID, handlerID);
		karousos.pushContext(requestID, handlerID, retEventTypes, objID);

		karousos.pushContext(requestID, handlerID, retEventTypes, objID);
		let ret = await trx.commit(connection, value);
		requestID = prevRequestID;
		handlerID = prevHandlerID; 
        karousos.setCurrentHandler(requestID, handlerID);
		karousos.pushContext(requestID, handlerID, retEventTypes, objID);
		karousos.recordStateOp(requestID, handlerID, 'tx_commit', null, trxClient.txId);
    }
	transactor.rollback = (error) => trx.rollback(connection, error);
  }

  transactor.isCompleted = () => trx.isCompleted();

  return transactor;
}

// We need to make a client object which always acquires the same
// connection and does not release back into the pool.
function makeTxClient(trx, client, connection) {
  const trxClient = Object.create(client.constructor.prototype);
  trxClient.version = client.version;
  trxClient.config = client.config;
  trxClient.driver = client.driver;
  trxClient.connectionSettings = client.connectionSettings;
  trxClient.transacting = true;
  trxClient.valueForUndefined = client.valueForUndefined;
  trxClient.logger = client.logger;

  trxClient.on('query', function(arg) {
    trx.emit('query', arg);
    client.emit('query', arg);
  });

  trxClient.on('query-error', function(err, obj) {
    trx.emit('query-error', err, obj);
    client.emit('query-error', err, obj);
  });

  trxClient.on('query-response', function(response, obj, builder) {
    trx.emit('query-response', response, obj, builder);
    client.emit('query-response', response, obj, builder);
  });

  const _query = trxClient.query;
  trxClient.query = function(conn, obj) {
    const completed = trx.isCompleted();
    return new Promise(function(resolve, reject) {
      try {
        if (conn !== connection)
          throw new Error('Invalid connection for transaction query.');
        if (completed) completedError(trx, obj);
        resolve(_query.call(trxClient, conn, obj));
      } catch (e) {
        reject(e);
      }
    });
  };
  const _stream = trxClient.stream;
  trxClient.stream = function(conn, obj, stream, options) {
    const completed = trx.isCompleted();
    return new Promise(function(resolve, reject) {
      try {
        if (conn !== connection)
          throw new Error('Invalid connection for transaction query.');
        if (completed) completedError(trx, obj);
        resolve(_stream.call(trxClient, conn, obj, stream, options));
      } catch (e) {
        reject(e);
      }
    });
  };
  trxClient.acquireConnection = function() {
    return Promise.resolve(connection);
  };
  trxClient.releaseConnection = function() {
    return Promise.resolve();
  };

  return trxClient;
}

function completedError(trx, obj) {
  const sql = typeof obj === 'string' ? obj : obj && obj.sql;
  debug('%s: Transaction completed: %s', trx.txid, sql);
  throw new Error(
    'Transaction query already complete, run with DEBUG=knex:tx for more info'
  );
}

module.exports = Transaction;
