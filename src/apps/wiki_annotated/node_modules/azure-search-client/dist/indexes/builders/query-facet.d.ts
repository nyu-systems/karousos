import { FieldName } from "./query-builder";
export declare enum FacetDateInterval {
    minute = "minute",
    hour = "hour",
    day = "day",
    week = "week",
    month = "month",
    quarter = "quarter",
    year = "year"
}
export declare class QueryFacet<TDocument = any> {
    private field;
    private params;
    constructor(field: FieldName<TDocument>);
    /**
     * Set the max number of facet terms
     * @param maxFacetTerms maximum number of facet terms to return
     */
    count(maxFacetTerms: number): this;
    /**
     * Sort facet terms by number of occurences
     * @param dir sort direction
     */
    sortByCount(dir?: 'asc' | 'desc'): this;
    /**
     * Sort facet terms alphabetically
     * @param dir sort direction
     */
    sortByValue(dir?: 'asc' | 'desc'): this;
    /**
     * Assign facet values to a dynamic set of buckets
     * @param values list of values against which facet values will be partitioned
     */
    values(...values: Array<number | Date>): this;
    /**
     * Assign fact values to a static set of buckets
     * @param value size of each bucket
     */
    interval(value: number | FacetDateInterval): this;
    /**
     * Set the UTC time offset to account for time boundaries
     * @param hours offset hours (may be negative)
     * @param minutes optional offset minutes
     */
    timeoffset(hours: number, minutes?: number): this;
    /**
     * Return the facet string directive
     */
    toString(): string;
}
