import { Language, SkillBase, SkillTypeText } from "..";

export enum EntityRecognitionInput {
  languageCode = 'languageCode',
  text = 'text',
}

export enum EntityRecognitionOutput {
  persons = 'persons',
  locations = 'locations',
  organizations = 'organizations',
  quantities = 'quantities',
  dateTimes = 'dateTimes',
  urls = 'urls',
  emails = 'emails',
  namedEntities = 'namedEntities',
  entities = 'entities',
}

export enum Category {
  person = 'Person',
  location = 'Location',
  organization = 'Organization',
  quantity = 'Quantity',
  datetime = 'Datetime',
  url = 'URL',
  email = 'Email',
}

export interface EntityRecognitionSkill extends SkillBase<SkillTypeText.entityRecognition, EntityRecognitionInput, EntityRecognitionOutput> {
  categories?: Category[];
  defaultLanguageCode?: Language;

  /** Ignored. reserved for future use */
  minimumPrecision?: string;
  includeTypelessEntites?: boolean;
}
