import { OData } from "../../..";

export type CharFilterName = PrebuiltCharFilterName | string;
export type CharFilter = MappingCharFilter | PatternReplaceCharFilter;

export enum PrebuiltCharFilterName {
  htmlStrip = 'html_strip',
  mapping = 'mapping',
  patternReplace = 'pattern_replace',
}

export enum CharFilterType {
  mapping = '#Microsoft.Azure.Search.MappingCharFilter',
  patternReplace = '#Microsoft.Azure.Search.PatternReplaceCharFilter',
}

export interface MappingCharFilter extends OData<CharFilterType.mapping> {
  mappings: string[];
}

export interface PatternReplaceCharFilter extends OData<CharFilterType.patternReplace> {
  pattern: string;
  replacement: string;
}
