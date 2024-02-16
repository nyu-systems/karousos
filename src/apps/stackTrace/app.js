const express = require('express');
const knex = require('knex')({
    client: 'mysql2',
    connection: {
        host: 'localhost',
        user: 'root',
        password: '1234',
        database: 'test',
    },
});

const assert = require('assert');

/* App variables */
const app = express();
const port = '8000';

const tbl = 'stackTrace';
var all_hashes = []; 
var in_progress = new Map(); // Contains an entry for each hash that is in the DB. entry is set to true if insertion/updatee is in progress.

/* App functions */
//create table stackTrace (id_hash varchar(100), trace longtext, primary key (id_hash));

//check whether a hash exists
async function existHash(hash) {
    return knex.transaction(async trx => {
        return trx.select('*').where({
            'id_hash': hash
        }).from(tbl);
    });
}

//check and write
async function insertTrace(hash, trace) {
    if (typeof(trace) == 'undefined') {
        trace = null;
    };

    // Check if someone else has already reported the thread
    if (in_progress.has(hash)) {
        // Check if insertion is in progress. If not, then go ahead and update in the db
        if (!in_progress.get(hash)) {
            in_progress.set(hash, true)
	    await knex.transaction(async trx => {
                return trx.select('*')
                    .where({
                        'id_hash': hash
                    })
                    .from(tbl)
                    .then((ret) => {
                        assert(ret.length == 1);
                        return trx(tbl)
                            .where({
                                'id_hash': hash
                            })
                            .update({
                                'id_hash': hash,
                                'trace': trace,
                                'frequency': ret[0]['frequency'] + 1
                            });
                    })
            })
            in_progress.set(hash, false)
        } else {
            // Do nothing if there is an insert in progress.
            return "Could not insert dump. Please try again later."
        }
    } else {
        in_progress.set(hash, true)
        await knex.transaction(async trx => {
            return trx(tbl).insert({
                'id_hash': hash,
                'trace': trace,
                'frequency': 1
            });
        })
        in_progress.set(hash, false);
	all_hashes.push(hash);
    };
    return "dump reported"
}

var idx = 0;
async function listTrace() {
    var promises = [];
    for (let hash of all_hashes) {
        if (!in_progress.get(hash)) {
	    promises.push(knex.select('*').where({
                'id_hash': hash
            }).from(tbl));
        }
    }
    var all_traces = await Promise.all(promises);
    var res = all_traces.map((trace) => {
        return {
            "trace": trace[0].trace,
            "frequency": trace[0].frequency
        }
    })
    return res;
}


/* App routing */
app.all('/check', async function(req, res) {
    let data = '';
    req.on('data', (chunk) => {
        data += chunk;
    });
    req.on('end', () => {
        let reqBody = JSON.parse(data);
	existHash(reqBody.hash)
            .then((ret) => {
                if (ret.length == 1) {
                    res.send("Value is " + ret[0].trace + " and frequency is " + ret[0].frequency);
                } else if (ret.length == 0) {
                    res.send("trace does not exist");
                } else {
                    res.send("unknown error");
                }
            })
            .catch(err => res.send(err));
    });
});

app.post('/post', async function(req, res) {
    let data = '';
    req.on('data', (chunk) => {
        data += chunk;
    });
    req.on('end', () => {
        let reqBody = JSON.parse(data);
        insertTrace(reqBody.hash, reqBody.value)
            .then(ret => {
                res.send(ret)
            })
            .catch(err => {
                res.send("error occured" + err)
            });
    });
});


//----list all traces
app.post('/list', async function(req, res) {
    listTrace()
        .then(ret => {
            res.send(ret)
        })
        .catch(err => {
            res.send("Error occured" + err)
        });
});

app.listen(port, () => {
    console.log(`Listening to requests on http://localhost:${port}`);
});
