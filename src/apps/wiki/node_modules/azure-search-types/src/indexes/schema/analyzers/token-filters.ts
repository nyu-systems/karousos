import { OData } from "../../..";

export type TokenFilterName = PrebuiltTokenFilterName | string;
export type TokenFilter = PatternReplaceTokenFilter
  | AsciiFoldingTokenFilter
  | CjkBigramTokenFilter
  | CommonGramTokenFilter
  | DictionaryDecompounderTokenFilter
  | EdgeNGramTokenFilter
  | ElisionTokenFilter
  | KeepTokenFilter
  | KeywordMarkerTokenFilter
  | LengthTokenFilter
  | LimitTokenFilter
  | NGramTokenFilter
  | PatternCaptureTokenFilter
  | PhoneticEncoder
  | ShingleTokenFilter
  | SnowballTokenFilter
  | StemmerTokenFilter
  | StemmerOverrideTokenFilter
  | StopwordsTokenFilter
  | SynonymTokenFilter
  | TruncateTokenFilter
  | UniqueTokenFilter
  | WordDelimiterTokenFilter;

export enum PrebuiltTokenFilterName {
  arabicNormalization = 'arabic_normalization',
  apostrophe = 'apostrophe',
  asciifolding = 'asciifolding',
  cjkBigram = 'cjk_bigram',
  cjkWidth = 'cjk_width',
  classic = 'classic',
  commonGrams = 'common_grams',
  dictionaryDecompounder = 'dictionary_decompounder',
  edgeNGram = 'edgeNGram_v2',
  elision = 'elision',
  germanNormalization = 'german_normalization',
  hindiNormalization = 'hindi_normalization',
  indicNormalization = 'indic_normalization',
  keep = 'keep',
  keywordMarker = 'keyword_marker',
  keywordRepeat = 'keyword_repeat',
  kstem = 'kstem',
  length = 'length',
  limit = 'limit',
  lowercase = 'lowercase',
  nGram = 'nGram_v2',
  patternCapture = 'pattern_capture',
  patternReplace = 'pattern_replace',
  persianNormalization = 'persian_normalization',
  phonetic = 'phonetic',
  porterStem = 'porter_stem',
  reverse = 'reverse',
  scandinavianNormalization = 'scandinavian_normalization',
  scandinavianFolding = 'scandinavian_folding',
  shingle = 'shingle',
  snowball = 'snowball',
  soraniNormalization = 'sorani_normalization',
  stemmer = 'stemmer',
  stemmerOverride = 'stemmer_override',
  stopwords = 'stopwords',
  synonym = 'synonym',
  trim = 'trim',
  truncate = 'truncate',
  unique = 'unique',
  uppercase = 'uppercase',
  wordDelimiter = 'word_delimiter',
}

export enum TokenFilterType {
  asciiFolding = '#Microsoft.Azure.Search.AsciiFoldingTokenFilter',
  cjkBigram = '#Microsoft.Azure.Search.CjkBigramTokenFilter',
  commonGram = '#Microsoft.Azure.Search.CommonGramTokenFilter',
  dictionaryDecompounder = '#Microsoft.Azure.Search.DictionaryDecompounderTokenFilter',
  edgeNGram = '#Microsoft.Azure.Search.EdgeNGramTokenFilterV2',
  elision = '#Microsoft.Azure.Search.ElisionTokenFilter',
  indicNormalization = '#Microsoft.Azure.Search.IndicNormalizationTokenFilter',
  keep = '#Microsoft.Azure.Search.KeepTokenFilter',
  keywordMarker = '#Microsoft.Azure.Search.KeywordMarkerTokenFilter',
  length = '#Microsoft.Azure.Search.LengthTokenFilter',
  limit = '#Microsoft.Azure.Search.LimitTokenFilter',
  nGram = '#Microsoft.Azure.Search.NGramTokenFilterV2',
  patternCapture = '#Microsoft.Azure.Search.PatternCaptureTokenFilter',
  patternReplace = '#Microsoft.Azure.Search.PatternReplaceTokenFilter',
  phonetic = '#Microsoft.Azure.Search.PhoneticTokenFilter',
  shingle = '#Microsoft.Azure.Search.ShingleTokenFilter',
  snowball = '#Microsoft.Azure.Search.SnowballTokenFilter',
  soraniNormalization = '#Microsoft.Azure.Search.SoraniNormalizationTokenFilter',
  stemmer = '#Microsoft.Azure.Search.StemmerTokenFilter',
  stemmerOverride = '#Microsoft.Azure.Search.StemmerOverrideTokenFilter',
  stopwords = '#Microsoft.Azure.Search.StopwordsTokenFilter',
  synonym = '#Microsoft.Azure.Search.SynonymTokenFilter',
  truncate = '#Microsoft.Azure.Search.TruncateTokenFilter',
  unique = '#Microsoft.Azure.Search.UniqueTokenFilter',
  wordDelimiter = '#Microsoft.Azure.Search.WordDelimiterTokenFilter',
}

