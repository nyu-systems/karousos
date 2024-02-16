import { SkillBase, SkillTypeText } from "..";
export declare enum LanguageDetectionInput {
    text = "text"
}
export declare enum LanguageDetectionOutput {
    languageCode = "languageCode",
    languageName = "languageName",
    score = "score"
}
export interface LanguageDetectionSkill extends SkillBase<SkillTypeText.languageDetection, LanguageDetectionInput, LanguageDetectionOutput> {
}
