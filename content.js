let translationSupported = false;

async function checkTranslationSupport() {
  try {
      translationSupported = 'translation' in self && 'createTranslator' in self.translation;
      if (!translationSupported) {
          showTranslationAlert();
          return false;
      }
      return true;
  } catch (e) {
      console.error('Translation API check failed:', e);
      showTranslationAlert();
      return false;
  }
}

function showTranslationAlert() {
  const existingAlert = document.getElementById('translation-settings-alert');
  if (existingAlert) existingAlert.remove();

  const alertDiv = document.createElement('div');
  alertDiv.id = 'translation-settings-alert';
  alertDiv.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background-color: #ff4444;
      color: white;
      padding: 15px 20px;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      display: flex;
      align-items: center;
      gap: 10px;
  `;

  alertDiv.innerHTML = `
    <div>
        <strong>${chrome.i18n.getMessage("translationRequired") || "Translation API Setup Required"}</strong>
        <p style="margin: 5px 0;">${chrome.i18n.getMessage("translationMessage")}</p>
    </div>
    <button onclick="this.parentElement.remove()" 
            style="background: none; border: none; color: white; font-size: 20px; cursor: pointer; padding: 0;">
        ×
    </button>
  `;
  document.body.appendChild(alertDiv);
}


let translationSettings = {
  useExternalApi: false,
  apiKey: '',
  localReadingLanguage: '',
  localWritingLanguage: 'en',
  apiReadingLanguage: '',
  apiWritingLanguage: 'en'
};


async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get({
      useExternalApi: false,
      apiKey: '',
      localReadingLanguage: '',
      localWritingLanguage: 'en',
      apiReadingLanguage: '',
      apiWritingLanguage: 'en'
    }, async function(items) {
      try {
        let decryptedApiKey = '';
        if (items.apiKey) {
          decryptedApiKey = await decryptData(items.apiKey);
        }

        translationSettings = {
          useExternalApi: items.useExternalApi,
          apiKey: decryptedApiKey,
          localReadingLanguage: items.localReadingLanguage,
          localWritingLanguage: items.localWritingLanguage,
          apiReadingLanguage: items.apiReadingLanguage,
          apiWritingLanguage: items.apiWritingLanguage
        };

        resolve(translationSettings);
      } catch (error) {
        console.error('Error while loading settings:', error);
        translationSettings = {
          useExternalApi: false,
          apiKey: '',
          localReadingLanguage: '',
          localWritingLanguage: 'en',
          apiReadingLanguage: '',
          apiWritingLanguage: 'en'
        };
        resolve(translationSettings);
      }
    });
  });
}


async function detectLanguage(text) {
  const textWithoutEmoji = text.replace(/[\u{1F000}-\u{1F6FF}]|[\u{1F900}-\u{1F9FF}]|[\u{2600}-\u{26FF}]/gu, '').trim();
  const textWithoutFlags = textWithoutEmoji.replace(/[\u{1F1E6}-\u{1F1FF}]{2}/gu, '').trim();

  const spanishPatterns = [
    /\b(es|está|este|esta|una|las|los|el|la|son|con|por|para)\b/i,
    /ción\b/,
    /[áéíóúñ]/i
  ];
  console.log('detectLanguage');
  console.log(text);
  
  function hasSpanishCharacteristics(text) {
    return spanishPatterns.some(pattern => pattern.test(text));
  }

  const MIN_TEXT_LENGTH = 10;
  function isProbablyProperNouns(text) {
    const words = text.split(/\s+/);
    const capitalizedWords = words.filter(word => 
      word.length > 0 && word[0] === word[0].toUpperCase()
    );
    return capitalizedWords.length / words.length > 0.5;
  }

  return new Promise((resolve, reject) => {
    chrome.i18n.detectLanguage(textWithoutFlags, (result) => {
      if (chrome.runtime.lastError) {
        console.error('Language detection error:', chrome.runtime.lastError);
        resolve('en');
        return;
      }

      const CONFIDENCE_THRESHOLD = 0.7;
      
      if (!result.languages.length) {
        if (hasSpanishCharacteristics(textWithoutFlags)) {
          resolve('es');
        } else {
          resolve('en');
        }
        return;
      }

      const detected = result.languages[0];
      console.log('detected');
      console.log(detected);
      if (detected.language == "es"){
        resolve('es');
        return;
      }

      try {
        console.log(typeof detected.percentage);
        if (detected.percentage > 90){
          const baseLanguage = detected.language.split('-')[0];
          console.log('percentage');
          resolve(baseLanguage);
          return
        }
      } catch (error) {
        console.error('Error in promise:', error);
        reject(error);
      }
      console.log('no percentage');

      if (isProbablyProperNouns(textWithoutFlags)) {
        const englishCharRegex = /[a-zA-Z]/g;
        const englishCharCount = (textWithoutFlags.match(englishCharRegex) || []).length;
        const englishCharRatio = englishCharCount / textWithoutFlags.length;
        
        if (englishCharRatio > 0.8) {
          resolve('en');
          return;
        }
      }

      const asciiCharCount = textWithoutFlags.split('').filter(char => char.charCodeAt(0) < 128).length;
      const asciiRatio = asciiCharCount / textWithoutFlags.length;
      
      if (asciiRatio > 0.9) {
        resolve('en');
        return;
      }
      // en-US → en
      const baseLanguage = detected.language.split('-')[0];

      if (baseLanguage === 'en' && hasSpanishCharacteristics(textWithoutFlags)) {
        resolve('es');
        return;
      }

      resolve(baseLanguage || 'en');
    });
  });
}


async function getTargetLanguage(mode = 'reading', model = 'local') {
  if (mode === 'reading') {
    if (model === 'local'){
      return translationSettings.localReadingLanguage || 
             chrome.i18n.getUILanguage().split('-')[0] || 
             navigator.language?.split('-')[0] || 
             'en';
    }
    return translationSettings.apiReadingLanguage || 'en';
  }
  
  if (model === 'local') {
    return translationSettings.localWritingLanguage;
  }
  return translationSettings.apiWritingLanguage;
}


async function translateWithExternalAPI(text, sourceLang, targetLang) {
  console.log("In translateWithExternalAPI");
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({
      type: 'translate',
      text: text,
      sourceLang: sourceLang,
      targetLang: targetLang,
      apiKey: translationSettings.apiKey
    }, response => {
      if (response.error) {
        reject(new Error(response.error));
      } else {
        resolve(response.text);
      }
    });
  });
}


async function translateText(text, targetLang, progressCallback = null) {

  if ('translation' in self && 'createTranslator' in self.translation) {
    console.log("supported");
  }
  console.log("In translateText");

  try {
    const sourceLang = await detectLanguage(text);
    const canTranslate = await translation.canTranslate({
      sourceLanguage: sourceLang,
      targetLanguage: targetLang
    });
    console.log(sourceLang);
    console.log(targetLang);

    if (canTranslate === 'readily') {
      console.log("In readily");
        const translator = await translation.createTranslator({
        sourceLanguage: sourceLang,
        targetLanguage: targetLang
      });
      return await translator.translate(text);
    }
    
    if (canTranslate === 'after-download') {
      console.log("In after-download");
      const translator = await translation.createTranslator({
        sourceLanguage: sourceLang,
        targetLanguage: targetLang
      });

      translator.ondownloadprogress = (e) => {
        if (!e.total) return;
        const progress = Math.round((e.loaded / e.total) * 100);
        if (progressCallback) {
          progressCallback(chrome.i18n.getMessage('downloadingModelProgress', [progress]));
        }
      };
  
      try {
        await translator.ready;
        const result = await translator.translate(text);
        translator.ondownloadprogress = null; 
        return result;
      } catch (error) {
        progressCallback?.(chrome.i18n.getMessage('modelDownloadError'));
        throw error;
      }
    }

    if (!translationSettings.useExternalApi) {
      throw new Error(chrome.i18n.getMessage('errorUnsupportedLanguagePair'));
    }

    if (translationSettings.apiKey == "") {
      throw new Error(chrome.i18n.getMessage('errorNeedAPIKey'));
    }

    return await translateWithExternalAPI(text, sourceLang, targetLang);
  } catch (e) {
    console.error('Translation error:', e);
    return new Error(chrome.i18n.getMessage('externalAPIFlagNotice', [e.message]));
  }
}


async function addTranslateButton(postElement) {
  console.log("addTranslateButton");
  const existingButton = postElement.parentElement.querySelector('.translate-button');
  if (existingButton) {
    return;
  }

  const sourceLang = await detectLanguage(postElement.textContent);
  const targetLang = await getTargetLanguage("reading");
  console.log(`sourceLang: ${sourceLang}`);
  console.log(`targetLang: ${targetLang}`);

  if (sourceLang == targetLang){
    return
  }

  const buttonText = `${sourceLang}→${targetLang}`;
  console.log(buttonText);

  const translateButton = document.createElement('span');
  translateButton.className = 'translate-button';
  translateButton.textContent = buttonText;
  translateButton.style.marginLeft = '8px';
  translateButton.style.color = '#0085ff';
  translateButton.style.cursor = 'pointer';
  translateButton.style.userSelect = 'none';
  
  translateButton.addEventListener('click', async (event) => {
    console.log('Translation button clicked');
    const clickedLink = event.target.closest('a');
    if (clickedLink) { 
      // feed page a link.
      event.preventDefault();
    }
    event.stopPropagation();  
    
    const originalText = postElement.textContent;
    let translatedDiv = postElement.parentElement.querySelector('.translated-text');

    if (!translatedDiv) {
      translatedDiv = document.createElement('div');
      translatedDiv.className = 'translated-text';
      
      const container = document.createElement('div');
      container.style.display = 'flex';
      container.style.flexDirection = 'column';
      container.style.width = '100%';
      container.style.gap = '8px';
      
      const originalDiv = document.createElement('div');
      originalDiv.style.width = '100%';
      originalDiv.style.wordBreak = 'break-word';
      originalDiv.appendChild(postElement.cloneNode(true));
      
      translatedDiv.style.width = '100%';
      translatedDiv.style.padding = '8px';
      translatedDiv.style.backgroundColor = 'rgba(0, 133, 255, 0.05)';
      translatedDiv.style.borderRadius = '8px';
      translatedDiv.style.wordBreak = 'break-word';
      
      container.appendChild(originalDiv);
      container.appendChild(translatedDiv);
      
      postElement.parentElement.replaceChild(container, postElement);
    }

    //translatedDiv.textContent = chrome.i18n.getMessage('translatingMessage');
    
    try {
      const translatedText = await translateText(
        originalText, 
        targetLang,
        (progressMessage) => {
          translatedDiv.textContent = progressMessage;
        }
      );
      translatedDiv.textContent = translatedText;
    } catch (error) {
      translatedDiv.textContent = chrome.i18n.getMessage('externalAPIFlagNotice', [e.message]);
      console.error('Translation error:', error);
    }
  });
  postElement.parentElement.insertBefore(translateButton, postElement.nextSibling);
}


async function addPostTranslateButton() {
  if (document.querySelector('.post-translate-button')) {
    return;
  }

  const buttonContainer = document.querySelector('[data-testid="composerPublishBtn"]')?.parentElement;
  if (!buttonContainer) return;

  const spacer = buttonContainer.querySelector('div[style*="flex: 1"]');
  if (!spacer) return;

  const sourceLang = await getTargetLanguage("reading");
  targetLang = await getTargetLanguage("writing");

  if (sourceLang == targetLang){
    targetLang = await getTargetLanguage("writing", "api");
  }

  if (sourceLang == targetLang){
    if (targetLang != "en"){
      targetLang = "en"
    }else{
      targetLang = "ja"
    }
  }

  const buttonText = `${sourceLang}→${targetLang}`;

  const translateButton = document.createElement('button');
  translateButton.className = 'post-translate-button';
  translateButton.setAttribute('aria-label', chrome.i18n.getMessage('translateButtonLabel'));
  translateButton.setAttribute('role', 'button');
  translateButton.style.cssText = `
    background-color: rgb(255, 255, 255);
    padding: 8px 12px;
    border-radius: 999px;
    border: 1px solid rgb(239, 243, 244);
    cursor: pointer;
    margin-right: 8px;
    font-family: InterVariable, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto;
    font-size: 15px;
    font-weight: 600;
    color: rgb(1, 104, 213);
  `;
  translateButton.textContent = buttonText;

  translateButton.addEventListener('click', async () => {
    const editor = document.querySelector('.ProseMirror');
    if (!editor) return;

    const originalText = editor.textContent;
    if (!originalText) return;

    translateButton.textContent = chrome.i18n.getMessage('translatingMessage');
    translateButton.disabled = true;

    try {
      let translatedDiv = editor.parentElement.querySelector('.translated-post-text');
      if (!translatedDiv) {
        translatedDiv = document.createElement('div');
        translatedDiv.className = 'translated-post-text';
        translatedDiv.style.cssText = `
          margin-top: 8px;
          padding: 8px;
          background-color: rgba(0, 133, 255, 0.05);
          border-radius: 8px;
          font-size: 14px;
          color: #536471;
        `;
        editor.parentElement.appendChild(translatedDiv);
      }

      const translatedText = await translateText(
        originalText, 
        targetLang,
        (progressMessage) => {
          translatedDiv.textContent = progressMessage;
        }
      );
      translatedDiv.textContent = translatedText;

      // Add replace button
      let replaceButton = editor.parentElement.querySelector('.replace-translation-button');
      if (!replaceButton) {
        replaceButton = document.createElement('button');
        replaceButton.className = 'replace-translation-button';
        replaceButton.style.cssText = `
          background-color: rgb(255, 255, 255);
          padding: 4px 8px;
          border-radius: 4px;
          border: 1px solid rgb(239, 243, 244);
          cursor: pointer;
          margin-top: 4px;
          font-size: 13px;
          color: rgb(83, 100, 113);
        `;
        replaceButton.textContent = chrome.i18n.getMessage('replaceWithTranslation');

        translatedDiv.appendChild(replaceButton);

        replaceButton.addEventListener('click', () => {
          // Replace editor content with translated text
          editor.innerHTML = `<p>${translatedText}</p>`;
          
          // Remove translated div and replace button
          translatedDiv.remove();
        });
      }
    } catch (error) {
      translatedDiv.textContent = chrome.i18n.getMessage('externalAPIFlagNotice', [e.message]);
      console.error('Translation error:', error);
    } finally {
      translateButton.textContent = buttonText;
      translateButton.disabled = false;
    }
  });

  buttonContainer.insertBefore(translateButton, spacer.nextSibling);
}


async function processNewPosts() {
  const posts = document.querySelectorAll('div[dir="auto"][data-word-wrap="1"]:not(.processed-post)');
  for (const post of posts) {
    post.classList.add('processed-post');
    await addTranslateButton(post);
  }
}


function initializeObserver() {
  let timeoutId = null;
  
  const observer = new MutationObserver((mutations) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    
    timeoutId = setTimeout(() => {
      processNewPosts();
    }, 500);
  });

  const targetNode = document.querySelector('main') || document.querySelector('#root') || document.body;
  observer.observe(targetNode, {
    childList: true,
    subtree: true
  });
}

async function checkForComposeForm() {
  const composerExists = document.querySelector('.ProseMirror');
  if (composerExists) {
    addPostTranslateButton();
  }
}

async function initialize() {
  if (!await checkTranslationSupport()) {
    console.warn('Translation API is not available. Some features may not work.');
    return;
  }

  await getSettings();
  setTimeout(async () => {
    await processNewPosts();
    await initializeObserver();
    await checkForComposeForm();
  }, 1000);
}

let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    if (translationSupported) { 
      setTimeout(processNewPosts, 1000);
    }
  }
}).observe(document, {subtree: true, childList: true});

const composerObserver = new MutationObserver(() => {
  if (translationSupported) {  
    checkForComposeForm();
  }
});
composerObserver.observe(document.body, {
  childList: true,
  subtree: true
});

window.addEventListener('load', () => {
  if (translationSupported) {
      setTimeout(processNewPosts, 1000);
  }
});

window.addEventListener('popstate', () => {
  if (translationSupported) {
      setTimeout(processNewPosts, 1000);
  }
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}