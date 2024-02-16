"use strict";

const assert = require('assert')
const {
    isEqual,
    cloneDeep
} = require('lodash')
const {
    isPrimitiveType
} = require(process.env.KAR_HOME + '/src/karousos_utils').builtins;

// A wrapper class for primitive types
class PrimitiveWrapper {
    // Wraps x in a primitive wrapper
    constructor(x) {
        assert(isPrimitiveType(x));
        this.karousos_x = x;
    }

    // returns the wrapped value
    valueOf() {
        return this.karousos_x;
    }

    // turn x to string
    toString() {
        return this.karousos_x == undefined ? "undefined" :
            (this.karousos_x == null ? "null" : this.karousos_x.toString());
    }
}

exports.PrimitiveWrapper = PrimitiveWrapper;

// The multivalue wrapper that wraps all values of all requests in a group
class Multivalue {
    // Creates a new multivalue for an input array of values
    constructor(multivalueArray) {
        this.karousos_value = multivalueArray;
        this.collapsed = false; // If this has been collapsed in a univalue
        this.length = multivalueArray.length;
        // Try to collapse the multivalues in a univalue
        this.collapse();
        // Figure out if the enclosed value is a primitive
        // Undefined and null are primitives
        if (
            this.karousos_value != undefined &&
            this.karousos_value != null &&
            this.karousos_value.length > 0
        ) {
            // find the first non empty value in the array and check if it is primitive
            // this works because all values are of the same type. HACK: If they are not 
            // then this breaks and needs to be modified
            let testForType = this.karousos_value[0];
            for (let i = 0; i < this.karousos_value.length; i++) {
                if (this.karousos_value[i] != null && this.karousos_value[i] != undefined) {
                    testForType = this.karousos_value[i];
                    break;
                }
            }
            this.isPrimitive = isPrimitiveType(testForType);
        } else {
            this.isPrimitive = true;
        }
    }

    // Check if all values in the multivalue are equal and if so collapse in a univalue
    collapse() {
        if (this.collapsed) return;
        if (allEqual(this.karousos_value)) {
            this.karousos_value = this.karousos_value[0];
            this.collapsed = true;
        }
    }

    // We want to do an operation with multivalue2. 
    // We do not need to expand if this is already a multivalue or multivalue2 is collapsed 
    // otherwise, we expand this multivalue into an arr of length multivalue.karousos_value.length
    // and return the array
    expand(multivalue2) {
        if (!this.collapsed || multivalue2.collapsed) return this.karousos_value;
        let arr = new Array(multivalue2.karousos_value.length);
        for (let i = 0; i < arr.length; i++) arr[i] = this.karousos_value;
        return arr;
    }

    //Do some binary operation between this and an operand (that must be a multivalue)
    doBinaryOperation(fn, operand) {
        try {
            // Try to collapse both operands
            this.collapse();
            operand.collapse();
            // If both are collapsed then return the result of applying the function
            if (this.collapsed && operand.collapsed) {
                return fn(this.karousos_value, operand.karousos_value);
            }
            // otherwise, at least one of the operands needs to be expanded
            var op1 = this.expand(operand);
            var op2 = operand.expand(this);
            // check that the resuling operatnds have the same length
            assert(op1.length == op2.length);
            // Compute the resulting multivalue and try to collapse it
            let result = new Array(op1.length);
            for (let i = 0; i < result.length; i++) result[i] = fn(op1[i], op2[i]);
            let ret = new Multivalue(result);
            // If it is collapsed return the result as a single value 
            // otherwise, return the multivalue
            return ret.collapsed ? ret.karousos_value : ret;
        } catch (err) {
            console.log("error in", op1, op2);
            throw err;
        }
    }

    // Do some unary operation on this multivalue
    doUnaryOperation(fn) {
        this.collapse();
        // If it is collapsed, apply the function on the wrapped value
        if (this.collapsed) {
            return fn(this.karousos_value);
        }
        // Otherwise compute the result as a multivalue
        let result = new Array(this.karousos_value.length);
        for (let i = 0; i < result.length; i++) result[i] = fn(this.karousos_value[i]);
        let ret = new Multivalue(result);
        // If it is collapsed return the result as a single value 
        // otherwise, return the multivalue
        return ret.collapsed ? ret.karousos_value : ret;
    }

    // Custom toString method for multivalue
    toString() {
        var strings = '';
        for (let i = 0; i < this.karousos_value.length; i++) {
            strings += this.karousos_value[i].toString();
        }
        return '[' + strings + ']';
    }

