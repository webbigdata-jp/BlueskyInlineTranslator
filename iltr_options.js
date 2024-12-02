document.addEventListener('DOMContentLoaded', function() {
  // Supported languages list
  const supportedLanguages = {
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

  // Tab switching
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  // Populate language dropdowns for external API
  const apiSelects = ['apiReadingLanguage', 'apiWritingLanguage'];
  apiSelects.forEach(selectId => {
    const select = document.getElementById(selectId);
    Object.entries(supportedLanguages).forEach(([code, name]) => {
      const option = document.createElement('option');
      option.value = code;
      option.textContent = `${name} (${code})`;
      select.appendChild(option);
    });
  });

  // Toggle API settings visibility
  const apiCheckbox = document.getElementById('useExternalApi');
  const apiKey = document.getElementById('apiKey');
  const apiSettings = document.getElementById('apiSettings');

  function toggleApiSettings() {
    apiSettings.style.display = 
      (apiCheckbox.checked && apiKey.value.trim()) ? 'block' : 'none';
  }

  apiCheckbox.addEventListener('change', toggleApiSettings);
  apiKey.addEventListener('input', toggleApiSettings);

  // Load saved settings
  loadSettings();

  // Save settings
  document.getElementById('saveButton').addEventListener('click', saveSettings);
});

function switchTab(tabName) {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === tabName);
  });
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.toggle('active', content.id === `${tabName}Tab`);
  });
}

function loadSettings() {
  chrome.storage.sync.get({
    useLocal: true,
    useExternalApi: false,
    apiKey: '',
    localReadingLanguage: '',
    localWritingLanguage: 'en',
    apiReadingLanguage: '',
    apiWritingLanguage: 'en'
  }, function(items) {
    document.getElementById('useExternalApi').checked = items.useExternalApi;
    document.getElementById('apiKey').value = items.apiKey;
    document.getElementById('localReadingLanguage').value = items.localReadingLanguage;
    document.getElementById('localWritingLanguage').value = items.localWritingLanguage;
    document.getElementById('apiReadingLanguage').value = items.apiReadingLanguage;
    document.getElementById('apiWritingLanguage').value = items.apiWritingLanguage;
    
    toggleApiSettings();
  });
}

function saveSettings() {
  const settings = {
    useLocal: true,
    useExternalApi: document.getElementById('useExternalApi').checked,
    apiKey: document.getElementById('apiKey').value,
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