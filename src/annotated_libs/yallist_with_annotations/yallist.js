'use strict'
module.exports = Yallist

Yallist.Node = Node
Yallist.create = Yallist

function Yallist (list) {
  var self = this
  if (!(self instanceof Yallist)) {
    self = new Yallist()
  }

  self.tail = null
  self.head = null
  self.length = 0

  if (list && typeof list.forEach === 'function') {
    list.forEach(function (item) {
      self.push(item)
    })
  } else if (arguments.length > 0) {
    for (var i = 0, l = arguments.length; i < l; i++) {
      self.push(arguments[i])
    }
  }
  //self = karousos.recordAccess(self, requestID, handlerID, false, true);
  return self
}

Yallist.prototype.removeNode = function (node) {
  var self = this;

  if (node.list !== self) {
    throw new Error('removing node which does not belong to this list')
  }

  var next = node.next
  var prev = node.prev

  if (next) {
    next.prev = prev
  }

  if (prev) {
    prev.next = next
  }

  if (node.value === self.head.value) {
    self.head = next
  }
  if (node.value === this.tail.value) {
    self.tail = prev
  }

  node.list.length--
  node.next = null
  node.prev = null
  node.list = null

  return next
}

Yallist.prototype.unshiftNode = function (node) {
  var self = this;
  if (node.value === self.head.value) {
    return
  }

  if (node.list) {
    node.list.removeNode(node)
  }

  var head = self.head
  node.list = self
  node.next = head
  if (head) {
    head.prev = node
  }

  self.head = node
  if (!self.tail) {
    self.tail = node
  }
  self.length++
}

Yallist.prototype.pushNode = function (node) {
  var self = this;
  if (node === self.tail) {
    return
  }

  if (node.list) {
    node.list.removeNode(node)
  }

  var tail = this.tail
  node.list = this
  node.prev = tail
  if (tail) {
    tail.next = node
  }

  self.tail = node
  if (!self.head) {
    self.head = node
  }
  self.length++
}

Yallist.prototype.push = function () {
  var self = this;
  for (var i = 0, l = arguments.length; i < l; i++) {
    push(self, arguments[i])
  }
  return self.length
}

Yallist.prototype.unshift = function () {
  var self = this;
  for (var i = 0, l = arguments.length; i < l; i++) {
    unshift(self, arguments[i])
  }
  return self.length
}

Yallist.prototype.pop = function () {
  var self = this;
  if (!self.tail) {
    return undefined
  }

  var res = self.tail.value
  self.tail = self.tail.prev
  if (self.tail) {
    self.tail.next = null
  } else {
    self.head = null
  }
  self.length--
  return res
}

Yallist.prototype.shift = function () {
  var self = this;
  if (!self.head) {
    return undefined
  }

  var res = self.head.value
  self.head = self.head.next
  if (self.head) {
    self.head.prev = null
  } else {
    self.tail = null
  }
  self.length--
  return res
}

Yallist.prototype.forEach = function (fn, thisp) {
  var self = this;
  thisp = thisp || self
  for (var walker = self.head, i = 0; walker !== null; i++) {
    fn.call(thisp, walker.value, i, self)
    walker = walker.next
  }
}

Yallist.prototype.forEachReverse = function (fn, thisp) {
  var self = this;
  thisp = thisp || self
  for (var walker = self.tail, i = self.length - 1; walker !== null; i--) {
    fn.call(thisp, walker.value, i, self)
    walker = walker.prev
  }
}

Yallist.prototype.get = function (n) {
  var self = this
  for (var i = 0, walker = self.head; walker !== null && i < n; i++) {
    // abort out of the list early if we hit a cycle
    walker = walker.next
  }
  if (i === n && walker !== null) {
    return walker.value
  }
}

Yallist.prototype.getReverse = function (n) {
  var self = this;
  for (var i = 0, walker = self.tail; walker !== null && i < n; i++) {
    // abort out of the list early if we hit a cycle
    walker = walker.prev
  }
  if (i === n && walker !== null) {
    return walker.value
  }
}

Yallist.prototype.map = function (fn, thisp) {
  var self = this;
  thisp = thisp || self
  var res = new Yallist()
  for (var walker = self.head; walker !== null;) {
    res.push(fn.call(thisp, walker.value, self))
    walker = walker.next
  }
  return res
}

Yallist.prototype.mapReverse = function (fn, thisp) {
  var self = this;
  thisp = thisp || self
  var res = new Yallist()
  for (var walker = self.tail; walker !== null;) {
    res.push(fn.call(thisp, walker.value, self))
    walker = walker.prev
  }
  return res
}

