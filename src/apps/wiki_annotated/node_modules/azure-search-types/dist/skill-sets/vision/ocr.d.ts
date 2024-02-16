import { SkillBase, SkillTypeVision } from "..";
import { Language } from "../text";
export declare enum OcrInput {
    image = "image"
}
export declare enum OcrOutput {
    text = "text",
    layoutText = "layoutText"
}
export declare enum TextExtractionAlgorithm {
    printed = "printed",
    handwritten = "handwritten"
}
export interface OcrSkill extends SkillBase<SkillTypeVision.ocr, OcrInput, OcrOutput> {
    defaultLanguageCode?: Language;
    detectOrientation?: boolean;
    textExtractionAlgorithm: TextExtractionAlgorithm;
}
