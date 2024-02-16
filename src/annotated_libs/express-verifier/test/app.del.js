
var karousos = require('/home/ioanna/server-lib') 
const uuid = require('uuid/v4')

var express = require('../')
  , request = require('supertest');

describe('app.del()', function(){
  it('should alias app.delete()', function(done){
    var app = express();
     
    app.del('/tobi', function(req, res){
     var requestID = req.headers['x-request-id']
    var handlerID = karousos.getCurrentHandler(requestID)
      console.log('about to reply', requestID)
      res.end('deleted tobi!');
    });

    request(app)
    .del('/tobi')
    .set('x-request-id', uuid())
    .expect('deleted tobi!', done);
  })
})