Yallist.prototype.reduce = function (fn, initial) {
  var self = this;
  var acc
  var walker = self.head
  if (arguments.length > 1) {
    acc = initial
  } else if (this.head) {
    walker = self.head.next
    acc = self.head.value
  } else {
    throw new TypeError('Reduce of empty list with no initial value')
  }

  for (var i = 0; walker !== null; i++) {
    acc = fn(acc, walker.value, i)
    walker = walker.next
  }

  return acc
}

Yallist.prototype.reduceReverse = function (fn, initial) {
  var self = this;
  var acc
  var walker = self.tail
  if (arguments.length > 1) {
    acc = initial
  } else if (self.tail) {
    walker = self.tail.prev
    acc = self.tail.value
  } else {
    throw new TypeError('Reduce of empty list with no initial value')
  }

  for (var i = self.length - 1; walker !== null; i--) {
    acc = fn(acc, walker.value, i)
    walker = walker.prev
  }

  return acc
}

Yallist.prototype.toArray = function () {
  var self = this;

  var arr = new Array(self.length)
  for (var i = 0, walker = self.head; walker !== null; i++) {
    arr[i] = walker.value
    walker = walker.next
  }
  return arr
}

Yallist.prototype.toArrayReverse = function () {
  var self = this;
  var arr = new Array(self.length)
  for (var i = 0, walker = self.tail; walker !== null; i++) {
    arr[i] = walker.value
    walker = walker.prev
  }
  return arr
}

Yallist.prototype.slice = function (from, to) {
  var self = this;
  to = to || self.length
  if (to < 0) {
    to += self.length
  }
  from = from || 0
  if (from < 0) {
    from += self.length
  }
  var ret = new Yallist()
  if (to < from || to < 0) {
    return ret
  }
  if (from < 0) {
    from = 0
  }
  if (to > self.length) {
    to = self.length
  }
  for (var i = 0, walker = self.head; walker !== null && i < from; i++) {
    walker = walker.next
  }
  for (; walker !== null && i < to; i++, walker = walker.next) {
    ret.push(walker.value)
  }
  return ret
}

Yallist.prototype.sliceReverse = function (from, to) {
  var self = this;
  to = to || this.length
  if (to < 0) {
    to += this.length
  }
  from = from || 0
  if (from < 0) {
    from += this.length
  }
  var ret = new Yallist()
  if (to < from || to < 0) {
    return ret
  }
  if (from < 0) {
    from = 0
  }
  if (to > this.length) {
    to = this.length
  }
  for (var i = this.length, walker = this.tail; walker !== null && i > to; i--) {
    walker = walker.prev
  }
  for (; walker !== null && i > from; i--, walker = walker.prev) {
    ret.push(walker.value)
  }
  return ret
}

Yallist.prototype.splice = function (start, deleteCount /*, ...nodes */) {
  var self = this;
  if (start > self.length) {
    start = self.length - 1
  }
  if (start < 0) {
    start = self.length + start;
  }

  for (var i = 0, walker = self.head; walker !== null && i < start; i++) {
    walker = walker.next
  }

  var ret = []
  for (var i = 0; walker && i < deleteCount; i++) {
    ret.push(walker.value)
    walker = self.removeNode(walker)
  }
  if (walker === null) {
    walker = self.tail
  }

  if (walker !== self.head && walker !== self.tail) {
    walker = walker.prev
  }

  for (var i = 2; i < arguments.length; i++) {
    walker = insert(self, walker, arguments[i])
  }
  return ret;
}

Yallist.prototype.reverse = function () {
  var self = this;
  var head = self.head
  var tail = self.tail
  for (var walker = head; walker !== null; walker = walker.prev) {
    var p = walker.prev
    walker.prev = walker.next
    walker.next = p
  }
  self.head = tail
  self.tail = head
  return self
}

function insert (self, node, value) {
  var inserted = node === self.head ?
    new Node(value, null, node, self) :
    new Node(value, node, node.next, self)

  if (inserted.next === null) {
    self.tail = inserted
  }
  if (inserted.prev === null) {
    self.head = inserted
  }

  self.length++

  return inserted
}

function push (self, item) {
  self.tail = new Node(item, self.tail, null, self)
  if (!self.head) {
    self.head = self.tail
  }
  self.length++
}

function unshift (self, item) {
  self.head = new Node(item, null, self.head, self)
  if (!self.tail) {
    self.tail = self.head
  }
  self.length++
}

function Node (value, prev, next, list) {
  if (!(this instanceof Node)) {
    return new Node(value, prev, next, list)
  }

  this.list = list
  this.value = value

  if (prev) {
    prev.next = this
    this.prev = prev
  } else {
    this.prev = null
  }

  if (next) {
    next.prev = this
    this.next = next
  } else {
    this.next = null
  }
}

try {
  // add if support for Symbol.iterator is present
  require('./iterator.js')(Yallist)
} catch (er) {}
