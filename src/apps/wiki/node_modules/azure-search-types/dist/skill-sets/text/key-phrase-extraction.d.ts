import { Language } from ".";
import { SkillBase, SkillTypeText } from "..";
export declare enum KeyPhraseExtractionInput {
    text = "text",
    languageCode = "languageCode"
}
export declare enum KeyPhraseExtractionOutput {
    keyPhrases = "keyPhrases"
}
export interface KeyPhraseExtractionSkill extends SkillBase<SkillTypeText.keyPhraseExtraction, KeyPhraseExtractionInput, KeyPhraseExtractionOutput> {
    defaultLanguageCode?: Language;
    maxKeyPhraseCount?: number;
}