export enum CjkScript {
  han = 'han',
  hiragana = 'hiragana',
  katakana = 'katakana',
  hangul = 'hangul',
}

export enum NGramSide {
  front = 'front',
  back = 'back',
}

export enum PhoneticEncoder {
  metaphone = 'metaphone',
  doubleMetaphone = 'doubleMetaphone',
  soundex = 'soundex',
  refinedSoundex = 'refinedSoundex',
  caverphone1 = 'caverphone1',
  caverphone2 = 'caverphone2',
  cologne = 'cologne',
  nysiis = 'nysiis',
  koelnerPhonetik = 'koelnerPhonetik',
  haasePhonetik = 'haasePhonetik',
  beiderMorse = 'beiderMorse',
}

export enum SnowballLanguage {
  armenian = 'armenian',
  basque = 'basque',
  catalan = 'catalan',
  danish = 'danish',
  dutch = 'dutch',
  english = 'english',
  finnish = 'finnish',
  french = 'french',
  german = 'german',
  german2 = 'german2',
  hungarian = 'hungarian',
  italian = 'italian',
  kp = 'kp',
  lovins = 'lovins',
  norwegian = 'norwegian',
  porter = 'porter',
  portuguese = 'portuguese',
  romanian = 'romanian',
  russian = 'russian',
  spanish = 'spanish',
  swedish = 'swedish',
  turkish = 'turkish',
}

export enum StemmerLanguage {
  arabic = 'arabic',
  armenian = 'armenian',
  basque = 'basque',
  brazilian = 'brazilian',
  bulgarian = 'bulgarian',
  catalan = 'catalan',
  czech = 'czech',
  danish = 'danish',
  dutch = 'dutch',
  dutchKp = 'dutchKp',
  english = 'english',
  lightEnglish = 'lightEnglish',
  minimalEnglish = 'minimalEnglish',
  possessiveEnglish = 'possessiveEnglish',
  porter2 = 'porter2',
  lovins = 'lovins',
  finnish = 'finnish',
  lightFinnish = 'lightFinnish',
  french = 'french',
  lightFrench = 'lightFrench',
  minimalFrench = 'minimalFrench',
  galician = 'galician',
  minimalGalician = 'minimalGalician',
  german = 'german',
  german2 = 'german2',
  lightGerman = 'lightGerman',
  minimalGerman = 'minimalGerman',
  greek = 'greek',
  hindi = 'hindi',
  hungarian = 'hungarian',
  lightHungarian = 'lightHungarian',
  indonesian = 'indonesian',
  irish = 'irish',
  italian = 'italian',
  lightItalian = 'lightItalian',
  sorani = 'sorani',
  latvian = 'latvian',
  norwegian = 'norwegian',
  lightNorwegian = 'lightNorwegian',
  minimalNorwegian = 'minimalNorwegian',
  lightNynorsk = 'lightNynorsk',
  minimalNynorsk = 'minimalNynorsk',
  portuguese = 'portuguese',
  lightPortuguese = 'lightPortuguese',
  minimalPortuguese = 'minimalPortuguese',
  portugueseRslp = 'portugueseRslp',
  romanian = 'romanian',
  russian = 'russian',
  lightRussian = 'lightRussian',
  spanish = 'spanish',
  lightSpanish = 'lightSpanish',
  swedish = 'swedish',
  lightSwedish = 'lightSwedish',
  turkish = 'turkish',
}

