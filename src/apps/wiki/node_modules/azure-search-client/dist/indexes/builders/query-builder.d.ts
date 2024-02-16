import { QueryType, SearchMode } from 'azure-search-types';
import { SearchOptions } from '../../types';
import { DocumentParseOptions, Query, SearchIndex } from '../search-index';
import { QueryFacet } from './query-facet';
import { QueryFilter } from './query-filter';
export declare type FieldName<TDocument> = Extract<keyof TDocument, string>;
/** Construct a query object to be used with Azure Search */
export declare class QueryBuilder<TDocument = any> {
    private index?;
    /** Apply Lucene-syntax escaping to the search string */
    static escape(search: string): string;
    /** The current query value */
    readonly query: Query;
    constructor(index?: SearchIndex<TDocument>);
    /** Specifies whether to fetch the total count of results  */
    count(enabled?: boolean): this;
    /** Build a facet expression */
    buildFacet(fieldName: FieldName<TDocument>, build: (builder: QueryFacet<TDocument>) => QueryFacet<TDocument>): this;
    /** A field to facet by (may be called multiple times for multiple fields) */
    facet<K extends FieldName<TDocument>>(...fieldOrExpression: Array<K | QueryFacet<TDocument>>): this;
    /** Use a complex facet expression string */
    facetExpression(...expressions: string[]): this;
    /** A structured search expression in standard OData syntax (logical 'and') */
    filter(filter: string | QueryFilter<TDocument> | ((builder: QueryFilter<TDocument>) => QueryFilter<TDocument>)): this;
    /** Build a query using logical 'or' */
    filterOr(filter: (builder: QueryFilter<TDocument>) => QueryFilter<TDocument>): this;
    /** Build a query using logical 'not' */
    filterNot(filter: (builder: QueryFilter<TDocument>) => QueryFilter<TDocument>): this;
    /** Set fields used for hit highlighting */
    highlight<K extends FieldName<TDocument>>(...fields: K[]): this;
    /**
     * Set string tags appended to hit highlights
     * @param pre tag before the highlight (default <em>)
     * @param post tag after the highlight (default </em>)
     */
    highlightTag(pre: string, post: string): this;
    /** A number between 0 and 100 indicating the percentage of the index that must be covered by a search query in order for the query to be reported as a success (default 100) */
    minimumCoverage(coverage: number): this;
    /** Set ordering for a field (may be called multiple times for multiple fields) */
    orderbyAsc<K extends FieldName<TDocument>>(field: K): this;
    /** Set ordering for a field (may be called multiple times for multiple fields) */
    orderbyDesc<K extends FieldName<TDocument>>(field: K): this;
    /** Set ordering based on distance */
    orderByGeoDistance<K extends FieldName<TDocument>>(field: K, point: [number, number], dir?: 'asc' | 'desc'): this;
    /** Sort by search score */
    orderByScore(dir?: 'asc' | 'desc'): this;
    /**
     * Add a scoring parameter
     * @param name parameter name
     * @param values parameter values (unescaped)
     */
    scoringParameter(name: string, ...values: string[]): this;
    /**
     * The name of a scoring profile to evaluate match scores for matching documents in order to sort the results.
     */
    scoringProfile(profile: string): this;
    /**
     * The text to search for
     */
    search(search: string): this;
    /**
     * Field names to search for the specified text
     */
    searchFields<K extends FieldName<TDocument>>(...fields: K[]): this;
    /**
     * Specifies whether any or all of the search terms must be matched in order to count the document as a match (default any)
     */
    searchMode(mode: SearchMode): this;
    /**
     * Fields to include in the result set
     */
    select<K extends FieldName<TDocument>>(...fields: K[]): this;
    /**
     * The number of search results to skip (max 100,000)
     */
    skip(skip: number): this;
    /**
     * The number of search results to retrieve (default 50).
     * If you specify a value greater than 1000 and there are more than 1000 results, only the first 1000 results will be returned, along with a link to the next page of results.
     */
    top(top: number): this;
    /**
     * When set to simple, search text is interpreted using a simple query language that allows for symbols such as +, * and "".
     * When the query type is set to full, search text is interpreted using the Lucene query language which allows field-specific and weighted searches.
     */
    queryType(type: QueryType): this;
    /**
     * Execute the search query and return results (must pass an ISearchIndex in the QueryBuilder constructor)
     * @param options optional search options
     */
    executeQuery(options?: SearchOptions & DocumentParseOptions): Promise<import("../search-index").SearchResponse<TDocument>>;
    private orderby;
}
