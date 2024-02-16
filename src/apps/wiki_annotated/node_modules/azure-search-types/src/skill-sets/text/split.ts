import { Language } from ".";
import { SkillBase, SkillTypeText } from "..";

export enum SplitInput {
  text = 'text',
  languageCode = 'languageCode',
}

export enum SplitOutput {
  textItems = 'textItems',
}

export enum TextSplitMode {
  pages = 'pages',
  sentences = 'sentences',
}

export interface SplitSkill extends SkillBase<SkillTypeText.split, SplitInput, SplitOutput> {
  textSplitMode: TextSplitMode;
  maximumPageLength?: number;
  defaultLanguageCode?: Language;
}
