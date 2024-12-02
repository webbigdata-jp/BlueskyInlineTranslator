let translationSettings = {
  useLocal: true,
  useExternalApi: false,
  apiKey: '',
  localReadingLanguage: '',
  localWritingLanguage: 'en',
  apiReadingLanguage: '',
  apiWritingLanguage: 'en'
};

async function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get({
      useLocal: true,
      useExternalApi: false,
      apiKey: '',
      localReadingLanguage: '',
      localWritingLanguage: 'en',
      apiReadingLanguage: '',
      apiWritingLanguage: 'en'
    }, function(items) {
      translationSettings = items;
      resolve(items);
    });
  });
}

async function detectLanguage(text) {
  return new Promise((resolve, reject) => {
    chrome.i18n.detectLanguage(text, (result) => {
      if (chrome.runtime.lastError) {
        console.error('Language detection error:', chrome.runtime.lastError);
        resolve('en');
        return;
      }
      
      const detected = result.languages[0];
      resolve(detected?.language || 'en');
    });
  });
}

async function getTargetLanguage(mode = 'reading') {
  if (mode === 'reading') {
    if (translationSettings.useLocal) {
      return translationSettings.localReadingLanguage || 
             chrome.i18n.getUILanguage() || 
             navigator.language?.split('-')[0] || 
             'en';
    }
    return translationSettings.apiReadingLanguage || 'en';
  }
  
  if (translationSettings.useLocal) {
    return translationSettings.localWritingLanguage;
  }
  return translationSettings.apiWritingLanguage;
}

async function translateWithExternalAPI(text, sourceLang, targetLang) {
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

async function translateText(text, mode, progressCallback = null) {
  try {
    const sourceLang = await detectLanguage(text);
    const targetLang = await getTargetLanguage(mode);
    
    const canTranslate = await translation.canTranslate({
      sourceLanguage: sourceLang,
      targetLanguage: targetLang
    });

    // Check API support first
    if (canTranslate === 'no') {
      if (translationSettings.apiKey) {
        return await translateWithExternalAPI(text, sourceLang, targetLang);
      } else {
        throw new Error('Translation for this language pair is not supported. You can enable more language pairs by setting up an external API key in the extension settings.');
      }
    }

    const translator = await translation.createTranslator({
      sourceLanguage: sourceLang,
      targetLanguage: targetLang
    });

    if (canTranslate === 'after-download') {
      translator.addEventListener('downloadprogress', (e) => {
        const progress = Math.round((e.loaded / e.total) * 100);
        if (progressCallback) {
          progressCallback(`Downloading translation model: ${progress}%`);
        }
        console.log(`Download progress: ${e.loaded}/${e.total}`);
      });
      await translator.ready;
    }
    
    return await translator.translate(text);
  } catch (e) {
    console.error('Translation error:', e);
    return `Translation error: ${e.message}`;
  }
}

async function addTranslateButton(postElement) {
  const existingButton = postElement.parentElement.querySelector('.translate-button');
  if (existingButton) {
    return;
  }

  const sourceLang = await detectLanguage(postElement.textContent);
  const targetLang = await getTargetLanguage("reading");

  const buttonText = `${sourceLang}→${targetLang}`;

  const translateButton = document.createElement('span');
  translateButton.className = 'translate-button';
  translateButton.textContent = buttonText;
  translateButton.style.marginLeft = '8px';
  translateButton.style.color = '#0085ff';
  translateButton.style.cursor = 'pointer';
  translateButton.style.userSelect = 'none';
  
  translateButton.addEventListener('click', async (event) => {
    event.stopPropagation();  
    console.log('Translation button clicked');
    const originalText = postElement.textContent;

    let translatedDiv = postElement.parentElement.querySelector('.translated-text');
    
    if (!translatedDiv) {
      translatedDiv = document.createElement('div');
      translatedDiv.className = 'translated-text';
      translatedDiv.style.marginTop = '8px';
      translatedDiv.style.padding = '8px';
      translatedDiv.style.backgroundColor = 'rgba(0, 133, 255, 0.05)';
      translatedDiv.style.borderRadius = '8px';
      postElement.parentElement.insertBefore(translatedDiv, postElement.nextSibling);
    }

    translatedDiv.textContent = 'Translating...';
    
    try {
      const translatedText = await translateText(
        originalText, 
        "reading",
        (progressMessage) => {
          translatedDiv.textContent = progressMessage;
        }
      );
      translatedDiv.textContent = translatedText;
    } catch (error) {
      translatedDiv.textContent = 'Translation failed';
      console.error('Translation error:', error);
    }
  });
  
  postElement.parentElement.insertBefore(translateButton, postElement.nextSibling);
}

// Similar changes for addPostTranslateButton()
async function addPostTranslateButton() {
  if (document.querySelector('.post-translate-button')) {
    return;
  }

  const buttonContainer = document.querySelector('[data-testid="composerPublishBtn"]')?.parentElement;
  if (!buttonContainer) return;

  const spacer = buttonContainer.querySelector('div[style*="flex: 1"]');
  if (!spacer) return;

  const sourceLang = await detectLanguage(text);
  const targetLang = await getTargetLanguage(mode);

  const buttonText = `${sourceLang}→${targetLang}`;

  const translateButton = document.createElement('button');
  translateButton.className = 'post-translate-button';
  translateButton.setAttribute('aria-label', 'Translate post');
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

    translateButton.textContent = 'Translating...';
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
        "writing",
        (progressMessage) => {
          translatedDiv.textContent = progressMessage;
        }
      );
      translatedDiv.textContent = translatedText;
    } catch (error) {
      alert('Translation failed');
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
  await loadSettings();
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
    setTimeout(processNewPosts, 1000);
  }
}).observe(document, {subtree: true, childList: true});

const composerObserver = new MutationObserver(() => {
  checkForComposeForm();
});

composerObserver.observe(document.body, {
  childList: true,
  subtree: true
});

window.addEventListener('load', () => setTimeout(processNewPosts, 1000));
window.addEventListener('popstate', () => setTimeout(processNewPosts, 1000));

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}