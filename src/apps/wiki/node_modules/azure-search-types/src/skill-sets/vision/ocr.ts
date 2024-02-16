import { SkillBase, SkillTypeVision } from "..";
import { Language } from "../text";

export enum OcrInput {
  image = 'image',
}

export enum OcrOutput {
  text = 'text',
  layoutText = 'layoutText',
}

export enum TextExtractionAlgorithm {
  printed = 'printed',
  handwritten = 'handwritten',
}

export interface OcrSkill extends SkillBase<SkillTypeVision.ocr, OcrInput, OcrOutput> {
  defaultLanguageCode?: Language;
  detectOrientation?: boolean;
  textExtractionAlgorithm: TextExtractionAlgorithm;
}
