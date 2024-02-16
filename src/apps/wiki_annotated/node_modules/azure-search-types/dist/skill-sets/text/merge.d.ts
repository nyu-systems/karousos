import { SkillBase, SkillTypeText } from "..";
export declare enum MergeInput {
    text = "text",
    itemsToInsert = "itemsToInsert",
    offsets = "offsets"
}
export declare enum MergeOutput {
    mergedText = "mergedText"
}
export interface MergeSkill extends SkillBase<SkillTypeText.merge, MergeInput, MergeOutput> {
    insertPreTag?: string;
    insertPostTag?: string;
}
