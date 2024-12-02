import { getLanguageName, supportedLanguages } from './utils/languages.js';

function toggleApiSettings() {
  const apiCheckbox = document.getElementById('useExternalApi');
  const apiKey = document.getElementById('apiKey');
  const apiSettings = document.getElementById('apiSettings');
  
  apiSettings.style.display = 
    (apiCheckbox.checked && apiKey.value.trim()) ? 'block' : 'none';
}


document.addEventListener('DOMContentLoaded', function() {
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

  // API settings event listeners
  const apiCheckbox = document.getElementById('useExternalApi');
  const apiKey = document.getElementById('apiKey');

  apiCheckbox.addEventListener('change', toggleApiSettings);
  apiKey.addEventListener('input', toggleApiSettings);

  // Load and save settings
  loadSettings();
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