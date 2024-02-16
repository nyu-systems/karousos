export enum SynonymMapFormat {
  solr = 'solr',
}

export interface SynonymMap {
  name: string;
  format: SynonymMapFormat;
  synonyms: string;
}
