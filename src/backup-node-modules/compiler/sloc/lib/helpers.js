// Generated by CoffeeScript 1.12.7
(function() {
  var alignRight, summarize;

  alignRight = function(string, width) {
    if (string == null) {
      string = '';
    }
    if (width == null) {
      width = 0;
    }
    if (!(typeof string === 'string' && typeof width === 'number' && width >= 0)) {
      return '';
    }
    if (string.length >= width) {
      return string.slice(-width);
    } else {
      return Array(width - string.length + 1).join(' ') + string;
    }
  };

  summarize = function(fileStats) {
    if (!(Array.isArray(fileStats) && fileStats.length > 0)) {
      return {};
    }
    return fileStats.reduce(function(a, b) {
      var i, k, len, o, ref, v, x;
      o = {};
      ref = [a, b];
      for (i = 0, len = ref.length; i < len; i++) {
        x = ref[i];
        if (x != null) {
          for (k in x) {
            v = x[k];
            if (!(typeof v === "number")) {
              continue;
            }
            if (o[k] == null) {
              o[k] = 0;
            }
            o[k] += v;
          }
        }
      }
      return o;
    });
  };

  module.exports = {
    alignRight: alignRight,
    summarize: summarize
  };

}).call(this);
