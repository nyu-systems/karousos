"use strict";
function __export(m) {
    for (var p in m) if (!exports.hasOwnProperty(p)) exports[p] = m[p];
}
Object.defineProperty(exports, "__esModule", { value: true });
__export(require("./scoring"));
__export(require("./analyzers"));
var FieldType;
(function (FieldType) {
    FieldType["string"] = "Edm.String";
    FieldType["stringCollection"] = "Collection(Edm.String)";
    FieldType["int32"] = "Edm.Int32";
    FieldType["int64"] = "Edm.Int64";
    FieldType["double"] = "Edm.Double";
    FieldType["boolean"] = "Edm.Boolean";
    FieldType["dateTimeOffset"] = "Edm.DateTimeOffset";
    FieldType["geographyPoint"] = "Edm.GeographyPoint";
})(FieldType = exports.FieldType || (exports.FieldType = {}));
var SuggestSearchMode;
(function (SuggestSearchMode) {
    SuggestSearchMode["analyzingInfixMatching"] = "analyzingInfixMatching";
})(SuggestSearchMode = exports.SuggestSearchMode || (exports.SuggestSearchMode = {}));
//# sourceMappingURL=index.js.map