    // Iterator over the enclosed array of values. Only used when the enclosed value is an iterable
    // in which case we return an array of multivalues. the i-th element of the array 
    // contains the multivalue that contains all i-th elements of all arrays in the multivalue 
    [Symbol.iterator]() {
        assert(this.karousos_value[0] instanceof Array);
        if (this.collapsed) return this.karousos_value;
        let res = [];
        for (let i = 0; i < Math.max(this.karousos_value.map(x => x.length)); i++) {
            res.push(createMultivalue(this.karousos_value.map(x => x[i])))
        }
        return res;
    }

}

exports.Multivalue = Multivalue;

// Checks if all the elements in the input array are equal
function allEqual(arr) {
    assert(arr instanceof Array || typeof arr === 'array');
    assert(arr.length != 0)
    for (let i = 0; i < arr.length - 1; i++) {
        if (arr[i] instanceof Date) {
            if (arr[i].getTime() != arr[i + 1].getTime()) {
                return false;
            }
        } else {
            if (!equals(arr[i], arr[i + 1])) {
                return false;
            }
        }
    }
    return true;
}

// Returns the enclosed value of obj if the object is a primitive wrapper
// If it is a multivalue, it creates a new multivalue whose value is obj.karousos_value and returns
// If unpack_array = true and obj is an array, unrwaps all elements in array recursively
// If unpack_obj = true and obj is an array or object, unwraps the elements in obj recursively
// Because some objects are read from the advice and are not converted to primitive objects 
// all objects that have an x property are considered primitive objects
function getValueOf(obj, unpack_array, unpack_obj) {
    if (obj instanceof PrimitiveWrapper || (obj && obj.hasOwnProperty && obj.hasOwnProperty('karousos_x'))) {
        return obj.karousos_x;
    }
    if (obj instanceof Multivalue && obj.isPrimitive) {
        return new Multivalue(obj.karousos_value);
    }
    if (obj instanceof Array && unpack_array) {
        return obj.map(x =>
            x && x.karousos_x ?
            x.karousos_x :
            (x instanceof Multivalue && x.isPrimitive) ? new Multivalue(x.karousos_value) : x
        )
    }
    if (
        unpack_obj &&
        (obj instanceof Object || obj instanceof Array) &&
        obj != undefined &&
        !(obj instanceof require('string_decoder').StringDecoder)
    ) {
        var obj2 = Object.assign(obj, {});
        for (let key in obj) {
            try {
                if (
                    obj[key] instanceof PrimitiveWrapper ||
                    (obj[key] && obj[key].hasOwnProperty && obj[key].hasOwnProperty('karousos_x'))
                ) {
                    obj2[key] = obj[key].karousos_x;
                }
                if (obj[key] instanceof Array) {
                    obj2[key] = getValueOf(obj[key], unpack_array, unpack_obj)
                }
            } catch (err) {
                throw err;
            }
        }
        return obj2;
    }
    return obj;
}

exports.getValueOf = getValueOf;

// Returns the i-th element in the multivalue
function getIthElementInMultivalue(obj, idx) {
    // Check if obj is a primitive wrapper rather than a multivalue
    if (obj instanceof PrimitiveWrapper && obj.karousos_x instanceof Array) {
        obj = obj.karousos_x;
    }
    // If obj is a primitive wrapper that contains a multivalue
    if (obj instanceof PrimitiveWrapper && obj.karousos_x instanceof Multivalue) {
        obj = obj.karousos_x;
    }
    // obj is an array of multivalues so the i-th element is the array of all i-th elements of 
    // all multivalues in obj
    if (obj instanceof Array) {
        let res = [];
        for (var i = 0; i < obj.length; i++) {
            res.push(getIthElementInMultivalue(obj[i], idx));
        }
        return res;
    }
    // if obj is a primitive, the i-th element is the object
    if (isPrimitiveType(obj)) {
        return obj;
    }
    // The input object is an object
    if (!(obj instanceof Multivalue) && !(obj.karousos_value)) {
        // Check if the object is a multivalue and if not return the object
        if (!obj.isMultivalue) {
            return obj;
        }
        // otherwise, the properties of the object are multivalues, and we need to create 
        // a new object by iterating over the properties of the object recursively 
        // and applying this function to each of them
        var obj2 = {};
        var properties = Object.keys(obj);
        for (let i = 0; i < properties.length; i++) {
            if (properties[i] == "isMultivalue") {
                continue;
            }
            var descriptor = Object.getOwnPropertyDescriptor(obj, properties[i]);
            Object.defineProperty(obj2, properties[i], {
                value: getIthElementInMultivalue(obj[properties[i]], idx),
                enumerable: descriptor.enumerable,
                configurable: descriptor.configurable,
                writable: descriptor.writable
            });
        }
        return obj2;
    }
    // If we reach here, the object is a multivalue
    // return undefined if the requested index is not valid
    if (idx < 0 || idx > obj.length - 1) {
        return undefined;
    }
    // If the object is collapsed return the univalue, otherwise return the multivalue
    if (obj.collapsed) return obj.karousos_value;
    return obj.karousos_value[idx];
}

