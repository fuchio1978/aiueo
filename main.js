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
  くま: 'kuma',
  さる: 'saru',
  かに: 'kani',
  うし: 'ushi',
  かめ: 'kame',
  しか: 'shika',
  つき: 'tsuki',
  はな: 'hana',
  やま: 'yama',
  そら: 'sora',
  ゆき: 'yuki',
  ほし: 'hoshi',
  みず: 'mizu',
  かぜ: 'kaze',
  あめ: 'ame',
  ゆめ: 'yume',
  むし: 'mushi',
  すな: 'suna',
};
const REQUIRED_CARDS = 5;

const state = {
  currentWord: null,
  speechSupported: false,
  selectedWord: null,
  currentIllustrationSrc: null,
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
    window.speechSynthesis &&
    typeof window.speechSynthesis.speak === 'function' &&
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

  state.selectedWord = null;
  resetPrompt();
  showIllustrationPreview();

  const choices = buildChoiceSet(state.currentWord, WORDS);
  cardButtons.forEach((button, index) => {
    const choice = choices[index];
    const word =
      typeof choice !== 'undefined' && choice !== null ? choice : '';
    button.textContent = word;
    button.dataset.word = word;
    button.classList.remove('selected', 'correct', 'incorrect');
  });
}

function resetPrompt() {
  wordDisplay.textContent = '？？';

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
  setIllustrationFor(state.currentWord, { showCaption: true });
}

function showIllustrationPreview() {
  if (!state.currentWord) {
    setIllustrationFor(null, { showCaption: true });
    return;
  }

  setIllustrationFor(state.currentWord, { showCaption: false });
}

function setIllustrationFor(word, options = {}) {
  const { showCaption = true } = options;

  if (!illustration) {
    return;
  }

  const src = getIllustrationFor(word);
  const altText = word ? `${word}のイラスト` : PLACEHOLDER_IMAGE.alt;
  const captionText = word ? altText : PLACEHOLDER_IMAGE.caption;

  if (state.currentIllustrationSrc !== src) {
    illustration.classList.remove('has-image');
    illustration.onload = () => {
      illustration.classList.add('has-image');
      illustration.onload = null;
    };

    illustration.onerror = () => {
      console.warn(`イラストの読み込みに失敗しました: ${word || '(placeholder)'}`);
      illustration.onerror = null;
      illustration.onload = null;
      illustration.src = PLACEHOLDER_IMAGE.src;
      state.currentIllustrationSrc = PLACEHOLDER_IMAGE.src;
      illustration.classList.add('has-image');
      illustration.alt = PLACEHOLDER_IMAGE.alt;
      if (caption) {
        caption.textContent = PLACEHOLDER_IMAGE.caption;
        caption.hidden = false;
      }
    };

    illustration.src = src;
    state.currentIllustrationSrc = src;
  }

  illustration.alt = altText;
  if (caption) {
    if (showCaption) {
      caption.textContent = captionText;
      caption.hidden = false;
    } else {
      caption.textContent = '';
      caption.hidden = true;
    }
  }
}

function setResultText(message, isCorrect) {
  if (!resultText) {
    return;
  }

  resultText.textContent = message;
  resultText.style.color = isCorrect ? 'var(--correct)' : 'var(--incorrect)';
}

function getIllustrationFor(word) {
  if (!word) {
    return PLACEHOLDER_IMAGE.src;
  }

  if (typeof WORD_IMAGE_MAP !== 'undefined' && WORD_IMAGE_MAP[word]) {
    return `assets/${WORD_IMAGE_MAP[word]}.svg`;
  }

  return `assets/${word}.svg`;
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
