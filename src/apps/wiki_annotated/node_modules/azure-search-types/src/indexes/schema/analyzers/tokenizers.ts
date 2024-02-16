import { OData } from "../../..";

export type TokenizerName = PrebuiltTokenizerName | string;
export type Tokenizer = ClassicTokenizer
  | EdgeNGramTokenizer
  | KeywordTokenizer
  | MicrosoftLanguageTokenizer
  | MicrosoftLanguageStemmingTokenizer
  | NGramTokenizer
  | PathHierarchyTokenizer
  | PatternTokenizer
  | StandardTokenizer
  | UaxUrlEmailTokenizer
  ;

export enum PrebuiltTokenizerName {
  classic = 'classic',
  edgeNGram = 'edgeNGram',
  keyword = 'keyword_v2',
  letter = 'letter',
  lowercase = 'lowercase',
  microsoftLanguage = 'microsoft_language_tokenizer',
  microsoftLanguageStemming = 'microsoft_language_stemming_tokenizer',
  nGram = 'nGram',
  pathHierarchy = 'path_hierarchy_v2',
  pattern = 'pattern',
  standard = 'standard_v2',
  uaxUrlEmail = 'uax_url_email',
  whitespace = 'whitespace',
}

export enum TokenizerType {
  classic = '#Microsoft.Azure.Search.ClassicTokenizer',
  edgeNGram = '#Microsoft.Azure.Search.EdgeNGramTokenizer',
  keyword = '#Microsoft.Azure.Search.KeywordTokenizerV2',
  microsoftLanguage = '#Microsoft.Azure.Search.MicrosoftLanguageTokenizer',
  microsoftLanguageStemming = '#Microsoft.Azure.Search.MicrosoftLanguageStemmingTokenizer',
  nGram = '#Microsoft.Azure.Search.NGramTokenizer',
  pathHierarchy = '#Microsoft.Azure.Search.PathHierarchyTokenizerV2',
  pattern = '#Microsoft.Azure.Search.PatternTokenizer',
  standard = '#Microsoft.Azure.Search.StandardTokenizerV2',
  uaxUrlEmail = '#Microsoft.Azure.Search.UaxUrlEmailTokenizer',
}

export enum TokenChar {
  letter = 'letter',
  digit = 'digit',
  whitespace = 'whitespace',
  punctuation = 'punctuation',
  symbol = 'symbol',
}

export enum MicrosoftTokenizerLanguage {
  bangla = 'bangla',
  bulgarian = 'bulgarian',
  catalan = 'catalan',
  chineseSimplified = 'chineseSimplified',
  chineseTraditional = 'chineseTraditional',
  croatian = 'croatian',
  czech = 'czech',
  danish = 'danish',
  dutch = 'dutch',
  english = 'english',
  french = 'french',
  german = 'german',
  greek = 'greek',
  gujarati = 'gujarati',
  hindi = 'hindi',
  icelandic = 'icelandic',
  indonesian = 'indonesian',
  italian = 'italian',
  japanese = 'japanese',
  kannada = 'kannada',
  korean = 'korean',
  malay = 'malay',
  malayalam = 'malayalam',
  marathi = 'marathi',
  norwegianBokmaal = 'norwegianBokmaal',
  polish = 'polish',
  portuguese = 'portuguese',
  portugueseBrazilian = 'portugueseBrazilian',
  punjabi = 'punjabi',
  romanian = 'romanian',
  russian = 'russian',
  serbianCyrillic = 'serbianCyrillic',
  serbianLatin = 'serbianLatin',
  slovenian = 'slovenian',
  spanish = 'spanish',
  swedish = 'swedish',
  tamil = 'tamil',
  telugu = 'telugu',
  thai = 'thai',
  ukrainian = 'ukrainian',
  urdu = 'urdu',
  vietnamese = 'vietnamese',
}

export enum MicrosoftStemmingTokenizerLanguage {
  arabic = 'arabic',
  bangla = 'bangla',
  bulgarian = 'bulgarian',
  catalan = 'catalan',
  croatian = 'croatian',
  czech = 'czech',
  danish = 'danish',
  dutch = 'dutch',
  english = 'english',
  estonian = 'estonian',
  finnish = 'finnish',
  french = 'french',
  german = 'german',
  greek = 'greek',
  gujarati = 'gujarati',
  hebrew = 'hebrew',
  hindi = 'hindi',
  hungarian = 'hungarian',
  icelandic = 'icelandic',
  indonesian = 'indonesian',
  italian = 'italian',
  kannada = 'kannada',
  latvian = 'latvian',
  lithuanian = 'lithuanian',
  malay = 'malay',
  malayalam = 'malayalam',
  marathi = 'marathi',
  norwegianBokmaal = 'norwegianBokmaal',
  polish = 'polish',
  portuguese = 'portuguese',
  portugueseBrazilian = 'portugueseBrazilian',
  punjabi = 'punjabi',
  romanian = 'romanian',
  russian = 'russian',
  serbianCyrillic = 'serbianCyrillic',
  serbianLatin = 'serbianLatin',
  slovak = 'slovak',
  slovenian = 'slovenian',
  spanish = 'spanish',
  swedish = 'swedish',
  tamil = 'tamil',
  telugu = 'telugu',
  turkish = 'turkish',
  ukrainian = 'ukrainian',
  urdu = 'urdu',
}

export enum PatternFlags {
  canonEq = 'CANON_EQ',
  caseInsensitive = 'CASE_INSENSITIVE',
  comments = 'COMMENTS',
  dotAll = 'DOTALL',
  literal = 'LITERAL',
  multiline = 'MULTILINE',
  unicodeCase = 'UNICODE_CASE',
  unixLines = 'UNIX_LINES',
}

export interface ClassicTokenizer extends OData<TokenizerType.classic> {
  maxTokenLength?: number;
}
export interface EdgeNGramTokenizer extends OData<TokenizerType.edgeNGram> {
  minGram?: number;
  maxGram?: number;
  tokenChars?: TokenChar[];
}
export interface KeywordTokenizer extends OData<TokenizerType.keyword> {
  maxTokenLength?: number;
}
export interface MicrosoftLanguageTokenizer extends OData<TokenizerType.microsoftLanguage> {
  maxTokenLength?: number;
  isSearchTokenizer: boolean;
  language?: MicrosoftTokenizerLanguage;
}
export interface MicrosoftLanguageStemmingTokenizer extends OData<TokenizerType.microsoftLanguageStemming> {
  maxTokenLength?: number;
  isSearchTokenizer: boolean;
  language?: MicrosoftStemmingTokenizerLanguage;
}
export interface NGramTokenizer extends OData<TokenizerType.nGram> {
  minGram?: number;
  maxGram?: number;
  tokenChars?: TokenChar[];
}
export interface PathHierarchyTokenizer extends OData<TokenizerType.pathHierarchy> {
  delimiter?: string;
  replacement?: string;
  maxTokenLength?: number;
  reverse?: boolean;
  skip?: boolean;
}
export interface PatternTokenizer extends OData<TokenizerType.pattern> {
  pattern?: string;
  flags?: PatternFlags;
  group?: number;
}
export interface StandardTokenizer extends OData<TokenizerType.standard> {
  maxTokenLength?: number;
}
export interface UaxUrlEmailTokenizer extends OData<TokenizerType.uaxUrlEmail> {
  maxTokenLength?: number;
}
