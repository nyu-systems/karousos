"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var Comparison;
(function (Comparison) {
    Comparison["eq"] = "eq";
    Comparison["ne"] = "ne";
    Comparison["gt"] = "gt";
    Comparison["lt"] = "lt";
    Comparison["ge"] = "ge";
    Comparison["le"] = "le";
})(Comparison || (Comparison = {}));
var Logical;
(function (Logical) {
    Logical["and"] = "and";
    Logical["or"] = "or";
    Logical["not"] = "not";
})(Logical || (Logical = {}));
class LambdaQueryFilter {
    constructor() {
        this.expressions = [];
        this.mode = Logical.and;
    }
    /** join multiple filters together with a logical NOT */
    static not(...filters) {
        return LambdaQueryFilter.join(Logical.not, ...filters);
    }
    /** join multiple filters together with a logical OR */
    static or(...filters) {
        return LambdaQueryFilter.join(Logical.or, ...filters);
    }
    /** join multiple filters together with a logical AND */
    static and(...filters) {
        return LambdaQueryFilter.join(Logical.and, ...filters);
    }
    static join(mode, ...filters) {
        const qf = new LambdaQueryFilter();
        qf.mode = mode;
        qf.expressions = filters;
        return qf;
    }
    /** append a new filter to this query using a logical AND */
    and(...filters) {
        return this.append(LambdaQueryFilter.and(...filters));
    }
    /** append a new filter to this query using a logical OR */
    or(...filters) {
        return this.append(LambdaQueryFilter.or(...filters));
    }
    /** append a new filter to this query using a logical NOT */
    not(...filters) {
        return this.append(LambdaQueryFilter.not(...filters));
    }
    /** apply the equals operator */
    eq(value) {
        return this.compare(Comparison.eq, value);
    }
    /** apply the not-equal operator */
    ne(value) {
        return this.compare(Comparison.ne, value);
    }
    /** apply the greater-than operator */
    gt(value) {
        return this.compare(Comparison.gt, value);
    }
    /** apply the less-than operator */
    lt(value) {
        return this.compare(Comparison.lt, value);
    }
    /** apply the greater-than-or-equal-to operator */
    ge(value) {
        return this.compare(Comparison.ge, value);
    }
    /** apply the less-than-or-equal-to operator */
    le(value) {
        return this.compare(Comparison.le, value);
    }
    /** apply the search.in filter */
    in(values, separator = '|') {
        values = values.map((x) => x.replace(`'`, `\\'`));
        this.append((x) => `search.in(${x}, '${values.join(separator)}', '${separator}')`);
        return this;
    }
    /** return filter as a string */
    toString(variable) {
        const ops = this.expressions
            .filter((x) => x)
            .map((x) => typeof (x) === 'function' ? x(variable) : `${x.toString(variable)}`)
            .filter((x) => x.trim())
            .map((x) => `(${x})`)
            .map((x) => this.isUnary() ? ` ${this.mode} ${x} ` : x);
        return ops.length ? ops.join(this.isUnary() ? ' ' : ` ${this.mode} `) : '';
    }
    compare(op, value) {
        return this.append((x) => `${x} ${op} ${this.prepValue(value)}`);
    }
    prepValue(value) {
        return `'${value.replace(`'`, `\\'`)}'`;
    }
    append(expression) {
        this.expressions.push(expression);
        return this;
    }
    isUnary() {
        return this.mode === Logical.not;
    }
}
exports.LambdaQueryFilter = LambdaQueryFilter;
//# sourceMappingURL=lambda-query-filter.js.map