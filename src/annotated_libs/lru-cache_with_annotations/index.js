'use strict'

// A linked list to keep track of recently-used-ness
const Yallist = require('yallist')

const MAX = Symbol('max')
const LENGTH = Symbol('length')
const LENGTH_CALCULATOR = Symbol('lengthCalculator')
const ALLOW_STALE = Symbol('allowStale')
const MAX_AGE = Symbol('maxAge')
const DISPOSE = Symbol('dispose')
const NO_DISPOSE_ON_SET = Symbol('noDisposeOnSet')
const LRU_LIST = Symbol('lruList')
const CACHE = Symbol('cache')
const UPDATE_AGE_ON_GET = Symbol('updateAgeOnGet')

const naiveLength = () => 1

// lruList is a yallist where the head is the youngest
// item, and the tail is the oldest.  the list contains the Hit
// objects as the entries.
// Each Hit object has a reference to its Yallist.Node.  This
// never changes.
//
// cache is a Map (or PseudoMap) that matches the keys to
// the Yallist.Node object.
class LRUCache {
  constructor (options) {
    if (typeof options === 'number')
      options = { max: options }

    if (!options)
      options = {}

    if (options.max && (typeof options.max !== 'number' || options.max < 0))
      throw new TypeError('max must be a non-negative number')
    // Kind of weird to have a default max of Infinity, but oh well.
    const max = this[MAX] = options.max || Infinity

    const lc = options.length || naiveLength
    this[LENGTH_CALCULATOR] = (typeof lc !== 'function') ? naiveLength : lc
    this[ALLOW_STALE] = options.stale || false
    if (options.maxAge && typeof options.maxAge !== 'number')
      throw new TypeError('maxAge must be a number')
    this[MAX_AGE] = options.maxAge || 0
    this[DISPOSE] = options.dispose
    this[NO_DISPOSE_ON_SET] = options.noDisposeOnSet || false
    this[UPDATE_AGE_ON_GET] = options.updateAgeOnGet || false
    this.reset()
    var self = this;
    //self = karousos.recordAccess(self, requestID, handlerID, false, true, undefined, undefined, true);
  }

  // resize the cache when the max changes.
  set max (mL) {
    var self = this;
    if (typeof mL !== 'number' || mL < 0)
      throw new TypeError('max must be a non-negative number')

    self[MAX] = mL || Infinity
    trim(self)
  }

  get max () {
    var self = this;
    return self[MAX]
  }

  set allowStale (allowStale) {
    var self = this;
    self[ALLOW_STALE] = !!allowStale
  }
  get allowStale () {
    var self = this;
    return self[ALLOW_STALE]
  }

  set maxAge (mA) {
    var self = this;
    if (typeof mA !== 'number')
      throw new TypeError('maxAge must be a non-negative number')

    self[MAX_AGE] = mA
    trim(self)
  }
  get maxAge () {
    var self = this;
    return self[MAX_AGE]
  }

  // resize the cache when the lengthCalculator changes.
  set lengthCalculator (lC) {
    var self = this;
    if (typeof lC !== 'function')
      lC = naiveLength

    if (lC !== self[LENGTH_CALCULATOR]) {
      self[LENGTH_CALCULATOR] = lC
      self[LENGTH] = 0
      self[LRU_LIST].forEach(hit => {
        hit.length = self[LENGTH_CALCULATOR](hit.value, hit.key)
        self[LENGTH] += hit.length
      })
    }
    trim(self)
  }
  get lengthCalculator () {
    var self = this;
    return self[LENGTH_CALCULATOR]
  }

  get length () {
    var self = this;
    return self[LENGTH]
  }
  get itemCount () {
    var self = this;
    return self[LRU_LIST].length
  }

  rforEach (fn, thisp) {
    var self = this;
    thisp = thisp || self
    for (let walker = self[LRU_LIST].tail; walker !== null;) {
      const prev = walker.prev
      forEachStep(self, fn, walker, thisp)
      walker = prev
    }
  }

  forEach (fn, thisp) {
    var self = this;
    thisp = thisp || self
    for (let walker = self[LRU_LIST].head; walker !== null;) {
      const next = walker.next
      forEachStep(self, fn, walker, thisp)
      walker = next
    }
  }

  keys () {
    var self = this;
    return self[LRU_LIST].toArray().map(k => k.key)
  }

  values () {
    var self = this;

    return self[LRU_LIST].toArray().map(k => k.value)
  }

  reset () {
    var self = this;

    if (self[DISPOSE] &&
        self[LRU_LIST] &&
        self[LRU_LIST].length) {
      self[LRU_LIST].forEach(hit => self[DISPOSE](hit.key, hit.value))
    }

    self[CACHE] = new Map() // hash of items by key
    self[LRU_LIST] = new Yallist() // list of items in order of use recency
    self[LENGTH] = 0 // length of items in the list
  }