exports.getIthElementInMultivalue = getIthElementInMultivalue;

// checks if the input values is a multivalue
function isMultivalue(val) {
    return val instanceof Multivalue || (val && val['karousos_value'] != undefined);
}
exports.isMultivalue = isMultivalue;

// Check if both val1 and val2 are multivalues
function areMultivalues(val1, val2) {
    return isMultivalue(val1) || isMultivalue(val2);
}

exports.areMultivalues = areMultivalues;

// Create a Multivalue for an input array. 
// For objects create a multivalue for only primitive objects. 
function createMultivalue(arr, no_deep, previous) {
    // Previous is used internally. It corresponds to the previous properties of the object
    // and is used to handle cyclical references
    if (previous == undefined) previous = [];
    try {
        // First, check if all elements in the array are equal and, if so, return the first element 
        // in the array
        assert(arr.length > 0);
        var equal = true;
        for (let i = 1; i < arr.length; i++) {
            if (!equals(arr[i], arr[0], undefined)) {
                equal = false;
            }
        }
        if (equal) {
            return arr[0];
        }
        // Find the first element in the array that in not null or undefined
        // We assume that if one element is primitive, then all are 
        let testForType = arr[0];
        for (let i = 0; i < arr.length; i++) {
            if (arr[i] != null && arr[i] != undefined) {
                testForType = arr[i];
                break;
            }
        }
        var maxLength = 0;
        var elemWithMaxLen;
        // If the elements are primitive types or we don't want to deep dive into the object 
        // and create multivalues for each of its properties, wrap the object in the multivalue
        // and return it
        if (isPrimitiveType(testForType) || no_deep) {
            var res = new Multivalue(arr);
            return res.collapsed ? res.karousos_value : res;
        }
        // if the elements are primitive wrappers then unwrap them, create a new multivalue 
        // with the same object id as the elements and return it
        if (isPrimitiveWrapper(testForType)) {
            var res = new Multivalue(arr.map(x => getValueOf(x)));
            Object.defineProperty(res, 'objID', {
                value: testForType.objID,
                enumerable: false,
                configurable: true,
                writable: true
            });
            return res.collapsed ? res.karousos_value : res;
        }
        // If we reached here the elements in the array are not primitives 
        // check if in the array all the elements are of the same type
        var properties = Object.keys(testForType).sort();
        var allEqualTypes = arr.every(elem =>
            elem != undefined &&
            elem != null &&
            isEqual(Object.keys(elem).sort(), properties) &&
            (
                !testForType.prototype ||
                !elem.prototype ||
                testForType.prototype.constructor == elem.prototype.constructor
            )
        );
        //if not, or they are maps (HACK), create one multivalue
        if (!allEqualTypes || testForType instanceof Map) return new Multivalue(arr);
        //Otherwise, create one object with properties that are multivalues recursively (deep dive)
        var ret = cloneDeep(testForType);
        var isMultivalue = false;
        for (let i = 0; i < properties.length; i++) {
            let propArr = [];
            var skip = false;
            if (testForType[properties[i]] instanceof Multivalue) continue;
            for (let j = 0; j < arr.length; j++) {
                assert(arr[j] != undefined && arr[j] != null);
                // Check if the property points to a value that is already parsed (cyclic object)
                if (previous.indexOf(arr[j][properties[i]]) == -1) {
                    propArr.push(arr[j][properties[i]]);
                } else {
                    skip = true;
                }
            }
            if (skip) {
                continue;
            }
            if (testForType instanceof Object || typeof testForType == "object") {
                var descriptor = Object.getOwnPropertyDescriptor(testForType, properties[i]);
                Object.defineProperty(ret, properties[i], {
                    value: createMultivalue(propArr, false, previous.concat(testForType)),
                    enumerable: descriptor.enumerable,
                    configurable: descriptor.configurable,
                    writable: descriptor.writable
                });
            } else {
                ret[properties[i]] = createMultivalue(propArr);
            }
            if (ret[properties[i]] instanceof Multivalue) {
                isMultivalue = true;
            }
        }
        // Mark the object as a multivalue (that has properties that are multivalues)
        if (ret.isMultivalue == undefined) {
            Object.defineProperty(ret, 'isMultivalue', {
                value: isMultivalue,
                enumerable: false,
            })
        }
        return ret;
    } catch (err) {
        console.log("value is arr", arr);
        console.log(err);
        process.exit();
    }
}

