
const uuid = require('uuid/v4')
var express = require('../');
var request = require('supertest');
var assert = require('assert');
var karousos = require('/home/ioanna/server-lib') 

describe('HEAD', function(){
  it('should default to GET', function(done){
    var app = express();

    app.get('/tobi', function(req, res){
      var requestID = req.headers['x-request-id']
      var handlerID = karousos.getCurrentHandler(requestID)
      // send() detects HEAD
      console.log('oh my', requestID)
      res.send(requestID, handlerID, 'tobi');
    });

    request(app)
    .head('/tobi')
    .set('x-request-id', uuid())
    .expect(200, done);
  })

  it('should output the same headers as GET requests', function(done){
    var app = express();

    app.get('/tobi', function(req, res){
      var requestID = req.headers['x-request-id']
      var handlerID = karousos.getCurrentHandler(requestID)
      // send() detects HEAD
      res.send(requestID, handlerID, 'tobi');
    });

    request(app)
    .get('/tobi')
    .set('x-request-id', uuid())
    .expect(200, function(err, res){
      if (err) return done(err);
      var headers = res.headers;
      request(app)
      .get('/tobi')
      .set('x-request-id', uuid())
      .expect(200, function(err, res){
        if (err) return done(err);
        delete headers.date;
        delete res.headers.date;
        assert.deepEqual(res.headers, headers);
        done();
      });
    });
  })
})

describe('app.head()', function(){
  it('should override', function(done){
    var app = express()
      , called;

    app.head('/tobi', function(req, res){
      var requestID = req.headers['x-request-id']
      var handlerID = karousos.getCurrentHandler(requestID)
      called = true;
      res.end('');
    });

    app.get('/tobi', function(req, res){
      var requestID = req.headers['x-request-id']
      var handlerID = karousos.getCurrentHandler(requestID)
      assert(0, 'should not call GET');
      res.send(requestID, handlerID, 'tobi');
    });

    request(app)
    .head('/tobi')
    .set('x-request-id', uuid())
    .expect(200, function(){
      assert(called);
      done();
    });
  })
})
