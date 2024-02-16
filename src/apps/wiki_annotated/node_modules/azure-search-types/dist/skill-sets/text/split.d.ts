import { Language } from ".";
import { SkillBase, SkillTypeText } from "..";
export declare enum SplitInput {
    text = "text",
    languageCode = "languageCode"
}
export declare enum SplitOutput {
    textItems = "textItems"
}
export declare enum TextSplitMode {
    pages = "pages",
    sentences = "sentences"
}
export interface SplitSkill extends SkillBase<SkillTypeText.split, SplitInput, SplitOutput> {
    textSplitMode: TextSplitMode;
    maximumPageLength?: number;
    defaultLanguageCode?: Language;
}
