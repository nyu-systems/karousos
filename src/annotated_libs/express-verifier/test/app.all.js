
var karousos = require('/home/ioanna/server-lib') 
const uuid = require('uuid/v4')
var express = require('../')
  , request = require('supertest');

describe('app.all()', function(){
  it('should add a router per method', function(done){
    var app = express();

    app.all('/tobi', function(req, res){
        var requestID = req.headers['x-request-id']
        var handlerID = karousos.getCurrentHandler(requestID)
	console.log('hey') 
       	res.send(requestID, handlerID, req.method);
    });
    request(app)
    .put('/tobi')
    .set('x-request-id', uuid())
    .expect('PUT', function(){
      request(app)
      .get('/tobi')
      .set('x-request-id', uuid())
      .expect('GET', done);
    });
  })

  it('should run the callback for a method just once', function(done){
    var app = express()
      , n = 0;

    app.all('/*', function(req, res, next){
      var requestID = req.headers['x-request-id']
      var handlerID = karousos.getCurrentHandler(requestID)
      if (n++){
	 return done(new Error('DELETE called several times'));
      }
      next(requestID, handlerID, [], '');
    });

    request(app)
    .del('/tobi')
    .set('x-request-id', uuid())
    .expect(404, done);
  })
})
