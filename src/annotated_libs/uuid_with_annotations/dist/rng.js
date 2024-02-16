"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = rng;

var _crypto = _interopRequireDefault(require("crypto"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const rnds8Pool = new Uint8Array(256); // # of random values to pre-allocate
let poolPtr = rnds8Pool.length;

poolPtr = karousos.recordAccess(poolPtr, requestID, handlerID, false, true);

function rng() {
  if (poolPtr > rnds8Pool.length - 16) {
    _crypto.default.randomFillSync(rnds8Pool);

    poolPtr = 0;
  }
  poolPtr += 16;
  return rnds8Pool.slice(poolPtr - 16, poolPtr);
}
