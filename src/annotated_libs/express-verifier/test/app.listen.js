
var karousos = require('/home/ioanna/server-lib') 
const uuid = require('uuid/v4')
var express = require('../')

describe('app.listen()', function(){
  it('should wrap with an HTTP server', function(done){
    var app = express();

    app.del('/tobi', function(req, res){
      var requestID = req.headers['x-request-id']
      var handlerID = karousos.getCurrentHandler(requestID)
      res.end('deleted tobi!');
    });

    var server = app.listen(9999, function(){
      server.close();
      done();
    });
  })
})
