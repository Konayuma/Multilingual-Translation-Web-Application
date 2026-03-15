const API_ENDPOINT = "https://api.mymemory.translated.net/get";
const MAX_CHARACTERS = 500;
const DEFAULT_TEXT = "Hello, how are you";

const languageMap = {
  auto: { label: "Detect Language", speech: "en-US" },
  en: { label: "English", speech: "en-US" },
  fr: { label: "French", speech: "fr-FR" },
  es: { label: "Spanish", speech: "es-ES" },
  de: { label: "German", speech: "de-DE" },
  it: { label: "Italian", speech: "it-IT" },
  pt: { label: "Portuguese", speech: "pt-PT" }
};

const sourceLanguage = document.getElementById("sourceLanguage");
const targetLanguage = document.getElementById("targetLanguage");
const inputText = document.getElementById("inputText");
const outputText = document.getElementById("outputText");
const characterCounter = document.getElementById("characterCounter");
const outputCounter = document.getElementById("outputCounter");
const translationMeta = document.getElementById("translationMeta");
const feedbackMessage = document.getElementById("feedbackMessage");
const requestStateBadge = document.getElementById("requestStateBadge");
const detectedLanguageBadge = document.getElementById("detectedLanguageBadge");
const translateButton = document.getElementById("translateButton");
const swapLanguages = document.getElementById("swapLanguages");
const copyInput = document.getElementById("copyInput");
const copyOutput = document.getElementById("copyOutput");
const listenInput = document.getElementById("listenInput");
const listenOutput = document.getElementById("listenOutput");
const themeToggle = document.getElementById("themeToggle");
const themeToggleLabel = document.getElementById("themeToggleLabel");

const state = {
  debounceTimer: null,
  abortController: null,
  requestId: 0,
  lastResolvedSource: "en"
};

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("translator-theme", theme);
  const darkModeEnabled = theme === "dark";
  themeToggle.setAttribute("aria-pressed", String(darkModeEnabled));
  themeToggleLabel.textContent = darkModeEnabled ? "Light mode" : "Dark mode";
}

function initialiseTheme() {
  const savedTheme = localStorage.getItem("translator-theme");
  const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  setTheme(savedTheme || (systemPrefersDark ? "dark" : "light"));
}

function updateCharacterCounter() {
  if (inputText.value.length > MAX_CHARACTERS) {
    inputText.value = inputText.value.slice(0, MAX_CHARACTERS);
  }

  characterCounter.textContent = `${inputText.value.length}/${MAX_CHARACTERS}`;
}

function updateOutputCounter() {
  outputCounter.textContent = `${outputText.value.length} chars`;
}

function setFeedback(message, stateName = "idle") {
  feedbackMessage.textContent = message;
  feedbackMessage.dataset.state = stateName;
}

function setLoading(isLoading) {
  translateButton.disabled = isLoading;
  swapLanguages.disabled = isLoading;
  requestStateBadge.textContent = isLoading ? "Translating" : "Ready";
  requestStateBadge.classList.toggle("request-pulse", isLoading);
  requestStateBadge.classList.toggle("status-badge--quiet", !isLoading);
}

function detectLanguageFromText(text) {
  const sample = text.toLowerCase();
  const frenchSignals = [
    /\bbonjour\b/g,
    /\bcomment\b/g,
    /\ballez\b/g,
    /\bvous\b/g,
    /\bmerci\b/g,
    /\bfran[çc]ais\b/g,
    /[àâçéèêëîïôùûüÿœ]/g
  ];
  const englishSignals = [
    /\bhello\b/g,
    /\bhow\b/g,
    /\bare\b/g,
    /\byou\b/g,
    /\bthanks\b/g,
    /\bplease\b/g,
    /\bthe\b/g
  ];

  const frenchScore = frenchSignals.reduce((score, pattern) => score + (sample.match(pattern) || []).length, 0);
  const englishScore = englishSignals.reduce((score, pattern) => score + (sample.match(pattern) || []).length, 0);

  return frenchScore > englishScore ? "fr" : "en";
}

function getResolvedSourceLanguage() {
  if (sourceLanguage.value !== "auto") {
    state.lastResolvedSource = sourceLanguage.value;
    return sourceLanguage.value;
  }

  state.lastResolvedSource = detectLanguageFromText(inputText.value || DEFAULT_TEXT);
  return state.lastResolvedSource;
}

function updateDetectedBadge() {
  const activeSource = sourceLanguage.value === "auto" ? state.lastResolvedSource : sourceLanguage.value;
  detectedLanguageBadge.textContent = sourceLanguage.value === "auto"
    ? `Detected: ${languageMap[activeSource].label}`
    : languageMap[activeSource].label;
}

async function parseJsonResponse(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function getResponseMessage(data) {
  return data?.responseDetails || data?.responseData?.translatedText || "Unexpected translation error.";
}

function isPostFallbackCandidate(data) {
  const message = getResponseMessage(data).toUpperCase();
  return message.includes("NO QUERY SPECIFIED");
}

async function requestTranslation(text, sourceCode, targetCode, signal) {
  const payload = {
    q: text,
    langpair: `${sourceCode}|${targetCode}`
  };

  // The assignment specifies POST with JSON. This endpoint rejects that shape,
  // so the app retries with query parameters when the POST response proves unusable.
  try {
    const postResponse = await fetch(API_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload),
      signal
    });
    const postData = await parseJsonResponse(postResponse);

    if (postResponse.ok && postData?.responseStatus === 200 && postData?.responseData?.translatedText) {
      return postData;
    }

    if (postData && !isPostFallbackCandidate(postData)) {
      throw new Error(getResponseMessage(postData));
    }
  } catch (error) {
    if (error.name === "AbortError") {
      throw error;
    }

    if (!/Failed to fetch/i.test(error.message)) {
      const shouldRetry = /NO QUERY SPECIFIED/i.test(error.message);
      if (!shouldRetry) {
        throw error;
      }
    }
  }

  const url = new URL(API_ENDPOINT);
  url.searchParams.set("q", text);
  url.searchParams.set("langpair", `${sourceCode}|${targetCode}`);

  const getResponse = await fetch(url, { signal });
  const getData = await parseJsonResponse(getResponse);

  if (!getResponse.ok || getData?.responseStatus !== 200 || !getData?.responseData?.translatedText) {
    throw new Error(getResponseMessage(getData));
  }

  return getData;
}

