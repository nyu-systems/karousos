var karousos = require('/home/ioanna/server-lib') 
const uuid = require('uuid/v4')

var express = require('../')
  , request = require('supertest');

describe('app', function(){
  describe('.request', function(){
    it('should extend the request prototype', function(done){
      var app = express();

      app.request.querystring = function(){
        return require('url').parse(this.url).query;
      };

      app.use(function(req, res){
        var requestID = req.headers['x-request-id']
        var handlerID = karousos.getCurrentHandler(requestID)
        res.end(req.querystring());
      });

      request(app)
      .get('/foo?name=tobi')
      .set('x-request-id', uuid())
      .expect('name=tobi', done);
    })
  })
})
