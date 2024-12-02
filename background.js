// background.js
import { getLanguageName } from './utils/languages.js';

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'translate') {
    handleTranslation(request.text, request.sourceLang, request.targetLang, request.apiKey)
      .then(sendResponse)
      .catch(error => sendResponse({ error: error.message }));
    return true; // Will respond asynchronously
  }
});

function initializeGeminiClient(apiKey) {
  return {
    generationConfig: {
      model: "gemini-1.5-flash-8b",
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
      ]
    },
    apiKey: apiKey
  };
}

async function handleTranslation(text, sourceLang, targetLang, apiKey) {
  try {
    console.log('Starting handleTranslation');
    if (!apiKey) {
      throw new Error('API key is not set');
    }

    const prompt = generatePrompt(text, sourceLang, targetLang);
    console.log('Generated prompt:', prompt);

    const translatedText = await callGeminiAPI(prompt, apiKey);
    console.log('API Response:', translatedText);
    
    // レスポンスをオブジェクトとして返す
    return { text: translatedText };  // この形式に修正

  } catch (error) {
    console.error('Translation error:', error);
    throw error;
  }
}

function generatePrompt(text, sourceLang, targetLang) {

  console.log(`Translate ${sourceLang}`)
  const sourceLanguageName = getLanguageName(sourceLang);
  const targetLanguageName = getLanguageName(targetLang);
  return `Translate ${sourceLanguageName} to ${targetLanguageName}. Only response translate result.\n\n${text}`;
}

async function callGeminiAPI(prompt, apiKey, maxRetries = 3) {
  const client = initializeGeminiClient(apiKey);
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${client.generationConfig.model}:generateContent`;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(`${endpoint}?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          safetySettings: client.generationConfig.safetySettings
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`API request failed: ${response.status} - ${JSON.stringify(errorData)}`);
      }

      const data = await response.json();
      console.log('Raw API response:', data);
      
      // レスポンスの構造をより詳細にチェック
      if (!data.candidates || !data.candidates[0]) {
        throw new Error('No candidates in response');
      }

      const candidate = data.candidates[0];
      if (!candidate.content || !candidate.content.parts) {
        throw new Error('Invalid candidate format');
      }

      // テキストデータの取り出しを確実に
      const translatedText = candidate.content.parts[0]?.text;
      if (!translatedText) {
        throw new Error('No text in response');
      }

      console.log('Extracted text:', translatedText); // 抽出したテキストを確認
      return translatedText;

    } catch (error) {
      console.error(`Attempt ${attempt + 1} failed:`, error);
      
      if (attempt === maxRetries - 1) {
        throw error;
      }
      
      await new Promise(resolve => setTimeout(resolve, 3000 * (attempt + 1)));
    }
  }
}