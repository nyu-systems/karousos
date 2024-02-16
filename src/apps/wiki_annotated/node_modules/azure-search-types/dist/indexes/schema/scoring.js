"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var Aggregation;
(function (Aggregation) {
    Aggregation["sum"] = "sum";
    Aggregation["average"] = "average";
    Aggregation["minimum"] = "minimum";
    Aggregation["maximum"] = "maximum";
    Aggregation["firstMatching"] = "firstMatching";
})(Aggregation = exports.Aggregation || (exports.Aggregation = {}));
var ScoringFunctionType;
(function (ScoringFunctionType) {
    ScoringFunctionType["magnitude"] = "magnitude";
    ScoringFunctionType["freshness"] = "freshness";
    ScoringFunctionType["distance"] = "distance";
    ScoringFunctionType["tag"] = "tag";
})(ScoringFunctionType = exports.ScoringFunctionType || (exports.ScoringFunctionType = {}));
var Interpolation;
(function (Interpolation) {
    Interpolation["constant"] = "constant";
    Interpolation["linear"] = "linear";
    Interpolation["quadratic"] = "quadratic";
    Interpolation["logarithmic"] = "logarithmic";
})(Interpolation = exports.Interpolation || (exports.Interpolation = {}));
//# sourceMappingURL=scoring.js.map