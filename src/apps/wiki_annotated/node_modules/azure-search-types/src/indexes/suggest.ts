import { Document } from ".";
import { List } from "..";

export interface SuggestQuery {
  filter?: string;
  fuzzy?: boolean;
  highlightPreTag?: string;
  highlightPostTag?: string;
  minimumCoverage?: number;
  orderby?: string;
  search?: string;
  searchFields?: string;
  select?: string;
  top?: number;
}

export interface SuggestResults<T extends Document = Document> extends List<T & SuggestDocument> {
  '@search.coverage': number;
}

export interface SuggestDocument {
  '@search.text': string;
}
