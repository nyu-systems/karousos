import { Language } from ".";
import { SkillBase, SkillTypeText } from "..";
export declare enum SentimentInput {
    text = "text",
    languageCode = "languageCode"
}
export declare enum SentimentOutput {
    score = "score"
}
export interface SentimentSkill extends SkillBase<SkillTypeText.sentiment, SentimentInput, SentimentOutput> {
    defaultLanguageCode?: Language;
}
