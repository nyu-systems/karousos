import { SkillBase, SkillTypeText } from "..";

export enum LanguageDetectionInput {
  text = 'text',
}

export enum LanguageDetectionOutput {
  languageCode = 'languageCode',
  languageName = 'languageName',
  score = 'score',
}

export interface LanguageDetectionSkill extends SkillBase<SkillTypeText.languageDetection, LanguageDetectionInput, LanguageDetectionOutput> {
}
