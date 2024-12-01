// content.js
let translationSettings = {
  readingLanguage: 'en-ja',
  writingLanguage: 'ja-en',
  apiKey: ''
};

// 設定を読み込む
function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get({
      readingLanguage: 'en-ja',
      writingLanguage: 'ja-en',
      apiKey: ''
    }, function(items) {
      translationSettings = items;
      resolve(items);
    });
  });
}

// 外部APIを使用した翻訳
async function translateWithExternalAPI(text, sourceLang, targetLang) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({
      type: 'translate',
      text: text,
      targetLang: targetLang,
      apiKey: translationSettings.apiKey
    }, response => {
      if (response.error) {
        reject(new Error(response.error));
      } else {
        resolve(response);
      }
    });
  });
}

async function translateText(text, languagePair) {
  try {
    const [sourceLang, targetLang] = languagePair.split('-');
    
    // まず内蔵の翻訳機能を試す
    const canTranslate = await translation.canTranslate({
      sourceLanguage: sourceLang,
      targetLanguage: targetLang
    });

    // 内蔵の翻訳が使えない場合はAPIキーをチェック
    if (canTranslate === 'no' && translationSettings.apiKey) {
      return await translateWithExternalAPI(text, sourceLang, targetLang);
    }

    if (canTranslate === 'no') {
      throw new Error('この言語ペアの翻訳はサポートされていません');
    }

    const translator = await translation.createTranslator({
      sourceLanguage: sourceLang,
      targetLanguage: targetLang
    });

    if (canTranslate === 'after-download') {
      translator.addEventListener('downloadprogress', (e) => {
        console.log(`ダウンロード進捗: ${e.loaded}/${e.total}`);
      });
      await translator.ready;
    }
    
    return await translator.translate(text);
  } catch (e) {
    console.error('Translation error:', e);
    return `翻訳エラー: ${e.message}`;
  }
}

function addTranslateButton(postElement) {
  const existingButton = postElement.parentElement.querySelector('.translate-button');
  if (existingButton) {
    return;
  }

  const [sourceLang, targetLang] = translationSettings.readingLanguage.split('-');
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

    translatedDiv.textContent = '翻訳中...';
    
    try {
      const translatedText = await translateText(originalText, translationSettings.readingLanguage);
      translatedDiv.textContent = translatedText;
    } catch (error) {
      translatedDiv.textContent = '翻訳に失敗しました';
      console.error('Translation error:', error);
    }
  });
  
  postElement.parentElement.insertBefore(translateButton, postElement.nextSibling);
}

function addPostTranslateButton() {
  if (document.querySelector('.post-translate-button')) {
    return;
  }

  const buttonContainer = document.querySelector('[data-testid="composerPublishBtn"]')?.parentElement;
  if (!buttonContainer) return;

  const spacer = buttonContainer.querySelector('div[style*="flex: 1"]');
  if (!spacer) return;

  const [sourceLang, targetLang] = translationSettings.writingLanguage.split('-');
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

    translateButton.textContent = '翻訳中...';
    translateButton.disabled = true;

    try {
      const translatedText = await translateText(originalText, translationSettings.writingLanguage);
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
      translatedDiv.textContent = translatedText;
    } catch (error) {
      alert('翻訳に失敗しました');
      console.error('Translation error:', error);
    } finally {
      translateButton.textContent = buttonText;
      translateButton.disabled = false;
    }
  });

  buttonContainer.insertBefore(translateButton, spacer.nextSibling);
}

// 投稿を見つけて処理する関数
function processNewPosts() {
  const posts = document.querySelectorAll('div[dir="auto"][data-word-wrap="1"]:not(.processed-post)');
  posts.forEach(post => {
    // 処理済みマークを付ける
    post.classList.add('processed-post');
    addTranslateButton(post);
  });
}

// DOM変更の監視
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

// 投稿フォームの監視を追加
function checkForComposeForm() {
  const composerExists = document.querySelector('.ProseMirror');
  if (composerExists) {
    addPostTranslateButton();
  }
}

// 初期化
async function initialize() {
  await loadSettings();
  setTimeout(() => {
    processNewPosts();
    initializeObserver();
    checkForComposeForm();
  }, 1000);
}

// ページ遷移の検出
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    setTimeout(processNewPosts, 1000);
  }
}).observe(document, {subtree: true, childList: true});

// ページ遷移監視のための追加のMutationObserver
const composerObserver = new MutationObserver(() => {
  checkForComposeForm();
});

composerObserver.observe(document.body, {
  childList: true,
  subtree: true
});

// 追加のイベントリスナー
window.addEventListener('load', () => setTimeout(processNewPosts, 1000));
window.addEventListener('popstate', () => setTimeout(processNewPosts, 1000));

// 初期化の実行
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}