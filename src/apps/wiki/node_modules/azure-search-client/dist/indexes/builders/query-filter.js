"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const lambda_query_filter_1 = require("./lambda-query-filter");
var Logical;
(function (Logical) {
    Logical["and"] = "and";
    Logical["or"] = "or";
    Logical["not"] = "not";
})(Logical = exports.Logical || (exports.Logical = {}));
var Comparison;
(function (Comparison) {
    Comparison["eq"] = "eq";
    Comparison["ne"] = "ne";
    Comparison["gt"] = "gt";
    Comparison["lt"] = "lt";
    Comparison["ge"] = "ge";
    Comparison["le"] = "le";
})(Comparison || (Comparison = {}));
const LAMBDA_VAR = 'x';
var GeoComparison;
(function (GeoComparison) {
    GeoComparison["gt"] = "gt";
    GeoComparison["lt"] = "lt";
    GeoComparison["ge"] = "ge";
    GeoComparison["le"] = "le";
})(GeoComparison = exports.GeoComparison || (exports.GeoComparison = {}));
/** Construct a filter string to be used with Azure Search */
class QueryFilter {
    constructor(mode = Logical.and) {
        this.mode = mode;
        this.expressions = [];
    }
    /** join multiple filters together with a logical NOT */
    static not(...filters) {
        return QueryFilter.join(Logical.not, ...filters);
    }
    /** join multiple filters together with a logical OR */
    static or(...filters) {
        return QueryFilter.join(Logical.or, ...filters);
    }
    /** join multiple filters together with a logical AND */
    static and(...filters) {
        return QueryFilter.join(Logical.and, ...filters);
    }
    static join(mode, ...filters) {
        const qf = new QueryFilter();
        qf.mode = mode;
        qf.expressions = filters;
        return qf;
    }
    /** append a new filter to this query using a logical AND */
    and(...filters) {
        return this.append(QueryFilter.and(...filters));
    }
    /** append a new filter to this query using a logical OR */
    or(...filters) {
        return this.append(QueryFilter.or(...filters));
    }
    /** append a new filter to this query using a logical NOT */
    not(...filters) {
        return this.append(QueryFilter.not(...filters));
    }
    /** apply the equals operator */
    eq(field, value) {
        return this.compare(Comparison.eq, field, value);
    }
    /** apply the not-equal operator */
    ne(field, value) {
        return this.compare(Comparison.ne, field, value);
    }
    /** apply the greater-than operator */
    gt(field, value) {
        return this.compare(Comparison.gt, field, value);
    }
    /** apply the less-than operator */
    lt(field, value) {
        return this.compare(Comparison.lt, field, value);
    }
    /** apply the greater-than-or-equal-to operator */
    ge(field, value) {
        return this.compare(Comparison.ge, field, value);
    }
    /** apply the less-than-or-equal-to operator */
    le(field, value) {
        return this.compare(Comparison.le, field, value);
    }
    /** apply the search.in filter */
    in(field, values, separator = '|') {
        values = values.map((x) => x.replace(`'`, `\\'`));
        this.append(`search.in(${field}, '${values.join(separator)}', '${separator}')`);
        return this;
    }
    /**
     * Evaluates search query as a part of a filter expression
     * @param search the search query (in either simple or full query syntax).
     * @param searchFields searchable fields to search in, defaults to all searchable fields in the index.
     * @param queryType "simple" or "full", defaults to "simple". Specifies what query language was used in the search parameter.
     * @param searchMode "any" or "all", defaults to "any". Indicates whether any or all of the search terms must be matched in order to count the document as a match.
     */
    isMatch(search, searchFields, queryType, searchMode) {
        const params = [search, searchFields ? searchFields.join(',') : null, queryType, searchMode]
            .filter((x) => !!x)
            .map((x) => `'${x.replace(/'/g, `\'`)}'`)
            .join(', ');
        this.append(`search.ismatch(${params})`);
        return this;
    }
    /**
     * Evaluates search query as a part of a filter expression (with relevance score of documents matching this filter contributing to the overall document score)
     * @param search the search query (in either simple or full query syntax).
     * @param searchFields searchable fields to search in, defaults to all searchable fields in the index.
     * @param queryType "simple" or "full", defaults to "simple". Specifies what query language was used in the search parameter.
     * @param searchMode "any" or "all", defaults to "any". Indicates whether any or all of the search terms must be matched in order to count the document as a match.
     */
    isMatchScoring(search, searchFields, queryType, searchMode) {
        const params = [search, searchFields ? searchFields.join(',') : null, queryType, searchMode]
            .filter((x) => !!x)
            .map((x) => `'${x.replace(/'/g, `\'`)}'`)
            .join(', ');
        this.append(`search.ismatchscoring(${params})`);
        return this;
    }
    /**
     * Filter string collection such that any member may match a predicate
     * @param field index field name
     * @param filter optional lambda filter. If omitted, the filter will return true if the collection has at least 1 item.
     */
    any(field, filter) {
        const expression = filter ? filter(new lambda_query_filter_1.LambdaQueryFilter()) : null;
        this.append(`${field}/any(${LAMBDA_VAR}: ${expression ? expression.toString(LAMBDA_VAR) : ''})`);
        return this;
    }
    /**
     * Filter string collection such that all members must match a predicate
     * @param field index field name
     * @param filter optional lambda filter. If omitted, the filter will return true if the collection has at least 1 item.
     */
    all(field, filter) {
        const expression = filter ? filter(new lambda_query_filter_1.LambdaQueryFilter()) : null;
        this.append(`${field}/all(${LAMBDA_VAR}: ${expression ? expression.toString(LAMBDA_VAR) : ''})`);
        return this;
    }
    /** apply a field reference filter */
    field(fieldName) {
        this.append(fieldName);
        return this;
    }
    /**
     * Returns the distance in kilometers between two points, one being a field and one being a constant passed as part of the filter.
     * @param field index field name
     * @param point [lat, lon]
     * @param op comparison operator
     * @param value comparison operand
     */
    geoDistance(field, point, op, value) {
        this.append(`geo.distance(${field}, geography'POINT(${point[0]} ${point[1]})') ${op} ${value}`);
        return this;
    }
    /**
     * Returns true if a given point is within a given polygon, where the point is a field and the polygon is specified as a constant passed as part of the filter.
     * @param field index field name
     * @param polygon array of [lat, lon]
     */
    geoIntersects(field, polygon) {
        const points = polygon
            .map(([x, y]) => `${x} ${y}`)
            .join(', ');
        this.append(`geo.intersects(${field}, geography'POLYGON((${points}))')`);
        return this;
    }
    /** return filter as a string */
    toString() {
        const ops = this.expressions
            .filter((x) => x)
            .map((x) => typeof (x) === 'string' ? x : `${x.toString()}`)
            .filter((x) => x.trim())
            .map((x) => `(${x})`)
            .map((x) => this.isUnary() ? ` ${this.mode} ${x} ` : x);
        return ops.length ? ops.join(this.isUnary() ? ' ' : ` ${this.mode} `) : '';
    }
    compare(op, field, value) {
        return this.append(`${field} ${op} ${this.prepValue(value)}`);
    }
    append(expression) {
        this.expressions.push(expression);
        return this;
    }
    prepValue(value) {
        if (typeof value === 'string') {
            value = `'${value.replace(`'`, `\\'`)}'`;
        }
        else if (value instanceof Date) {
            value = value.toISOString();
        }
        return value;
    }
    isUnary() {
        return this.mode === Logical.not;
    }
}
exports.QueryFilter = QueryFilter;
//# sourceMappingURL=query-filter.js.map