  dump () {
    var self = this;

    return self[LRU_LIST].map(hit =>
      isStale(self, hit) ? false : {
        k: hit.key,
        v: hit.value,
        e: hit.now + (hit.maxAge || 0)
      }).toArray().filter(h => h)
  }

  dumpLru () {
    return this[LRU_LIST]
  }

  set (key, value, maxAge) {
    var self = this;

    maxAge = maxAge || self[MAX_AGE]

    if (maxAge && typeof maxAge !== 'number')
      throw new TypeError('maxAge must be a number')

    const now = maxAge ? Date.now() : 0
    const len = self[LENGTH_CALCULATOR](value, key)

    if (self[CACHE].has(key)) {
      if (len > self[MAX]) {
        del(self, self[CACHE].get(key))
        return false
      }

      const node = self[CACHE].get(key)
      const item = node.value

      // dispose of the old one before overwriting
      // split out into 2 ifs for better coverage tracking
      if (self[DISPOSE]) {
        if (!self[NO_DISPOSE_ON_SET])
          self[DISPOSE](key, item.value)
      }

      item.now = now
      item.maxAge = maxAge
      item.value = value
      self[LENGTH] += len - item.length
      item.length = len
      self.get(key)
      trim(self)
      return true
    }

    const hit = new Entry(key, value, len, now, maxAge)

    // oversized objects fall out of cache automatically.
    if (hit.length > self[MAX]) {
      if (self[DISPOSE])
        self[DISPOSE](key, value)

      return false
    }

    self[LENGTH] += hit.length
    self[LRU_LIST].unshift(hit)
    self[CACHE].set(key, self[LRU_LIST].head)
    trim(self)
    return true
  }

  has (key) {
    var self = this;

    if (!self[CACHE].has(key)) return false
    const hit = self[CACHE].get(key).value
    return !isStale(self, hit)
  }

  get (key) {
    var self = this;

    var res = get(self, key, true)
    return res;
  }

  peek (key) {
    var self = this;

    var res = get(self, key, false)
    return res;
  }

  pop () {
    var self = this;

    const node = self[LRU_LIST].tail
    if (!node)
      return null

    del(self, node)
    return node.value
  }

  del (key) {
    var self = this;

    del(self, self[CACHE].get(key))
  }

  load (arr) {
    var self = this;

    // reset the cache
    self.reset()

    const now = Date.now()
    // A previous serialized cache has the most recent items first
    for (let l = arr.length - 1; l >= 0; l--) {
      const hit = arr[l]
      const expiresAt = hit.e || 0
      if (expiresAt === 0)
        // the item was created without expiration in a non aged cache
        self.set(hit.k, hit.v)
      else {
        const maxAge = expiresAt - now
        // dont add already expired items
        if (maxAge > 0) {
          self.set(hit.k, hit.v, maxAge)
        }
      }
    }
  }

  prune () {
    var self = this;

    self[CACHE].forEach((value, key) => get(self, key, false))
  }
}

const get = (self, key, doUse) => {
  const node = self[CACHE].get(key)
  if (node) {
    const hit = node.value
    if (isStale(self, hit)) {
      del(self, node)
      if (!self[ALLOW_STALE])
        return undefined
    } else {
      if (doUse) {
        if (self[UPDATE_AGE_ON_GET])
          node.value.now = Date.now()
        self[LRU_LIST].unshiftNode(node)
      }
    }
    return hit.value
  }
}

const isStale = (self, hit) => {
  if (!hit || (!hit.maxAge && !self[MAX_AGE]))
    return false

  const diff = Date.now() - hit.now
  return hit.maxAge ? diff > hit.maxAge
    : self[MAX_AGE] && (diff > self[MAX_AGE])
}

const trim = self => {
  if (self[LENGTH] > self[MAX]) {
    for (let walker = self[LRU_LIST].tail;
      self[LENGTH] > self[MAX] && walker !== null;) {
      // We know that we're about to delete this one, and also
      // what the next least recently used key will be, so just
      // go ahead and set it now.
      const prev = walker.prev
      del(self, walker)
      walker = prev
    }
  }
}

const del = (self, node) => {
  if (node) {
    const hit = node.value
    if (self[DISPOSE])
      self[DISPOSE](hit.key, hit.value)

    self[LENGTH] -= hit.length
    self[CACHE].delete(hit.key)
    self[LRU_LIST].removeNode(node)
  }
}

class Entry {
  constructor (key, value, length, now, maxAge) {
    this.key = key
    this.value = value
    this.length = length
    this.now = now
    this.maxAge = maxAge || 0
  }
}

const forEachStep = (self, fn, node, thisp) => {
  let hit = node.value
  if (isStale(self, hit)) {
    del(self, node)
    if (!self[ALLOW_STALE])
      hit = undefined
  }
  if (hit)
    fn.call(thisp, hit.value, hit.key, self)
}

module.exports = LRUCache