async function translateText(reason = "manual") {
  const trimmedText = inputText.value.trim();
  updateCharacterCounter();

  if (!trimmedText) {
    outputText.value = "";
    updateOutputCounter();
    updateDetectedBadge();
    translationMeta.textContent = "Enter text to see a translation.";
    setFeedback("Waiting for text input.");
    return;
  }

  const resolvedSource = getResolvedSourceLanguage();
  const targetCode = targetLanguage.value;
  updateDetectedBadge();

  if (resolvedSource === targetCode) {
    outputText.value = trimmedText;
    updateOutputCounter();
    translationMeta.textContent = "Source and target match, so the original text is shown.";
    setFeedback("Source and target languages are the same.");
    return;
  }

  if (state.abortController) {
    state.abortController.abort();
  }

  const controller = new AbortController();
  state.abortController = controller;
  const requestId = ++state.requestId;

  setLoading(true);
  setFeedback("Translating text...", "loading");
  translationMeta.textContent = reason === "debounced"
    ? "Live translation updated after a short pause."
    : "Fetching translation from MyMemory.";

  try {
    const data = await requestTranslation(trimmedText, resolvedSource, targetCode, controller.signal);

    if (requestId !== state.requestId) {
      return;
    }

    outputText.value = data.responseData.translatedText;
    updateOutputCounter();
    translationMeta.textContent = `Translated from ${languageMap[resolvedSource].label} to ${languageMap[targetCode].label}.`;
    setFeedback("Translation updated successfully.");
  } catch (error) {
    if (error.name === "AbortError") {
      return;
    }

    outputText.value = "";
    updateOutputCounter();
    translationMeta.textContent = "Translation failed. Adjust the text or try again.";
    setFeedback(error.message || "Translation failed.", "error");
  } finally {
    if (requestId === state.requestId) {
      setLoading(false);
    }
  }
}

function queueTranslation() {
  window.clearTimeout(state.debounceTimer);
  state.debounceTimer = window.setTimeout(() => {
    translateText("debounced");
  }, 420);
}

async function copyTextValue(text, description) {
  if (!text.trim()) {
    setFeedback(`There is no ${description} to copy.`, "error");
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    setFeedback(`${description} copied to the clipboard.`);
  } catch {
    setFeedback(`Clipboard access failed for the ${description}.`, "error");
  }
}

function chooseVoice(languageCode) {
  const voices = window.speechSynthesis.getVoices();
  const speechCode = languageMap[languageCode]?.speech || "en-US";

  return voices.find((voice) => voice.lang.toLowerCase().startsWith(speechCode.toLowerCase().slice(0, 2))) || null;
}

function speakText(text, languageCode, description) {
  if (!text.trim()) {
    setFeedback(`There is no ${description} to read aloud.`, "error");
    return;
  }

  if (!("speechSynthesis" in window)) {
    setFeedback("Text-to-speech is not supported in this browser.", "error");
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = languageMap[languageCode]?.speech || "en-US";
  const voice = chooseVoice(languageCode);

  if (voice) {
    utterance.voice = voice;
  }

  window.speechSynthesis.speak(utterance);
  setFeedback(`${description} playback started.`);
}

function swapTranslationDirection() {
  const currentInput = inputText.value;
  const currentOutput = outputText.value;
  const resolvedSource = getResolvedSourceLanguage();
  const currentTarget = targetLanguage.value;

  inputText.value = currentOutput || currentInput;
  outputText.value = currentOutput ? currentInput : "";
  sourceLanguage.value = currentTarget;
  targetLanguage.value = resolvedSource;

  updateCharacterCounter();
  updateOutputCounter();
  translateText("manual");
}

function registerEvents() {
  inputText.addEventListener("input", () => {
    updateCharacterCounter();
    queueTranslation();
  });

  sourceLanguage.addEventListener("change", () => {
    updateDetectedBadge();
    translateText("manual");
  });

  targetLanguage.addEventListener("change", () => {
    translateText("manual");
  });

  translateButton.addEventListener("click", () => {
    translateText("manual");
  });

  swapLanguages.addEventListener("click", swapTranslationDirection);
  copyInput.addEventListener("click", () => copyTextValue(inputText.value, "input text"));
  copyOutput.addEventListener("click", () => copyTextValue(outputText.value, "translated text"));
  listenInput.addEventListener("click", () => speakText(inputText.value, getResolvedSourceLanguage(), "input text"));
  listenOutput.addEventListener("click", () => speakText(outputText.value, targetLanguage.value, "translated text"));
  themeToggle.addEventListener("click", () => {
    const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
  });

  window.speechSynthesis?.addEventListener?.("voiceschanged", () => {});
}

function initialiseApp() {
  initialiseTheme();
  inputText.value = DEFAULT_TEXT;
  sourceLanguage.value = "en";
  targetLanguage.value = "fr";
  updateCharacterCounter();
  updateDetectedBadge();
  updateOutputCounter();
  registerEvents();
  translateText("initial");
}

initialiseApp();