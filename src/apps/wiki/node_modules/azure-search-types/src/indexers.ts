import { IndexingResult, Options } from ".";

export enum BlobParsingMode {
  text = 'text',
  delimitedText = 'delimitedText',
  json = 'json',
  jsonArray = 'jsonArray',
}

export enum DataToExtract {
  storageMetadata = 'storageMetadata',
  allMetadata = 'allMetadata',
  contentAndMetadata = 'contentAndMetadata',
}

export enum ImageAction {
  none = 'none',
  generateNormalizedImages = 'generateNormalizedImages',
}

export interface IndexerSchedule {
  interval: string;
  startTime?: string;
}

export interface IndexerParameters {
  maxFailedItems?: number;
  maxFailedItemsPerBatch?: number;
  batchSize?: number;
}

export interface IndexerBlobParameters extends IndexerParameters {
  parsingMode?: BlobParsingMode;

  /** comma separated */
  excludedFileNameExtensions?: string;

  /** comma separated */
  indexedFileNameExtensions?: string;

  failOnUnsupportedContentType?: boolean;
  failOnUnprocessableDocument?: boolean;
  indexStorageMetadataOnlyForOversizedDocuments?: boolean;
  delimitedTextHeaders: string;
  delimitedTextDelimiter: string;
  firstLineContainsHeaders: boolean;
  documentRoot: string;
  dataToExtract: DataToExtract;
  imageAction: ImageAction;
}

export interface IndexerSqlParameters extends IndexerParameters {
  queryTimeout?: string;
}

export interface FieldMapping {
  sourceFieldName: string;
  targetFieldName: string;
}

export interface FieldMappingWithFunction extends FieldMapping {
  mappingFunction?: IndexerMappingFunction;
}

export interface IndexerMappingFunction {
  name: string;
  parameters?: Options;
}

export interface Indexer {
  name: string;
  description?: string;
  dataSourceName: string;
  targetIndexName: string;
  skillsetName?: string;
  schedule?: IndexerSchedule;
  parameters?: IndexerParameters | IndexerBlobParameters | IndexerSqlParameters;
  fieldMappings?: FieldMappingWithFunction[];
  outputFieldMappings?: FieldMapping[];
  disabled?: boolean;
}

export interface IndexerResult {
  status: string;
  errorMessage: string;
  startTime: string;
  endTime: string;
  errors: IndexerError[];
  warnings: IndexerWarning[];
  itemsProcessed: number;
  itemsFailed: number;
  initialTrackingState: any;
  finalTrackingState: any;
}
export interface IndexerError extends IndexingResult {
  statusCode: number;
}
export interface IndexerWarning {
  key: string;
  message: string;
}
export interface IndexerStatusResult {
  status: string;
  lastResult: IndexerResult;
  executionHistory: IndexerResult[];
}
