// This module exports the `converter` and `transformers` objects from the  `require("apg-conv-api")` statement.
// For example, get the converter and encode an array of integer character codes to a UTF8 byte stream,
//````
// var apgConv = require("apg-conv-api");
// var buf = apgConv.converter.encode("UTF8", chars);
//````
/*
* COPYRIGHT: Copyright (c) 2017 Lowell D. Thomas, all rights reserved
*   LICENSE: BSD-3-Clause
*    AUTHOR: Lowell D. Thomas
*     EMAIL: lowell@coasttocoastresearch.com
*   WEBSITE: http://coasttocoastresearch.com/
*/
"use strict";
exports.converter = require("./converter.js");
exports.transformers = require("./transformers.js");
