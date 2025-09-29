const WORDS = [
  'ねこ',
  'いぬ',
  'くま',
  'さる',
  'かに',
  'うし',
  'かめ',
  'しか',
  'つき',
  'はな',
  'やま',
  'そら',
  'ゆき',
  'ほし',
  'みず',
  'かぜ',
  'あめ',
  'ゆめ',
  'むし',
  'すな',
];

const PLACEHOLDER_IMAGE = {
  src: 'assets/placeholder.svg',
  alt: 'ことばの仮イラスト',
  caption: 'カードをえらんで正解を確認しましょう',
};

const WORD_IMAGE_MAP = {
  ねこ: 'neko',
  いぬ: 'inu',
  かに: 'kani',
  はな: 'hana',
  そら: 'sora',
};
const REQUIRED_CARDS = 5;

const state = {
  currentWord: null,
  speechSupported: false,
  selectedWord: null,
};

const wordDisplay = document.getElementById('word-display');
const illustration = document.getElementById('word-illustration');
const caption = document.getElementById('illustration-caption');
const imageLabel = document.getElementById('imageLabel');
const imageCaption = document.getElementById('imageCaption');
const resultText = document.getElementById('result-text');
const cardGrid = document.getElementById('card-grid');
const speakButton = document.getElementById('speak-btn');
const speechNotice = document.getElementById('speech-notice');
const newProblemButton = document.getElementById('new-problem-btn');

let cardButtons = [];

initialize();

function initialize() {
  if (!wordDisplay || !cardGrid) {
    return;
  }

  state.speechSupported = detectSpeechSupport();
  buildCards();
  wireEvents();
  loadNewProblem();
}

function detectSpeechSupport() {
  if (typeof window === 'undefined') {
    return false;
  }

  const params = new URLSearchParams(window.location.search);
  if (params.get('nospeech') === '1') {
    return false;
  }

  return (
    'speechSynthesis' in window &&
    typeof window.speechSynthesis?.speak === 'function' &&
    typeof window.SpeechSynthesisUtterance === 'function'
  );
}

function buildCards() {
  cardGrid.innerHTML = '';
  cardButtons = Array.from({ length: REQUIRED_CARDS }, () => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'choice-card';
    button.dataset.word = '';
    button.setAttribute('role', 'listitem');
    button.addEventListener('click', onCardClick);
    cardGrid.appendChild(button);
    return button;
  });
}

function wireEvents() {
  if (speakButton) {
    updateSpeechSupportUI();
    speakButton.addEventListener('click', () => {
      const targetWord = state.selectedWord || state.currentWord;
      if (targetWord) {
        speakWord(targetWord);
      }
    });
  }

  if (newProblemButton) {
    newProblemButton.addEventListener('click', loadNewProblem);
  }
}

function updateSpeechSupportUI() {
  if (!speakButton) {
    return;
  }

  if (state.speechSupported) {
    speakButton.disabled = false;
    speakButton.removeAttribute('title');
    if (speechNotice) {
      speechNotice.hidden = true;
    }
  } else {
    speakButton.disabled = true;
    speakButton.removeAttribute('title');
    if (speechNotice) {
      speechNotice.hidden = false;
    }
  }
}

function loadNewProblem() {
  if (WORDS.length < REQUIRED_CARDS) {
    console.error('十分な単語データがありません');
    return;
  }

  state.currentWord = pickRandomWord();
  const illustrationSources = getIllustrationSources(state.currentWord);
  setIllustrationFor(state.currentWord, illustrationSources);
  state.selectedWord = null;
  resetPrompt();

  const choices = buildChoiceSet(state.currentWord, WORDS);
  cardButtons.forEach((button, index) => {
    const word = choices[index] ?? '';
    button.textContent = word;
    button.dataset.word = word;
    button.classList.remove('selected', 'correct', 'incorrect');
  });
}

function resetPrompt() {
  wordDisplay.textContent = '？？';
  if (!state.currentWord) {
    setIllustrationFor(null);
  }
  if (resultText) {
    resultText.textContent = '';
    resultText.style.color = 'var(--muted)';
  }
}

function pickRandomWord() {
  const index = Math.floor(Math.random() * WORDS.length);
  return WORDS[index];
}

function buildChoiceSet(correctWord, words = WORDS) {
  const pool = new Set(words);
  if (!pool.has(correctWord)) {
    pool.add(correctWord);
  }

  const choices = new Set([correctWord]);
  while (choices.size < REQUIRED_CARDS) {
    const candidates = Array.from(pool);
    const candidate = candidates[Math.floor(Math.random() * candidates.length)];
    choices.add(candidate);
  }

  return shuffle(Array.from(choices));
}