exports.createMultivalue = createMultivalue;

function isPrimitiveWrapper(obj) {
    return obj instanceof PrimitiveWrapper ||
        (obj != undefined && obj.hasOwnProperty && obj.hasOwnProperty("karousos_x"));
}

// Check if two objects are equal. Hacked and special cased
function equals(obj1, obj2) {
    let obj_comp1 = isPrimitiveWrapper(obj1) ? obj1.karousos_x : obj1;
    let obj_comp2 = isPrimitiveWrapper(obj2) ? obj2.karousos_x : obj2;
    if (
        obj_comp1 != undefined &&
        obj_comp2 != undefined &&
        obj_comp1 instanceof Array &&
        obj_comp2 instanceof Array
    ) {
        if (obj_comp1.length != obj_comp2.length) return false;
        for (let i = 0; i < obj_comp1.length; i++) {
            if (!equals(obj_comp1[i], obj_comp2[i])) return false
        }
        return true;
    }
    return isEqual(obj_comp1, obj_comp2);
}

// Executes a call taking care of multivalues
function executeCall(
    isNew,
    thisArgNotNull,
    thisArg,
    method,
    fn,
    args,
    createMultivalue_safe
) {
    thisArg = getValueOf(thisArg);
    // handle calls to getters and setters by just calling them if they are user-defined
    if ((method == "get" || method == "set") && fn.toString().indexOf('requestID') > 0) {
        return isNew ? new fn.call(thisArg, ...args) : fn.call(thisArg, ...args);
    }
    // check if all arguments are multivalues
    let testRes = arrayNotMultivalue(args);
    if (testRes[0]) {
        // If they are not:
        // If "this" argument is null then just call the function
        if (!thisArgNotNull) return isNew ? new fn(...args) : fn(...args);
        // Othrewise, if "this" is not a multivalue call the function on the arguments
        if (!isMultivalue(thisArg)) {
            return isNew ? new thisArg[method](...args) : thisArg[method](...args);
        }
        // otherwise, execute the call for each of the values of "this", and collect the 
        // result in a multivalue. Return the result
        var res = [];
        for (let i = 0; i < thisArg.karousos_value.length; i++) {
            res.push(thisArg.karousos_value[i][method](...args));
        }
        return createMultivalue_safe(res);
    }
    // If we reach here the arguments are multivalues
    let length = testRes[1];
    // Get the arguments for each request
    var newArgsPerReq = getArgsPerRequest(args, length);
    var res = new Array(length);
    // call the function for each request and collect the arguments in a multivalue
    for (let i = 0; i < length; i++) {
        res[i] = isNew ? new fn(...newArgsPerReq[i]) : thisArgNotNull ?
            thisArg instanceof Multivalue ? thisArg.karousos_value[i][method](...newArgsPerReq[i]) : thisArg[method](...newArgsPerReq[i]) :
            fn(...newArgsPerReq[i]);
    }
    var result = createMultivalue_safe(res, false);
    return result;
}

exports.executeCall = executeCall;

// Checks if the given array is a multivalue. If it is, it returns the length of the multivalue 
function arrayNotMultivalue(arr) {
    for (let i = 0; i < arr.length; i++) {
        if (arr[i] && (arr[i] instanceof Multivalue || arr[i].karousos_value)) {
            return [false, arr[i].karousos_value.length];
        }
    }
    return [true];
}

// Gets as input the arguments and returns and array where the i-th entry contains all arguments 
// of the i-th request
function getArgsPerRequest(arr, length) {
    var newArgs = new Array(length);
    for (let i = 0; i < length; i++) {
        newArgs[i] = new Array(arr.length);
        for (let j = 0; j < arr.length; j++) {
            if (arr[j] instanceof Multivalue || arr[j].karousos_value) {
                newArgs[i][j] = arr[j].karousos_value[i]
            } else if (Object.keys(arr[j]).some(key => arr[j][key] instanceof Multivalue)) {
                newArgs[i][j] = {};
                for (let key of Object.keys(arr[j])) {
                    if (arr[j][key] instanceof Multivalue) {
                        newArgs[i][j][key] = arr[j][key].karousos_value[i]
                    } else {
                        newArgs[i][j][key] = arr[j][key];
                    }
                }
            } else {
                newArgs[i][j] = arr[j];
            }
        }
    }
    return newArgs;
}