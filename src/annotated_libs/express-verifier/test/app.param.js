
var express = require('../')
  , request = require('supertest');
var karousos = require('/home/ioanna/server-lib') 
const uuid = require('uuid/v4')

describe('app', function(){
  describe('.param(fn)', function(){
    it('should map app.param(name, ...) logic', function(done){
      var app = express();

      app.param(function(name, regexp){
        if (Object.prototype.toString.call(regexp) === '[object RegExp]') { // See #1557
          return function(req, res, next, val){
            var requestID = req.headers['x-request-id']
            var handlerID = karousos.getCurrentHandler(requestID)
            var captures;
            if (captures = regexp.exec(String(val))) {
              req.params[name] = captures[1];
              next(requestID, handlerID);
            } else {
              next(requestID, handlerID, 'route');
            }
          }
        }
      })

      app.param(':name', /^([a-zA-Z]+)$/);

      app.get('/user/:name', function(req, res){
        var requestID = req.headers['x-request-id']
        var handlerID = karousos.getCurrentHandler(requestID)
        res.send(requestID, handlerID, req.params.name);
        console.log('sent')
      });

      request(app)
      .get('/user/tj')
      .set('x-request-id', uuid())
      .expect(200, 'tj', function (err) {
        if (err) return done(err)
        request(app)
        .get('/user/123')
        .set('x-request-id', uuid())
        .expect(404, done);
      });

    })

    it('should fail if not given fn', function(){
      var app = express();
      app.param.bind(app, ':name', 'bob').should.throw();
    })
  })

  describe('.param(names, fn)', function(){
    it('should map the array', function(done){
      var app = express();

      app.param(['id', 'uid'], function(req, res, next, id){
        var requestID = req.headers['x-request-id']
        var handlerID = karousos.getCurrentHandler(requestID)
        id = Number(id);
        if (isNaN(id)) return next(requestID, handlerID, 'route');
        req.params.id = id;
        next(requestID, handlerID);
      });

      app.get('/post/:id', function(req, res){
        var requestID = req.headers['x-request-id']
        var handlerID = karousos.getCurrentHandler(requestID)
        var id = req.params.id;
        id.should.be.a.Number()
        res.send(requestID, handlerID, '' + id);
      });

      app.get('/user/:uid', function(req, res){
        var requestID = req.headers['x-request-id']
        var handlerID = karousos.getCurrentHandler(requestID)
        var id = req.params.id;
        id.should.be.a.Number()
        res.send(requestID, handlerID, '' + id);
      });

      request(app)
      .get('/user/123')
      .set('x-request-id', uuid())
      .expect(200, '123', function (err) {
        if (err) return done(err)
        request(app)
        .get('/post/123')
        .set('x-request-id', uuid())
        .expect('123', done);
      })
    })
  })

  describe('.param(name, fn)', function(){
    it('should map logic for a single param', function(done){
      var app = express();

      app.param('id', function(req, res, next, id){
         var requestID = req.headers['x-request-id']
        var handlerID = karousos.getCurrentHandler(requestID)
        id = Number(id);
        if (isNaN(id)) return next('route');
        req.params.id = id;
        next(requestID, handlerID);
      });

      app.get('/user/:id', function(req, res){
      var requestID = req.headers['x-request-id']
        var handlerID = karousos.getCurrentHandler(requestID)
           var id = req.params.id;
        id.should.be.a.Number()
        res.send(requestID, handlerID, '' + id);
      });

      request(app)
      .get('/user/123')
      .set('x-request-id', uuid())
      .expect('123', done);
    })

    it('should only call once per request', function(done) {
      var app = express();
      var called = 0;
      var count = 0;

      app.param('user', function(req, res, next, user) {
      var requestID = req.headers['x-request-id']
        var handlerID = karousos.getCurrentHandler(requestID)
           called++;
        req.user = user;
        next(requestID, handlerID);
      });

      app.get('/foo/:user', function(req, res, next) {
      var requestID = req.headers['x-request-id']
        var handlerID = karousos.getCurrentHandler(requestID)
           count++;
        next(requestID, handlerID);
      });
      app.get('/foo/:user', function(req, res, next) {
      var requestID = req.headers['x-request-id']
        var handlerID = karousos.getCurrentHandler(requestID)
           count++;
        next(requestID, handlerID);
      });
      app.use(function(req, res) {
      var requestID = req.headers['x-request-id']
        var handlerID = karousos.getCurrentHandler(requestID)
           res.end([count, called, req.user].join(' '));
      });

      request(app)
      .get('/foo/bob')
      .set('x-request-id', uuid())
      .expect('2 1 bob', done);
    })

    it('should call when values differ', function(done) {
      var app = express();
      var called = 0;
      var count = 0;

      app.param('user', function(req, res, next, user) {
        var requestID = req.headers['x-request-id']
        var handlerID = karousos.getCurrentHandler(requestID)
        called++;
        req.users = (req.users || []).concat(user);
        next(requestID, handlerID);
      });

      app.get('/:user/bob', function(req, res, next) {
         var requestID = req.headers['x-request-id']
         var handlerID = karousos.getCurrentHandler(requestID)
         count++;
         next(requestID, handlerID);
      });
      app.get('/foo/:user', function(req, res, next) {
        var requestID = req.headers['x-request-id']
        var handlerID = karousos.getCurrentHandler(requestID)
        count++;
        next(requestID, handlerID);
      });
      app.use(function(req, res) {
        var requestID = req.headers['x-request-id']
        var handlerID = karousos.getCurrentHandler(requestID)
        res.end([count, called, req.users.join(',')].join(' '));
      });

      request(app)
      .get('/foo/bob')
      .set('x-request-id', uuid())
      .expect('2 2 foo,bob', done);
    })

    it('should support altering req.params across routes', function(done) {
      var app = express();

      app.param('user', function(req, res, next, user) {
        var requestID = req.headers['x-request-id']
        var handlerID = karousos.getCurrentHandler(requestID)
        req.params.user = 'loki';
        next(requestID, handlerID);
      });

      app.get('/:user', function(req, res, next) {
         var requestID = req.headers['x-request-id']
         var handlerID = karousos.getCurrentHandler(requestID)
         next(requestID, handlerID, 'route');
      });
      app.get('/:user', function(req, res, next) {
         var requestID = req.headers['x-request-id']
         var handlerID = karousos.getCurrentHandler(requestID)
         res.send(requestID, handlerID, req.params.user);
      });

      request(app)
      .get('/bob')
      .set('x-request-id', uuid())
      .expect('loki', done);
    })

    it('should not invoke without route handler', function(done) {
      var app = express();

      app.param('thing', function(req, res, next, thing) {
        var requestID = req.headers['x-request-id']
         var handlerID = karousos.getCurrentHandler(requestID)
         req.thing = thing;
        next(requestID, handlerID);
      });

      app.param('user', function(req, res, next, user) {
       var requestID = req.headers['x-request-id']
         var handlerID = karousos.getCurrentHandler(requestID)
          next(requestID, handlerID, new Error('invalid invokation'));
      });

      app.post('/:user', function(req, res, next) {
       var requestID = req.headers['x-request-id']
         var handlerID = karousos.getCurrentHandler(requestID)
          res.send(requestID, handlerID, req.params.user);
      });

      app.get('/:thing', function(req, res, next) {
       var requestID = req.headers['x-request-id']
         var handlerID = karousos.getCurrentHandler(requestID)
          res.send(requestID, handlerID, req.thing);
      });

      request(app)
      .get('/bob')
      .set('x-request-id', uuid())
      .expect(200, 'bob', done);
    })

    it('should work with encoded values', function(done){
      var app = express();

      app.param('name', function(req, res, next, name){
       var requestID = req.headers['x-request-id']
         var handlerID = karousos.getCurrentHandler(requestID)
          req.params.name = name;
        next(requestID, handlerID);
      });

      app.get('/user/:name', function(req, res){
       var requestID = req.headers['x-request-id']
         var handlerID = karousos.getCurrentHandler(requestID)
          var name = req.params.name;
        res.send(requestID, handlerID, '' + name);
      });

      request(app)
      .get('/user/foo%25bar')
      .set('x-request-id', uuid())
      .expect('foo%bar', done);
    })

    it('should catch thrown error', function(done){
      var app = express();

      app.param('id', function(req, res, next, id){
        var requestID = req.headers['x-request-id']
         var handlerID = karousos.getCurrentHandler(requestID)
         throw new Error('err!');
      });

      app.get('/user/:id', function(req, res){
        var requestID = req.headers['x-request-id']
        var handlerID = karousos.getCurrentHandler(requestID)
        var id = req.params.id;
        res.send(requestID, handlerID, '' + id);
      });

      request(app)
      .get('/user/123')
      .set('x-request-id', uuid())
      .expect(500, done);
    })

    it('should catch thrown secondary error', function(done){
      var app = express();

      app.param('id', function(req, res, next, val){
        var requestID = req.headers['x-request-id']
        var handlerID = karousos.getCurrentHandler(requestID)
        console.log(requestID)
        karousos.Register(requestID, handlerID, 'f1', 'nexttict', 'success')
        karousos.Emit(requestID, handlerID, 'f1', 'success')
        process.nextTick(function f(){
	        //var handlerID = karousos.GetHandlerID(requestID, ['nexttick'], 'f1', 'success')
		next(requestID, handlerID)
	});
      });

      app.param('id', function(req, res, next, id){
         var requestID = req.headers['x-request-id']
        var handlerID = karousos.getCurrentHandler(requestID)
        throw new Error('err!');
      });

      app.get('/user/:id', function(req, res){
          var requestID = req.headers['x-request-id']
        var handlerID = karousos.getCurrentHandler(requestID)
       var id = req.params.id;
        res.send(requestID, handlerID,'' + id);
      });

      request(app)
      .get('/user/123')
      .set('x-request-id', uuid())
      .expect(500, done);
    })

    it('should defer to next route', function(done){
      var app = express();

      app.param('id', function(req, res, next, id){
        var requestID = req.headers['x-request-id']
        var handlerID = karousos.getCurrentHandler(requestID)
        next(requestID, handlerID, 'route');
      });

      app.get('/user/:id', function(req, res){
        var requestID = req.headers['x-request-id']
        var handlerID = karousos.getCurrentHandler(requestID)
        var id = req.params.id;
        res.send(requestID, handlerID, '' + id);
      });

      app.get('/:name/123', function(req, res){
        var requestID = req.headers['x-request-id']
        var handlerID = karousos.getCurrentHandler(requestID)
        res.send(requestID, handlerID, 'name');
      });

      request(app)
      .get('/user/123')
      .set('x-request-id', uuid())
      .expect('name', done);
    })

    it('should defer all the param routes', function(done){
      var app = express();

      app.param('id', function(req, res, next, val){
       var requestID = req.headers['x-request-id']
        var handlerID = karousos.getCurrentHandler(requestID)
         if (val === 'new') return next(requestID, handlerID, 'route');
        return next(requestID, handlerID);
      });

      app.all('/user/:id', function(req, res){
        var requestID = req.headers['x-request-id']
        var handlerID = karousos.getCurrentHandler(requestID)
        res.send(requestID, handlerID, 'all.id');
      });

      app.get('/user/:id', function(req, res){
        var requestID = req.headers['x-request-id']
        var handlerID = karousos.getCurrentHandler(requestID)
        res.send(requestID, handlerID, 'get.id');
      });

      app.get('/user/new', function(req, res){
        var requestID = req.headers['x-request-id']
        var handlerID = karousos.getCurrentHandler(requestID)
        res.send(requestID, handlerID, 'get.new');
      });

      request(app)
      .get('/user/new')
      .set('x-request-id', uuid())
      .expect('get.new', done);
    })

    it('should not call when values differ on error', function(done) {
      var app = express();
      var called = 0;
      var count = 0;

      app.param('user', function(req, res, next, user) {
        var requestID = req.headers['x-request-id']
        var handlerID = karousos.getCurrentHandler(requestID)
        called++;
        if (user === 'foo') throw new Error('err!');
        req.user = user;
        next(requestID, handlerID);
      });

      app.get('/:user/bob', function(req, res, next) {
       var requestID = req.headers['x-request-id']
        var handlerID = karousos.getCurrentHandler(requestID)
         count++;
        next(requestID, handlerID);
      });
      app.get('/foo/:user', function(req, res, next) {
        var requestID = req.headers['x-request-id']
        var handlerID = karousos.getCurrentHandler(requestID)
        count++;
        next(requestID. handlerID);
      });

      app.use(function(err, req, res, next) {
        var requestID = req.headers['x-request-id']
        var handlerID = karousos.getCurrentHandler(requestID)
        res.status(500);
        res.send(requestID, handlerID, [count, called, err.message].join(' '));
      });

      request(app)
      .get('/foo/bob')
      .set('x-request-id', uuid())
      .expect(500, '0 1 err!', done)
    });

    it('should call when values differ when using "next"', function(done) {
      var app = express();
      var called = 0;
      var count = 0;

      app.param('user', function(req, res, next, user) {
        var requestID = req.headers['x-request-id']
        var handlerID = karousos.getCurrentHandler(requestID)
        called++;
        if (user === 'foo') return next(requestID, handlerID, 'route');
        req.user = user;
        next(requestID, handlerID);
      });

      app.get('/:user/bob', function(req, res, next) {
        var requestID = req.headers['x-request-id']
        var handlerID = karousos.getCurrentHandler(requestID)
        count++;
        next(requestID, handlerID);
      });
      app.get('/foo/:user', function(req, res, next) {
        var requestID = req.headers['x-request-id']
        var handlerID = karousos.getCurrentHandler(requestID)
        count++;
        next(requestID, handlerID);
      });
      app.use(function(req, res) {
        var requestID = req.headers['x-request-id']
        var handlerID = karousos.getCurrentHandler(requestID)
        res.end([count, called, req.user].join(' '));
      });

      request(app)
      .get('/foo/bob')
      .set('x-request-id', uuid())
      .expect('1 2 bob', done);
    })
  })
})
