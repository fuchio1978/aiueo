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
const LETTER_TILE_COUNT = 5;
const DROP_SLOT_COUNT = 2;
const UNIQUE_LETTERS = Array.from(
  new Set(
    WORDS.reduce((acc, word) => {
      word.split('').forEach((char) => acc.push(char));
      return acc;
    }, [])
  )
);

const state = {
  currentWord: null,
  speechSupported: false,
  selectedWord: null,
  currentIllustrationSrc: null,
  audioEnabledForTiles: true,
  wasWordCompleted: false,
};

const audioState = {
  context: null,
  buffers: {
    correct: null,
    incorrect: null,
  },
};

const FEEDBACK_VOLUME = {
  default: 0.45,
  withSpeech: 0.2,
};

const wordDisplay = document.getElementById('word-display');
const illustration = document.getElementById('word-illustration');
const caption = document.getElementById('illustration-caption');
const imageLabel = document.getElementById('imageLabel');
const imageCaption = document.getElementById('imageCaption');
const resultText = document.getElementById('result-text');
const cardGrid = document.getElementById('card-grid');
const letterPool = document.getElementById('letter-pool');
const dropSlotsContainer = document.getElementById('drop-slots');
const speakButton = document.getElementById('speak-btn');
const speechNotice = document.getElementById('speech-notice');
const newProblemButton = document.getElementById('new-problem-btn');
const tileAudioToggleButton = document.getElementById('toggle-tile-audio-btn');
const tileAudioStatusText = document.getElementById('tile-audio-status');

const illustrationContainer = illustration
  ? illustration.closest('.illustration')
  : null;

let cardButtons = [];
let letterTiles = [];
let dropSlotElements = [];

const dragDropState = {
  activeTile: null,
  dropTarget: null,
  animationFrame: null,
  scheduledCallbacks: [],
};

initialize();

