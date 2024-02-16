export type DataChangeDetectionPolicy = HighWaterMarkPolicy | SqlIntegratedPolicy;
export type DataDeletionDetectionPolicy = SoftDeletePolicy;

export enum DataSourceChangePolicy {
  highWaterMark = '#Microsoft.Azure.Search.HighWaterMarkChangeDetectionPolicy',
  sqlIntegrated = '#Microsoft.Azure.Search.SqlIntegratedChangeTrackingPolicy',
}

export enum DataSourceDeletePolicy {
  soft = '#Microsoft.Azure.Search.SoftDeleteColumnDeletionDetectionPolicy',
}

export enum DataSourceType {
  sql = 'azuresql',
  documentDb = 'documentdb',
  blob = 'azureblob',
  table = 'azuretable',
}

export interface HighWaterMarkPolicy {
  type: DataSourceChangePolicy.highWaterMark;
  highWaterMarkColumnName: string;
}

export interface SqlIntegratedPolicy {
  type: DataSourceChangePolicy.sqlIntegrated;
}

export interface SoftDeletePolicy {
  type: DataSourceDeletePolicy.soft;
  softDeleteColumnName: string;
  softDeleteMarkerValue: string;
}

export interface DataSourceCredentials {
  connectionString: string;
}
export interface DataSourceContainer {
  name: string;
  query?: string;
}

export interface DataSource {
  name: string;
  type: DataSourceType;
  description?: string;
  credentials: DataSourceCredentials;
  container: DataSourceContainer;
  dataChangeDetectionPolicy?: DataChangeDetectionPolicy;
  dataDeletionDetectionPolicy?: DataDeletionDetectionPolicy;
}
