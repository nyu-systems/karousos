"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const query_facet_1 = require("./query-facet");
const query_filter_1 = require("./query-filter");
/** Construct a query object to be used with Azure Search */
class QueryBuilder {
    constructor(index) {
        this.index = index;
        /** The current query value */
        this.query = {};
    }
    /** Apply Lucene-syntax escaping to the search string */
    static escape(search) {
        return search.replace(/(\+|-|\&\&|\|\||!|\(|\)|\{|\}|\[|\]|\^|\"|\~|\*|\?|\:|\\|\/)/g, '\\$1');
    }
    /** Specifies whether to fetch the total count of results  */
    count(enabled = true) {
        this.query.count = enabled;
        return this;
    }
    /** Build a facet expression */
    buildFacet(fieldName, build) {
        return this.facet(build(new query_facet_1.QueryFacet(fieldName)));
    }
    /** A field to facet by (may be called multiple times for multiple fields) */
    facet(...fieldOrExpression) {
        const items = Array.isArray(fieldOrExpression) ? fieldOrExpression : [fieldOrExpression];
        this.query.facets = this.query.facets || [];
        items.forEach((x) => {
            this.query.facets.push(typeof x === 'string' ? x : x.toString());
        });
        return this;
    }
    /** Use a complex facet expression string */
    facetExpression(...expressions) {
        expressions.forEach((x) => {
            this.query.facets.push(x);
        });
        return this;
    }
    /** A structured search expression in standard OData syntax (logical 'and') */
    filter(filter) {
        switch (typeof filter) {
            case 'function':
                return this.filter(filter(new query_filter_1.QueryFilter()));
            case 'object':
                return this.filter(filter.toString());
            case 'string':
                this.query.filter = filter;
                return this;
            default:
                throw new Error('Unsupported filter');
        }
    }
    /** Build a query using logical 'or' */
    filterOr(filter) {
        return this.filter(filter(new query_filter_1.QueryFilter(query_filter_1.Logical.or)));
    }
    /** Build a query using logical 'not' */
    filterNot(filter) {
        return this.filter(filter(new query_filter_1.QueryFilter(query_filter_1.Logical.not)));
    }
    /** Set fields used for hit highlighting */
    highlight(...fields) {
        this.query.highlight = fields.join(',');
        return this;
    }
    /**
     * Set string tags appended to hit highlights
     * @param pre tag before the highlight (default <em>)
     * @param post tag after the highlight (default </em>)
     */
    highlightTag(pre, post) {
        this.query.highlightPreTag = pre;
        this.query.highlightPostTag = post;
        return this;
    }
    /** A number between 0 and 100 indicating the percentage of the index that must be covered by a search query in order for the query to be reported as a success (default 100) */
    minimumCoverage(coverage) {
        this.query.minimumCoverage = coverage;
        return this;
    }
    /** Set ordering for a field (may be called multiple times for multiple fields) */
    orderbyAsc(field) {
        return this.orderby(field, 'asc');
    }
    /** Set ordering for a field (may be called multiple times for multiple fields) */
    orderbyDesc(field) {
        return this.orderby(field, 'desc');
    }
    /** Set ordering based on distance */
    orderByGeoDistance(field, point, dir = 'asc') {
        return this.orderby(`geo.distance(${field}, geography'POINT(${point[0]} ${point[1]})')`, dir);
    }
    /** Sort by search score */
    orderByScore(dir = 'desc') {
        return this.orderby('search.score()', dir);
    }
    /**
     * Add a scoring parameter
     * @param name parameter name
     * @param values parameter values (unescaped)
     */
    scoringParameter(name, ...values) {
        const valuesText = values.map((x) => `'${x.replace(`'`, `''`)}'`).join(',');
        this.query.scoringParameters = this.query.scoringParameters || [];
        this.query.scoringParameters.push(`${name}-${values}`);
        return this;
    }
    /**
     * The name of a scoring profile to evaluate match scores for matching documents in order to sort the results.
     */
    scoringProfile(profile) {
        this.query.scoringProfile = profile;
        return this;
    }
    /**
     * The text to search for
     */
    search(search) {
        this.query.search = search;
        return this;
    }
    /**
     * Field names to search for the specified text
     */
    searchFields(...fields) {
        this.query.searchFields = fields.join(',');
        return this;
    }
    /**
     * Specifies whether any or all of the search terms must be matched in order to count the document as a match (default any)
     */
    searchMode(mode) {
        this.query.searchMode = mode;
        return this;
    }
    /**
     * Fields to include in the result set
     */
    select(...fields) {
        this.query.select = fields.join(',');
        return this;
    }
    /**
     * The number of search results to skip (max 100,000)
     */
    skip(skip) {
        this.query.skip = skip;
        return this;
    }
    /**
     * The number of search results to retrieve (default 50).
     * If you specify a value greater than 1000 and there are more than 1000 results, only the first 1000 results will be returned, along with a link to the next page of results.
     */
    top(top) {
        this.query.top = top;
        return this;
    }
    /**
     * When set to simple, search text is interpreted using a simple query language that allows for symbols such as +, * and "".
     * When the query type is set to full, search text is interpreted using the Lucene query language which allows field-specific and weighted searches.
     */
    queryType(type) {
        this.query.queryType = type;
        return this;
    }
    /**
     * Execute the search query and return results (must pass an ISearchIndex in the QueryBuilder constructor)
     * @param options optional search options
     */
    executeQuery(options) {
        if (!this.index) {
            throw new Error('Cannot execute QueryBuilder without an index. Supply an ISearchIndex in the constructor');
        }
        return this.index.search(this.query, options);
    }
    orderby(expression, dir) {
        this.query.orderby = this.query.orderby
            ? this.query.orderby + ','
            : '';
        this.query.orderby += `${expression} ${dir}`;
        return this;
    }
}
exports.QueryBuilder = QueryBuilder;
//# sourceMappingURL=query-builder.js.map