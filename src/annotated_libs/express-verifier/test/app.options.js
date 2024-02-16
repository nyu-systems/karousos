
const uuid = require('uuid/v4')
var express = require('../')
  , request = require('supertest');
var karousos = require('/home/ioanna/server-lib') 


describe('OPTIONS', function(){
  it('should default to the routes defined', function(done){
    var app = express();

    app.del('/', function(){});
    app.get('/users', function(req, res){});
    app.put('/users', function(req, res){});

    request(app)
    .options('/users')
    .set('x-request-id', uuid())
    .expect('Allow', 'GET,HEAD,PUT')
    .expect(200, 'GET,HEAD,PUT', done);
  })

  it('should only include each method once', function(done){
    var app = express();

    app.del('/', function(){});
    app.get('/users', function(req, res){});
    app.put('/users', function(req, res){});
    app.get('/users', function(req, res){});

    request(app)
    .options('/users')
    .set('x-request-id', uuid())
    .expect('Allow', 'GET,HEAD,PUT')
    .expect(200, 'GET,HEAD,PUT', done);
  })

  it('should not be affected by app.all', function(done){
    var app = express();

    app.get('/', function(){});
    app.get('/users', function(req, res){});
    app.put('/users', function(req, res){});
    app.all('/users', function(req, res, next){
      var requestID = req.headers['x-request-id']
      var handlerID = karousos.getCurrentHandler(requestID)
      res.setHeader('x-hit', '1');
      next(requestID, handlerID);
    });

    request(app)
    .options('/users')
    .set('x-request-id', uuid())
    .expect('x-hit', '1')
    .expect('Allow', 'GET,HEAD,PUT')
    .expect(200, 'GET,HEAD,PUT', done);
  })

  it('should not respond if the path is not defined', function(done){
    var app = express();

    app.get('/users', function(requestID, handlerID, req, res){});

    request(app)
    .options('/other')
    .set('x-request-id', uuid())
    .expect(404, done);
  })

  it('should forward requests down the middleware chain', function(done){
    var app = express();
    var router = new express.Router();

    router.get('/users', function(requestID, handlerID, req, res){});
    app.use(router);
    app.get('/other', function(requestID, handlerID, req, res){});

    request(app)
    .options('/other')
    .set('x-request-id', uuid())
    .expect('Allow', 'GET,HEAD')
    .expect(200, 'GET,HEAD', done);
  })

  describe('when error occurs in response handler', function () {
    it('should pass error to callback', function (done) {
      console.log(done.toString())
      var app = express();
      var router = express.Router();

      router.get('/users', function(req, res){});

      app.use(function (req, res, next) {
        var requestID = req.headers['x-request-id']
        var handlerID = karousos.getCurrentHandler(requestID)
        res.writeHead(200);
        next(requestID, handlerID);
      });
      app.use(router);
      app.use(function (err, req, res, next) {
        res.end('true');
      });

      request(app)
      .options('/users')
      .set('x-request-id', uuid())
      .expect(200, 'true', done)
    })
  })
})

describe('app.options()', function(){
  it('should override the default behavior', function(done){
    var app = express();

    app.options('/users', function(req, res){
      var requestID = req.headers['x-request-id']
      var handlerID = karousos.getCurrentHandler(requestID)
      res.set('Allow', 'GET');
      res.send(requestID, handlerID, 'GET');
    });

    app.get('/users', function(req, res){});
    app.put('/users', function(req, res){});

    request(app)
    .options('/users')
    .set('x-request-id', uuid())
    .expect('GET')
    .expect('Allow', 'GET', done);
  })
})
