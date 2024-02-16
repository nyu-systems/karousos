import { Language, SkillBase, SkillTypeVision } from "..";
export declare enum ImageAnalysisInput {
    image = "image"
}
export declare enum ImageAnalysisOutput {
    categories = "categories",
    tags = "tags",
    description = "description",
    faces = "faces",
    imageType = "imageType",
    color = "color",
    adult = "adult"
}
export declare enum VisualFeature {
    categories = "categories",
    tags = "tags",
    description = "Description",
    faces = "Faces",
    imageType = "ImageType",
    color = "Color",
    adult = "Adult"
}
export declare enum ImageDetail {
    Celebrities = 0,
    Landmarks = 1
}
export interface ImageAnalysisSkill extends SkillBase<SkillTypeVision.imageAnalysis, ImageAnalysisInput, ImageAnalysisOutput> {
    defaultLanguageCode?: Language;
    visualFeatures: VisualFeature[];
    details: ImageDetail[];
}