export enum StopwordsList {
  arabic = 'arabic',
  armenian = 'armenian',
  basque = 'basque',
  brazilian = 'brazilian',
  bulgarian = 'bulgarian',
  catalan = 'catalan',
  czech = 'czech',
  danish = 'danish',
  dutch = 'dutch',
  english = 'english',
  finnish = 'finnish',
  french = 'french',
  galician = 'galician',
  german = 'german',
  greek = 'greek',
  hindi = 'hindi',
  hungarian = 'hungarian',
  indonesian = 'indonesian',
  irish = 'irish',
  italian = 'italian',
  latvian = 'latvian',
  norwegian = 'norwegian',
  persian = 'persian',
  portuguese = 'portuguese',
  romanian = 'romanian',
  russian = 'russian',
  sorani = 'sorani',
  spanish = 'spanish',
  swedish = 'swedish',
  thai = 'thai',
  turkish = 'turkish',
}

export interface PatternReplaceTokenFilter extends OData<TokenFilterType.patternReplace> {
  pattern: string;
  replacement: string;
}

export interface AsciiFoldingTokenFilter extends OData<TokenFilterType.asciiFolding> {
  preserveOriginal?: boolean;
}
export interface CjkBigramTokenFilter extends OData<TokenFilterType.cjkBigram> {
  ignoreScripts?: CjkScript[];
  outputUnigrams?: boolean;
}
export interface CommonGramTokenFilter extends OData<TokenFilterType.commonGram> {
  commonWords: string[];
  ignoreCase?: boolean;
  queryMode?: boolean;
}
export interface DictionaryDecompounderTokenFilter extends OData<TokenFilterType.dictionaryDecompounder> {
  wordList: string[];
  minWordSize?: number;
  minSubwordSize?: number;
  maxSubwordSize?: number;
  onlyLongestMatch?: boolean;
}
export interface EdgeNGramTokenFilter extends OData<TokenFilterType.edgeNGram> {
  minGram?: number;
  maxGram?: number;
  side: NGramSide;
}
export interface ElisionTokenFilter extends OData<TokenFilterType.elision> {
  articles?: string[];
}
export interface KeepTokenFilter extends OData<TokenFilterType.keep> {
  keepWords: string[];
  keepWordsCase?: boolean;
}
export interface KeywordMarkerTokenFilter extends OData<TokenFilterType.keywordMarker> {
  keywords: string[];
  ignoreCase?: boolean;
}
export interface LengthTokenFilter extends OData<TokenFilterType.length> {
  min?: number;
  max?: number;
}
export interface LimitTokenFilter extends OData<TokenFilterType.limit> {
  maxTokenCount?: number;
  consumeAllTokens?: boolean;
}
export interface NGramTokenFilter extends OData<TokenFilterType.nGram> {
  minGram?: number;
  maxGram?: number;
}
export interface PatternCaptureTokenFilter extends OData<TokenFilterType.patternCapture> {
  patterns: string[];
  preserveOriginal?: boolean;
}
export interface PhoneticTokenFilter extends OData<TokenFilterType.phonetic> {
  encoder: PhoneticEncoder;
  replace?: boolean;
}
export interface ShingleTokenFilter extends OData<TokenFilterType.shingle> {
  maxShingleSize?: number;
  minShingleSize?: number;
  outputUnigrams?: boolean;
  outputUnigramsIfNoShingles?: boolean;
  tokenSeparator?: string;
  filterToken?: string;
}
export interface SnowballTokenFilter extends OData<TokenFilterType.snowball> {
  language: SnowballLanguage;
}
export interface StemmerTokenFilter extends OData<TokenFilterType.stemmer> {
  language: StemmerLanguage;
}
export interface StemmerOverrideTokenFilter extends OData<TokenFilterType.stemmerOverride> {
  rules: string[];
}
export interface StopwordsTokenFilter extends OData<TokenFilterType.stopwords> {
  stopwords?: string[];
  stopwordsList?: StopwordsList;
  removeTrailing?: boolean;
}
export interface SynonymTokenFilter extends OData<TokenFilterType.synonym> {
  synonyms: string[];
  ignoreCase?: boolean;
  expand?: boolean;
}
export interface TruncateTokenFilter extends OData<TokenFilterType.truncate> {
  length?: number;
}
export interface UniqueTokenFilter extends OData<TokenFilterType.unique> {
  onlyOnSamePosition?: boolean;
}
export interface WordDelimiterTokenFilter extends OData<TokenFilterType.wordDelimiter> {
  generateWordParts?: boolean;
  generateNumberParts?: boolean;
  catenateWords?: boolean;
  catenateNumbers?: boolean;
  catenateAll?: boolean;
  splitOnCaseChange?: boolean;
  preserveOriginal?: boolean;
  splitOnNumerics?: boolean;
  stemEnglishPossessive?: boolean;
  protectedWords?: string;
}
