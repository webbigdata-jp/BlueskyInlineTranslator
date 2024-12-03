function localizeHtml() {
  const elementsToTranslate = [
    'extensionName',
    'introText',
    'setupGuideTitle',
    'setupGuideStep1',
    'setupGuideStep2',
    'setupGuideStep3',
    'localModelTab',
    'externalApiTab',
    'localModelSettingsTitle',
    'localModelNotice',
    'targetLanguageReading',
    'targetLanguageWriting',
    'useBrowserLanguage',
    'externalApiSettingsTitle',
    'externalApiNotice',
    'enableExternalApi',
    'apiKeyLabel',
    'apiReadingLabel',
    'apiWritingLabel',
    'saveButton',
    'successMessage'
  ];

  elementsToTranslate.forEach(id => {
    const element = document.getElementById(id);
    if (element) {
      const message = chrome.i18n.getMessage(id);
      if (message) {
        if (element.tagName === 'INPUT') {
          element.placeholder = message;
        } else {
          element.textContent = message;
        }
      }
    }
  });

  const extensionIcon = document.getElementById('extensionIcon');
  if (extensionIcon) {
    extensionIcon.alt = chrome.i18n.getMessage('extensionName');
  }

  const useBrowserLanguage2 = document.getElementById('useBrowserLanguage2');
  if (useBrowserLanguage2) {
    useBrowserLanguage2.textContent = chrome.i18n.getMessage('useBrowserLanguage');
  }

  const successMessage = document.getElementById('successMessage');
  if (successMessage) {
    successMessage.textContent = chrome.i18n.getMessage('settingsSaved');
  }
}

const ENCRYPTION_KEY = 'A52j!j.p6.r.4aj_;ymdm]_%bf]^,b(w';

const encryptData = async (text) => {
  if (!text) return '';

  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const encodedKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(ENCRYPTION_KEY),
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );
  
  const encryptedData = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv },
    encodedKey,
    new TextEncoder().encode(text)
  );
  
  const encryptedArray = new Uint8Array(encryptedData);
  const combinedArray = new Uint8Array(iv.length + encryptedArray.length);
  combinedArray.set(iv);
  combinedArray.set(encryptedArray, iv.length);
  
  return btoa(String.fromCharCode.apply(null, combinedArray));
};

const decryptData = async (encryptedText) => {
  if (!encryptedText) return '';

  const combinedArray = new Uint8Array(
    atob(encryptedText).split('').map(char => char.charCodeAt(0))
  );
  
  const iv = combinedArray.slice(0, 12);
  const encryptedData = combinedArray.slice(12);
  
  const decodedKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(ENCRYPTION_KEY),
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  const decryptedData = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv },
    decodedKey,
    encryptedData
  );
  
  return new TextDecoder().decode(decryptedData);
};

function toggleApiSettings() {
  const apiCheckbox = document.getElementById('useExternalApi');
  const apiKey = document.getElementById('apiKey');
  const apiKeyContainer = document.getElementById('apiKeyContainer');
  const apiSettings = document.getElementById('apiSettings');

  apiKeyContainer.style.display = apiCheckbox.checked ? 'block' : 'none';
  
  apiSettings.style.display = 
    (apiCheckbox.checked && apiKey.value.trim()) ? 'block' : 'none';
}

document.addEventListener('DOMContentLoaded', async function() {
  await new Promise(resolve => requestAnimationFrame(resolve));
  await initializeHtml();
  await loadSettings();
  setupEventListeners();
});

async function initializeHtml() {
  localizeHtml();
       
  // サポート言語の取得と設定を待つ
  return new Promise((resolve) => {
    chrome.storage.local.get(['supportedLanguages'], function(result) {
      const supportedLanguages = result.supportedLanguages;

      // 言語ドロップダウンの設定
      const apiSelects = ['apiReadingLanguage', 'apiWritingLanguage'];
      apiSelects.forEach(selectId => {
        const select = document.getElementById(selectId);
        if (select && supportedLanguages) {
          Object.entries(supportedLanguages).forEach(([code, name]) => {
            const option = document.createElement('option');
            option.value = code;
            option.textContent = `${name} (${code})`;
            select.appendChild(option);
          });
        }
      });
      
      resolve();
    });
  });
}


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
    }, async function(items) {
      document.getElementById('useExternalApi').checked = items.useExternalApi;
      document.getElementById('apiKey').value = await decryptData(items.apiKey);
      document.getElementById('localReadingLanguage').value = items.localReadingLanguage;
      document.getElementById('localWritingLanguage').value = items.localWritingLanguage;
      document.getElementById('apiReadingLanguage').value = items.apiReadingLanguage;
      document.getElementById('apiWritingLanguage').value = items.apiWritingLanguage;
      
      toggleApiSettings();
      resolve();
    });
  });
}

// 新しく追加する関数
function setupEventListeners() {
  // タブ切り替えのイベントリスナー設定
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });
  
  // API設定のイベントリスナー設定
  const apiCheckbox = document.getElementById('useExternalApi');
  const apiKey = document.getElementById('apiKey');
  
  apiCheckbox.addEventListener('change', toggleApiSettings);
  apiKey.addEventListener('input', toggleApiSettings);
  
  // 保存ボタンのイベントリスナー
  document.getElementById('saveButton').addEventListener('click', saveSettings);
}

function switchTab(tabName) {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === tabName);
  });
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.toggle('active', content.id === `${tabName}Tab`);
  });
}

async function saveSettings() {
  const settings = {
    useLocal: true,
    useExternalApi: document.getElementById('useExternalApi').checked,
    apiKey: await encryptData(document.getElementById('apiKey').value),
    localReadingLanguage: document.getElementById('localReadingLanguage').value,
    localWritingLanguage: document.getElementById('localWritingLanguage').value,
    apiReadingLanguage: document.getElementById('apiReadingLanguage').value,
    apiWritingLanguage: document.getElementById('apiWritingLanguage').value
  };

  chrome.storage.sync.set(settings, function() {
    const successMessage = document.getElementById('successMessage');
    successMessage.style.display = 'block';
    setTimeout(() => {
      successMessage.style.display = 'none';
    }, 3000);
  });
}
