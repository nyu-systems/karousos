import { SkillBase } from ".";

export enum SkillTypeUtil {
  shaper = '#Microsoft.Skills.Util.ShaperSkill',
}

export interface ShaperSkill extends SkillBase<SkillTypeUtil.shaper, string, string> {
}
