"use strict";
function __export(m) {
    for (var p in m) if (!exports.hasOwnProperty(p)) exports[p] = m[p];
}
Object.defineProperty(exports, "__esModule", { value: true });
__export(require("./entity-recognition"));
__export(require("./key-phrase-extraction"));
__export(require("./language-detection"));
__export(require("./merge"));
__export(require("./named-entity-recognition"));
__export(require("./sentiment"));
__export(require("./split"));
var SkillTypeText;
(function (SkillTypeText) {
    SkillTypeText["keyPhraseExtraction"] = "#Microsoft.Skills.Text.KeyPhraseExtractionSkill";
    SkillTypeText["languageDetection"] = "#Microsoft.Skills.Text.LanguageDetectionSkill";
    SkillTypeText["entityRecognition"] = "#Microsoft.Skills.Text.EntityRecognitionSkill";
    SkillTypeText["merge"] = "#Microsoft.Skills.Text.MergeSkill";
    SkillTypeText["split"] = "#Microsoft.Skills.Text.SplitSkill";
    SkillTypeText["sentiment"] = "#Microsoft.Skills.Text.SentimentSkill";
    /** @deprecated Use `SkillTypeText.entityRecognition` instead */
    SkillTypeText["namedEntityRecognition"] = "#Microsoft.Skills.Text.LanguageDetectionSkill";
})(SkillTypeText = exports.SkillTypeText || (exports.SkillTypeText = {}));
var Language;
(function (Language) {
    Language["danish"] = "da";
    Language["dutch"] = "nl";
    Language["english"] = "en";
    Language["finnish"] = "fi";
    Language["french"] = "fr";
    Language["german"] = "de";
    Language["greek"] = "el";
    Language["italian"] = "it";
    Language["japanese"] = "ja";
    Language["korean"] = "ko";
    Language["norwegian"] = "no";
    Language["polish"] = "pl";
    Language["portuguesePortual"] = "pt-PT";
    Language["portugueseBrazil"] = "pt-BR";
    Language["russian"] = "ru";
    Language["spanish"] = "es";
    Language["swedish"] = "sv";
    Language["turkish"] = "tr";
})(Language = exports.Language || (exports.Language = {}));
//# sourceMappingURL=index.js.map