import { Language } from ".";
import { SkillBase, SkillTypeText } from "..";
export declare enum NamedEntityRecognitionInput {
    languageCode = "languageCode",
    text = "text"
}
export declare enum NamedEntityRecognitionOutput {
    persons = "persons",
    locations = "locations",
    organizations = "organizations",
    entities = "entities"
}
export declare enum NamedEntityCategory {
    person = "Person",
    location = "Location",
    organization = "Organization"
}
/** @deprectaed Use `EntityRecognitionSkill` instead */
export interface NamedEntityRecognitionSkill extends SkillBase<SkillTypeText.namedEntityRecognition, NamedEntityRecognitionInput, NamedEntityRecognitionOutput> {
    categories?: NamedEntityCategory[];
    defaultLanguageCode?: Language;
    minimumPrecision?: number;
}
