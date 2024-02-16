import { Language } from ".";
import { SkillBase, SkillTypeText } from "..";

export enum SentimentInput {
  text = 'text',
  languageCode = 'languageCode',
}

export enum SentimentOutput {
  score = 'score',
}

export interface SentimentSkill extends SkillBase<SkillTypeText.sentiment, SentimentInput, SentimentOutput> {
  defaultLanguageCode?: Language;
}