function shuffle(array) {
  const result = array.slice();
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function onCardClick(event) {
  const button = event.currentTarget;
  const selectedWord = button.dataset.word;

  if (!selectedWord || !state.currentWord) {
    return;
  }

  if (state.speechSupported) {
    speakWord(selectedWord);
  }

  state.selectedWord = selectedWord;

  cardButtons.forEach((card) => {
    card.classList.remove('selected', 'correct', 'incorrect');
  });

  button.classList.add('selected');

  const isCorrect = selectedWord === state.currentWord;
  if (isCorrect) {
    button.classList.add('correct');
    setResultText('せいかい！', true);
  } else {
    button.classList.add('incorrect');
    setResultText('ちがうよ', false);
    const correctButton = cardButtons.find((card) => card.dataset.word === state.currentWord);
    if (correctButton) {
      correctButton.classList.add('correct');
    }
  }

  revealCurrentWord();
}

function revealCurrentWord() {
  if (!state.currentWord) {
    return;
  }

  wordDisplay.textContent = state.currentWord;
  setIllustrationFor(state.currentWord);
}

function updateIllustrationText(word, captionText) {
  if (caption) {
    caption.textContent = captionText;
  }
  if (imageCaption) {
    imageCaption.textContent = captionText;
  }
  if (imageLabel) {
    imageLabel.textContent = word ?? '';
  }
}

function applyPlaceholderIllustration(word) {
  updateIllustrationText(word ?? null, PLACEHOLDER_IMAGE.caption);

  if (!illustration) {
    return;
  }

  illustration.onerror = null;
  illustration.onload = null;
  illustration.classList.remove('has-image');
  illustration.src = PLACEHOLDER_IMAGE.src;
  illustration.alt = PLACEHOLDER_IMAGE.alt;
}

function setIllustrationFor(word, sourcesOverride) {
  if (!word) {
    applyPlaceholderIllustration(null);
    return;
  }

  const sources = Array.isArray(sourcesOverride)
    ? [...sourcesOverride]
    : typeof sourcesOverride === 'string'
      ? [sourcesOverride]
      : getIllustrationSources(word);

  if (!sources.length) {
    applyPlaceholderIllustration(word);
    return;
  }

  const [src, ...fallbacks] = sources;
  const isPlaceholder = src === PLACEHOLDER_IMAGE.src;
  const alt = isPlaceholder ? PLACEHOLDER_IMAGE.alt : `「${word}」のイラスト`;
  const captionText = isPlaceholder
    ? PLACEHOLDER_IMAGE.caption
    : `これは「${word}」のイラストです`;

  updateIllustrationText(word, captionText);

  if (!illustration) {
    return;
  }

  if (isPlaceholder) {
    illustration.onerror = null;
    illustration.onload = null;
    illustration.classList.remove('has-image');
    illustration.alt = alt;
    illustration.src = src;
    return;
  }

  illustration.classList.remove('has-image');

  illustration.onerror = () => {
    illustration.onerror = null;
    illustration.onload = null;
    if (fallbacks.length > 0) {
      setIllustrationFor(word, fallbacks);
      return;
    }
    applyPlaceholderIllustration(word);
  };

  illustration.onload = () => {
    illustration.classList.add('has-image');
    illustration.onload = null;
    illustration.onerror = null;
  };

  illustration.alt = alt;
  illustration.src = src;
}

function setResultText(message, isCorrect) {
  if (!resultText) {
    return;
  }

  resultText.textContent = message;
  resultText.style.color = isCorrect ? 'var(--correct)' : 'var(--incorrect)';
}

function getIllustrationSources(word) {
  if (!word) {
    return [];
  }

  const sources = [];

  if (typeof WORD_IMAGE_MAP !== 'undefined' && WORD_IMAGE_MAP[word]) {
    sources.push(`assets/${WORD_IMAGE_MAP[word]}.svg`);
  }

  const hiraganaSrc = `assets/${word}.svg`;
  if (!sources.includes(hiraganaSrc)) {
    sources.push(hiraganaSrc);
  }

  return sources;
}

function getIllustrationFor(word) {
  const [primary] = getIllustrationSources(word);
  return primary ?? PLACEHOLDER_IMAGE.src;
}

function speakWord(text) {
  if (!state.speechSupported) {
    return;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ja-JP';
  utterance.rate = 0.9;

  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

window.__aiueo__ = {
  buildChoiceSet,
  WORDS,
};