function initialize() {
  if (!wordDisplay || !cardGrid) {
    return;
  }

  state.speechSupported = detectSpeechSupport();
  createFeedbackSounds();
  buildCards();
  renderDropSlots();
  buildLetterTiles();
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

function buildLetterTiles() {
  if (!letterPool) {
    return;
  }

  letterPool.innerHTML = '';
  letterTiles = Array.from({ length: LETTER_TILE_COUNT }, (_, index) => {
    const tile = document.createElement('div');
    tile.className = 'letter-tile';
    tile.dataset.letter = '';
    tile.dataset.tileIndex = String(index);
    tile.draggable = true;
    tile.tabIndex = 0;
    tile.setAttribute('role', 'listitem');
    tile.setAttribute('aria-roledescription', 'ドラッグできるひらがなカード');
    tile.setAttribute('aria-grabbed', 'false');
    tile.textContent = '';
    tile.addEventListener('click', handleTileClick);
    tile.addEventListener('keydown', handleTileSpeechKeyDown);
    letterPool.appendChild(tile);
    return tile;
  });

  initializeDragAndDrop();
}

function renderDropSlots() {
  if (!dropSlotsContainer) {
    return;
  }

  dropSlotElements = Array.from(dropSlotsContainer.querySelectorAll('.drop-slot'));

  const deficit = DROP_SLOT_COUNT - dropSlotElements.length;
  for (let i = 0; i < deficit; i += 1) {
    const slot = document.createElement('div');
    slot.className = 'drop-slot';
    slot.dataset.slotIndex = String(dropSlotElements.length + i);
    slot.setAttribute('role', 'listitem');
    slot.setAttribute('aria-dropeffect', 'move');
    dropSlotsContainer.appendChild(slot);
  }

  dropSlotElements = Array.from(dropSlotsContainer.querySelectorAll('.drop-slot'));
  dropSlotElements.slice(0, DROP_SLOT_COUNT).forEach((slot, index) => {
    slot.dataset.slotIndex = String(index);
    slot.setAttribute('role', 'listitem');
    slot.setAttribute('aria-roledescription', '文字カードのドロップ先');
    slot.setAttribute('aria-dropeffect', 'move');
    slot.textContent = '？';
    slot.dataset.letter = '';
    slot.classList.remove('is-drop-target', 'is-filled', 'is-correct', 'is-incorrect');
    updateSlotAriaLabel(slot, index, '？', null);
  });

  initializeDragAndDrop();
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

  if (tileAudioToggleButton) {
    updateTileAudioToggleUI();
    tileAudioToggleButton.addEventListener('click', () => {
      state.audioEnabledForTiles = !state.audioEnabledForTiles;
      updateTileAudioToggleUI();
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

  updateTileAudioToggleUI();
}

function updateTileAudioToggleUI() {
  if (!tileAudioToggleButton) {
    return;
  }

  const enabled = Boolean(state.audioEnabledForTiles);
  const pressed = state.speechSupported && enabled;
  tileAudioToggleButton.disabled = !state.speechSupported;
  tileAudioToggleButton.setAttribute('aria-pressed', pressed ? 'true' : 'false');

  if (!state.speechSupported) {
    tileAudioToggleButton.title = '音声が利用できません';
  } else {
    tileAudioToggleButton.removeAttribute('title');
  }

  if (tileAudioStatusText) {
    if (!state.speechSupported) {
      tileAudioStatusText.textContent = '利用不可';
    } else {
      tileAudioStatusText.textContent = enabled ? 'オン' : 'オフ';
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
  state.wasWordCompleted = false;
  resetPrompt();
  showIllustrationPreview();
  renderDropSlots();
  renderLetterCandidates(state.currentWord);

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

function initializeDragAndDrop() {
  if (!letterPool) {
    return;
  }

  letterTiles.forEach((tile) => {
    tile.removeEventListener('dragstart', handleTileDragStart);
    tile.removeEventListener('dragend', handleTileDragEnd);
    tile.removeEventListener('keydown', handleTileKeyDown);

    tile.addEventListener('dragstart', handleTileDragStart);
    tile.addEventListener('dragend', handleTileDragEnd);
    tile.addEventListener('keydown', handleTileKeyDown);
  });

  const dropTargets = [...dropSlotElements];
  dropTargets.forEach((slot) => {
    slot.removeEventListener('dragenter', handleDropTargetEnter);
    slot.removeEventListener('dragover', handleDropTargetOver);
    slot.removeEventListener('dragleave', handleDropTargetLeave);
    slot.removeEventListener('drop', handleDropOnSlot);

    slot.addEventListener('dragenter', handleDropTargetEnter);
    slot.addEventListener('dragover', handleDropTargetOver);
    slot.addEventListener('dragleave', handleDropTargetLeave);
    slot.addEventListener('drop', handleDropOnSlot);
  });

  letterPool.removeEventListener('dragenter', handleDropTargetEnter);
  letterPool.removeEventListener('dragover', handleDropTargetOver);
  letterPool.removeEventListener('dragleave', handleDropTargetLeave);
  letterPool.removeEventListener('drop', handleDropOnPool);

  letterPool.addEventListener('dragenter', handleDropTargetEnter);
  letterPool.addEventListener('dragover', handleDropTargetOver);
  letterPool.addEventListener('dragleave', handleDropTargetLeave);
  letterPool.addEventListener('drop', handleDropOnPool);
}

function handleTileClick(event) {
  const tile = event.currentTarget;
  if (!tile) {
    return;
  }

  const letter = (tile.dataset.letter || tile.textContent || '').trim();
  if (letter === '') {
    return;
  }

  if (!(state.speechSupported && state.audioEnabledForTiles)) {
    return;
  }

  speakWord(letter);
}

function handleTileSpeechKeyDown(event) {
  if (event.key !== 'Enter' && event.key !== ' ') {
    return;
  }

  handleTileClick(event);
}

function handleTileDragStart(event) {
  const tile = event.currentTarget;
  if (!tile || tile.dataset.letter === '') {
    event.preventDefault();
    return;
  }

  dragDropState.activeTile = tile;
  tile.classList.add('is-dragging');
  tile.setAttribute('aria-grabbed', 'true');

  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', tile.dataset.letter || tile.textContent || '');
  }
}

function handleTileDragEnd(event) {
  const tile = event.currentTarget;
  tile.classList.remove('is-dragging');
  tile.setAttribute('aria-grabbed', 'false');
  dragDropState.activeTile = null;
  setDropTarget(null);
}

function handleDropTargetEnter(event) {
  if (!dragDropState.activeTile) {
    return;
  }

  const target = getDropTarget(event.currentTarget);
  if (!target) {
    return;
  }

  event.preventDefault();
  setDropTarget(target);
}

function handleDropTargetOver(event) {
  if (!dragDropState.activeTile) {
    return;
  }

  const target = getDropTarget(event.currentTarget);
  if (!target) {
    return;
  }

  event.preventDefault();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = target === letterPool ? 'none' : 'move';
  }
  setDropTarget(target);
}

function handleDropTargetLeave(event) {
  const target = getDropTarget(event.currentTarget);
  if (!target) {
    return;
  }

  if (dragDropState.dropTarget === target) {
    setDropTarget(null);
  }
}

function handleDropOnSlot(event) {
  if (!dragDropState.activeTile) {
    return;
  }

  const slot = getDropTarget(event.currentTarget);
  if (!slot) {
    return;
  }

  event.preventDefault();
  const letter = dragDropState.activeTile.dataset.letter || dragDropState.activeTile.textContent || '';
  fillDropSlot(slot, letter);
  handleTileDragEnd({ currentTarget: dragDropState.activeTile });
}

function handleDropOnPool(event) {
  if (!dragDropState.activeTile) {
    return;
  }

  event.preventDefault();
  handleTileDragEnd({ currentTarget: dragDropState.activeTile });
}

function handleTileKeyDown(event) {
  const tile = event.currentTarget;
  if (!tile || tile.dataset.letter === '') {
    return;
  }

  if (event.key === 'Enter' || event.key === ' ') {
    const emptySlot = dropSlotElements.find((slot) => !slot.classList.contains('is-filled'));
    if (emptySlot) {
      event.preventDefault();
      fillDropSlot(emptySlot, tile.dataset.letter || tile.textContent || '');
    }
  }
}

function fillDropSlot(slot, letter) {
  if (!slot) {
    return;
  }

  const value = typeof letter === 'string' ? letter.trim() : '';
  if (value === '') {
    clearDropSlot(slot);
    return;
  }

  scheduleAnimationFrame(() => {
    slot.textContent = value;
    slot.dataset.letter = value;
    slot.classList.add('is-filled');
    const slotIndex = getSlotIndex(slot);
    const expectedLetter = getExpectedLetterForSlot(slotIndex);
    const hasExpectedLetter = expectedLetter !== '';
    const isCorrect = hasExpectedLetter && expectedLetter === value;
    applySlotFeedback(slot, hasExpectedLetter, isCorrect);
    updateSlotAriaLabel(slot, slotIndex, value, hasExpectedLetter ? isCorrect : null);
    playFeedbackSound(isCorrect);
    updateWordCompletionState();
  });
}

function clearDropSlot(slot) {
  if (!slot) {
    return;
  }

  scheduleAnimationFrame(() => {
    slot.textContent = '？';
    slot.dataset.letter = '';
    slot.classList.remove('is-filled', 'is-correct', 'is-incorrect');
    const slotIndex = getSlotIndex(slot);
    updateSlotAriaLabel(slot, slotIndex, '？', null);
    updateWordCompletionState();
  });
}

function getSlotIndex(slot) {
  if (!slot) {
    return -1;
  }

  const index = Number(slot.dataset.slotIndex);
  return Number.isNaN(index) ? -1 : index;
}

function getExpectedLetterForSlot(index) {
  if (typeof state.currentWord !== 'string') {
    return '';
  }

  if (typeof index !== 'number' || Number.isNaN(index) || index < 0) {
    return '';
  }

  return state.currentWord.charAt(index) || '';
}

function applySlotFeedback(slot, hasExpectedLetter, isCorrect) {
  if (!slot || !slot.classList) {
    return;
  }

  slot.classList.remove('is-correct', 'is-incorrect');

  if (!slot.classList.contains('is-filled') || !hasExpectedLetter) {
    return;
  }

  slot.classList.add(isCorrect ? 'is-correct' : 'is-incorrect');
}

function updateSlotAriaLabel(slot, slotIndex, value, isCorrect) {
  if (!slot) {
    return;
  }

  const index =
    typeof slotIndex === 'number' && !Number.isNaN(slotIndex) && slotIndex >= 0
      ? slotIndex
      : getSlotIndex(slot);
  const positionText = index >= 0 ? `${index + 1}文字目のスロット` : '文字スロット';
  const displayValue = value && value !== '' ? value : '？';
  let statusText = '';

  if (displayValue !== '？' && typeof isCorrect === 'boolean') {
    statusText = isCorrect ? ' - せいかい' : ' - ちがうよ';
  }

  slot.setAttribute('aria-label', `${positionText}（${displayValue}）${statusText}`.trim());
}

function checkAllSlotsCorrect() {
  if (typeof state.currentWord !== 'string' || state.currentWord.length === 0) {
    return false;
  }

  for (let i = 0; i < state.currentWord.length; i += 1) {
    const slot = dropSlotElements[i];
    if (!slot) {
      return false;
    }

    const slotLetter = typeof slot.dataset.letter === 'string' ? slot.dataset.letter : '';
    if (slotLetter !== state.currentWord.charAt(i)) {
      return false;
    }
  }

  const extraFilled = dropSlotElements
    .slice(state.currentWord.length)
    .some((slot) => slot && typeof slot.dataset.letter === 'string' && slot.dataset.letter !== '');

  return !extraFilled;
}

function updateWordCompletionState() {
  const isComplete = checkAllSlotsCorrect();

  if (isComplete && !state.wasWordCompleted) {
    state.wasWordCompleted = true;
    playFeedbackSound(true);
  } else if (!isComplete && state.wasWordCompleted) {
    state.wasWordCompleted = false;
  }
}

function setDropTarget(target) {
  if (dragDropState.dropTarget === target) {
    return;
  }

  const previous = dragDropState.dropTarget;
  dragDropState.dropTarget = target && target !== letterPool ? target : null;

  scheduleAnimationFrame(() => {
    if (previous && previous.classList) {
      previous.classList.remove('is-drop-target');
    }
    if (dragDropState.dropTarget && dragDropState.dropTarget.classList) {
      dragDropState.dropTarget.classList.add('is-drop-target');
    }
  });
}

function getDropTarget(element) {
  if (!element) {
    return null;
  }

  if (element === letterPool) {
    return letterPool;
  }

  return element.classList && element.classList.contains('drop-slot') ? element : null;
}

function scheduleAnimationFrame(callback) {
  if (typeof callback !== 'function') {
    return;
  }

  if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
    callback();
    return;
  }

  dragDropState.scheduledCallbacks.push(callback);

  if (dragDropState.animationFrame) {
    return;
  }

  dragDropState.animationFrame = window.requestAnimationFrame(() => {
    const tasks = dragDropState.scheduledCallbacks.slice();
    dragDropState.scheduledCallbacks.length = 0;
    dragDropState.animationFrame = null;
    tasks.forEach((task) => {
      try {
        task();
      } catch (error) {
        console.error('ドラッグ処理中の更新に失敗しました', error);
      }
    });
  });
}

function renderLetterCandidates(word) {
  if (!letterPool) {
    return;
  }

  if (!letterTiles.length) {
    buildLetterTiles();
  }

  const letters = buildLetterCandidateSet(word);
  letterTiles.forEach((tile, index) => {
    const letter = typeof letters[index] === 'string' ? letters[index] : '';
    tile.textContent = letter;
    tile.dataset.letter = letter;
    tile.setAttribute('aria-grabbed', 'false');
    tile.setAttribute('aria-hidden', letter === '' ? 'true' : 'false');
    tile.hidden = letter === '';
  });
}

function buildLetterCandidateSet(word) {
  if (typeof word !== 'string' || word.length === 0) {
    return new Array(LETTER_TILE_COUNT).fill('');
  }

  const requiredLetters = word.split('');
  const candidates = [...requiredLetters];

  while (candidates.length < LETTER_TILE_COUNT) {
    const poolIndex = Math.floor(Math.random() * UNIQUE_LETTERS.length);
    const letter = UNIQUE_LETTERS[poolIndex];
    if (typeof letter === 'string' && letter.length > 0) {
      candidates.push(letter);
    }
  }

  return shuffle(candidates).slice(0, LETTER_TILE_COUNT);
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

  if (state.speechSupported && state.audioEnabledForTiles) {
    speakWord(selectedWord);
  }

  state.selectedWord = selectedWord;

  cardButtons.forEach((card) => {
    card.classList.remove('selected', 'correct', 'incorrect');
  });

  button.classList.add('selected');

  const isCorrect = selectedWord === state.currentWord;
  playFeedbackSound(isCorrect);
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

function normalizeIllustrationOptions(options) {
  if (typeof options === 'boolean') {
    return {
      reveal: options,
      preview: !options,
      showCaption: options,
    };
  }

  const isObject = options && typeof options === 'object';
  const input = isObject ? options : {};
  const has = (prop) => Object.prototype.hasOwnProperty.call(input, prop);

  let reveal = has('reveal') ? Boolean(input.reveal) : true;
  let preview = has('preview')
    ? Boolean(input.preview)
    : has('reveal')
    ? !reveal
    : false;
  let showCaption = has('showCaption')
    ? Boolean(input.showCaption)
    : has('reveal')
    ? reveal
    : has('preview')
    ? !preview
    : true;

  if (!has('preview') && !has('reveal') && has('showCaption')) {
    preview = !showCaption;
    reveal = showCaption;
  }

  return {
    reveal,
    preview,
    showCaption,
  };
}

function setIllustrationFor(word, options = {}) {
  const { reveal, preview, showCaption } = normalizeIllustrationOptions(options);

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
  illustration.dataset.preview = preview ? 'true' : 'false';
  illustration.dataset.reveal = reveal ? 'true' : 'false';
  if (illustrationContainer) {
    illustrationContainer.dataset.preview = preview ? 'true' : 'false';
    illustrationContainer.dataset.reveal = reveal ? 'true' : 'false';
  }
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

function createFeedbackSounds() {
  if (typeof window === 'undefined') {
    return;
  }

  const AudioContextImpl = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextImpl) {
    return;
  }

  if (audioState.context) {
    return;
  }

  try {
    const context = new AudioContextImpl();
    audioState.context = context;
    audioState.buffers.correct = createToneBuffer(context, {
      duration: 0.28,
      attack: 0.01,
      release: 0.09,
      amplitude: 0.7,
      partials: [
        { frequency: 660, endFrequency: 990, amplitude: 1 },
        { frequency: 990, endFrequency: 1320, amplitude: 0.3 },
      ],
    });
    audioState.buffers.incorrect = createToneBuffer(context, {
      duration: 0.32,
      attack: 0.01,
      release: 0.12,
      amplitude: 0.7,
      partials: [
        { frequency: 240, endFrequency: 160, amplitude: 1 },
        { frequency: 480, endFrequency: 220, amplitude: 0.35 },
      ],
    });
  } catch (error) {
    console.warn('フィードバックサウンドの初期化に失敗しました', error);
    audioState.context = null;
    audioState.buffers.correct = null;
    audioState.buffers.incorrect = null;
  }
}

function createToneBuffer(context, options = {}) {
  const {
    duration = 0.25,
    attack = 0.01,
    release = 0.1,
    amplitude = 0.5,
    partials = [],
  } = options;

  const effectivePartials =
    partials.length > 0
      ? partials
      : [
          {
            frequency: options.frequency || 440,
            endFrequency:
              typeof options.endFrequency === 'number'
                ? options.endFrequency
                : options.frequency || 440,
            amplitude: 1,
          },
        ];

  const sampleRate = context.sampleRate;
  const frameCount = Math.max(1, Math.floor(sampleRate * duration));
  const buffer = context.createBuffer(1, frameCount, sampleRate);
  const data = buffer.getChannelData(0);
  const phases = new Array(effectivePartials.length).fill(0);

  for (let i = 0; i < frameCount; i += 1) {
    const t = i / sampleRate;
    const progress = frameCount > 1 ? i / (frameCount - 1) : 0;
    const envelope = computeEnvelope(t, duration, attack, release);
    let sampleValue = 0;

    effectivePartials.forEach((partial, index) => {
      const startFrequency = partial.frequency;
      const endFrequency =
        typeof partial.endFrequency === 'number' ? partial.endFrequency : startFrequency;
      const frequency = startFrequency + (endFrequency - startFrequency) * progress;
      const increment = (2 * Math.PI * frequency) / sampleRate;
      phases[index] += increment;
      const partialAmplitude = typeof partial.amplitude === 'number' ? partial.amplitude : 1;
      sampleValue += Math.sin(phases[index]) * partialAmplitude;
    });

    const normalized = sampleValue / effectivePartials.length;
    data[i] = normalized * envelope * amplitude;
  }

  return buffer;
}

function computeEnvelope(time, duration, attack, release) {
  const attackDuration = Math.max(0, Math.min(attack, duration));
  const releaseDuration = Math.max(0, Math.min(release, duration));
  const sustainStart = attackDuration;
  const releaseStart = Math.max(duration - releaseDuration, sustainStart);

  if (attackDuration > 0 && time < attackDuration) {
    return time / attackDuration;
  }

  if (time >= releaseStart && releaseDuration > 0) {
    return Math.max(0, (duration - time) / releaseDuration);
  }

  return 1;
}

function playFeedbackSound(isCorrect) {
  const key = isCorrect ? 'correct' : 'incorrect';
  const { context, buffers } = audioState;

  if (!context || !buffers[key]) {
    return;
  }

  try {
    if (context.state === 'suspended') {
      context.resume();
    }

    const bufferSource = context.createBufferSource();
    bufferSource.buffer = buffers[key];

    const gainNode = context.createGain();
    const shouldReduceVolume =
      state.speechSupported &&
      typeof window !== 'undefined' &&
      window.speechSynthesis &&
      typeof window.speechSynthesis === 'object' &&
      window.speechSynthesis.speaking;

    gainNode.gain.value = shouldReduceVolume
      ? FEEDBACK_VOLUME.withSpeech
      : FEEDBACK_VOLUME.default;

    bufferSource.connect(gainNode);
    gainNode.connect(context.destination);
    bufferSource.start();
  } catch (error) {
    console.warn('フィードバックサウンドの再生に失敗しました', error);
  }
}

window.__aiueo__ = {
  buildChoiceSet,
  WORDS,
};
