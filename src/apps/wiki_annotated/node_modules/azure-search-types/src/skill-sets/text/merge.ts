import { SkillBase, SkillTypeText } from "..";

export enum MergeInput {
  text = 'text',
  itemsToInsert = 'itemsToInsert',
  offsets = 'offsets',
}

export enum MergeOutput {
  mergedText = 'mergedText',
}

export interface MergeSkill extends SkillBase<SkillTypeText.merge, MergeInput, MergeOutput> {
  insertPreTag?: string;
  insertPostTag?: string;
}
