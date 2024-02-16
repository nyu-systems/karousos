import { Language, SkillBase, SkillTypeVision } from "..";

export enum ImageAnalysisInput {
  image = 'image',
}

export enum ImageAnalysisOutput {
  categories = 'categories',
  tags = 'tags',
  description = 'description',
  faces = 'faces',
  imageType = 'imageType',
  color = 'color',
  adult = 'adult',
}

export enum VisualFeature {
  categories = 'categories',
  tags = 'tags',
  description = 'Description',
  faces = 'Faces',
  imageType = 'ImageType',
  color = 'Color',
  adult = 'Adult',
}

export enum ImageDetail {
  Celebrities,
  Landmarks,
}

export interface ImageAnalysisSkill extends SkillBase<SkillTypeVision.imageAnalysis, ImageAnalysisInput, ImageAnalysisOutput> {
  defaultLanguageCode?: Language;
  visualFeatures: VisualFeature[];
  details: ImageDetail[];
}
