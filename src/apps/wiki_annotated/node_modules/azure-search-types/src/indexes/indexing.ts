import { List } from "..";
import { Document } from './search';

export enum IndexAction {
  upload = 'upload',
  merge = 'merge',
  mergeOrUpload = 'mergeOrUpload',
  delete = 'delete',
}

export interface IndexingResult {
  key: string;
  status: boolean;
  errorMessage: string;
}

export interface IndexingResults extends List<IndexingResult> {
}

export interface IndexDocument {
  '@search.action'?: IndexAction;
}

export interface IndexBatch<T extends Document = Document> extends List<T & IndexDocument> {
}
