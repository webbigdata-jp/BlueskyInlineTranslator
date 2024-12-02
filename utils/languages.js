export const supportedLanguages = {
  ar: "Arabic", bg: "Bulgarian", bn: "Bengali", cs: "Czech", da: "Danish", 
  de: "German", el: "Greek", en: "English", es: "Spanish", et: "Estonian",
  fi: "Finnish", fr: "French", gu: "Gujarati", he: "Hebrew", hi: "Hindi",
  hr: "Croatian", hu: "Hungarian", id: "Indonesian", it: "Italian", 
  ja: "Japanese", kn: "Kannada", ko: "Korean", lt: "Lithuanian", 
  lv: "Latvian", ml: "Malayalam", mr: "Marathi", nl: "Dutch", no: "Norwegian",
  pl: "Polish", pt: "Portuguese", ro: "Romanian", ru: "Russian", 
  sk: "Slovak", sl: "Slovenian", sr: "Serbian", sv: "Swedish", 
  sw: "Swahili", ta: "Tamil", te: "Telugu", th: "Thai", tr: "Turkish",
  uk: "Ukrainian", ur: "Urdu", vi: "Vietnamese", zh: "Chinese"
};

export const getLanguageName = (code) => {
  return supportedLanguages[code] || code;
};