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
  'うみ',
  'かぜ',
  'あめ',
  'さけ',
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
  うみ: 'umi',
  ゆき: 'yuki',
  ほし: 'hoshi',
  みず: 'mizu',
  さけ: 'sake',
  かぜ: 'kaze',
  あめ: 'ame',
  ゆめ: 'yume',
  むし: 'mushi',
  すな: 'suna',
};

const WORDS_WITH_PNG = new Set([
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
  'うみ',
  'ゆき',
  'ほし',
  'みず',
  'さけ',
  'かぜ',
  'あめ',
  'ゆめ',
  'むし',
  'すな',
]);

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

const NEXT_PROBLEM_TRANSITION_DELAY_MS = 2000;

const state = {
  currentWord: null,
  speechSupported: false,
  selectedWord: null,
  currentIllustrationSrc: null,
  audioEnabledForTiles: true,
  wasWordCompleted: false,
  nextProblemTimeoutId: null,
};

const audioState = {
  context: null,
  buffers: {
    correct: null,
    incorrect: null,
    celebration: null,
  },
};

const FEEDBACK_CLIP_SOURCES = {
  correct: 'assets/audio/correct.mp3',
  incorrect: 'assets/audio/incorrect.mp3',
  celebration: 'assets/audio/daiseikai.mp3',
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
const celebrationOverlay = document.getElementById('celebration-overlay');

const illustrationContainer = illustration
  ? illustration.closest('.illustration')
  : null;

let cardButtons = [];
let letterTiles = [];
let dropSlotElements = [];
let celebrationAudioElement = null;

const dragDropState = {
  activeTile: null,
  dropTarget: null,
  animationFrame: null,
  scheduledCallbacks: [],
  pointerId: null,
  pointerStart: { x: 0, y: 0 },
  pointerHasMoved: false,
  pointerOverPool: false,
};

const POINTER_MOVE_THRESHOLD = 6;
const TOUCH_LISTENER_OPTIONS = { passive: false };

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

function setCelebrationOverlayActive(isActive) {
  const active = Boolean(isActive);

  if (celebrationOverlay) {
    celebrationOverlay.hidden = !active;
  }

  if (illustrationContainer) {
    illustrationContainer.dataset.celebrate = active ? 'true' : 'false';
  }
}

function showCelebrationOverlay() {
  setCelebrationOverlayActive(true);
}

function hideCelebrationOverlay() {
  setCelebrationOverlayActive(false);
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

  if (illustration && state.speechSupported) {
    const speakFromIllustration = () => {
      if (!(state.speechSupported && state.audioEnabledForTiles)) {
        return;
      }

      const targetWord = state.currentWord || state.selectedWord;
      if (!targetWord) {
        return;
      }

      speakWord(targetWord);
    };

    illustration.addEventListener('click', speakFromIllustration);
    illustration.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        speakFromIllustration();
      }
    });

    if (!illustration.hasAttribute('tabindex')) {
      illustration.setAttribute('tabindex', '0');
    }
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

function clearScheduledNextProblem() {
  if (state.nextProblemTimeoutId == null) {
    return;
  }

  const cancelTimer =
    (typeof window !== 'undefined' && typeof window.clearTimeout === 'function'
      ? window.clearTimeout
      : typeof clearTimeout === 'function'
      ? clearTimeout
      : null);

  if (cancelTimer) {
    cancelTimer(state.nextProblemTimeoutId);
  }

  state.nextProblemTimeoutId = null;
}

function scheduleNextProblemTransition() {
  const createTimer =
    (typeof window !== 'undefined' && typeof window.setTimeout === 'function'
      ? window.setTimeout
      : typeof setTimeout === 'function'
      ? setTimeout
      : null);

  if (!createTimer) {
    return;
  }

  clearScheduledNextProblem();

  state.nextProblemTimeoutId = createTimer(() => {
    state.nextProblemTimeoutId = null;
    loadNewProblem();
  }, NEXT_PROBLEM_TRANSITION_DELAY_MS);
}

function loadNewProblem() {
  clearScheduledNextProblem();

  if (WORDS.length < REQUIRED_CARDS) {
    console.error('十分な単語データがありません');
    return;
  }

  state.currentWord = pickRandomWord();

  state.selectedWord = null;
  state.wasWordCompleted = false;
  hideCelebrationOverlay();
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

  const supportsPointerEvents =
    typeof window !== 'undefined' && typeof window.PointerEvent === 'function';
  const supportsTouchEvents =
    !supportsPointerEvents &&
    typeof window !== 'undefined' &&
    ('ontouchstart' in window ||
      (typeof navigator !== 'undefined' && Number(navigator.maxTouchPoints) > 0));

  letterTiles.forEach((tile) => {
    tile.removeEventListener('dragstart', handleTileDragStart);
    tile.removeEventListener('dragend', handleTileDragEnd);
    tile.removeEventListener('keydown', handleTileKeyDown);
    tile.removeEventListener('pointerdown', handleTilePointerDown);
    tile.removeEventListener('pointermove', handleTilePointerMove);
    tile.removeEventListener('pointerup', handleTilePointerUp);
    tile.removeEventListener('pointercancel', handleTilePointerCancel);
    tile.removeEventListener('touchstart', handleTileTouchStart, TOUCH_LISTENER_OPTIONS);
    tile.removeEventListener('touchmove', handleTileTouchMove, TOUCH_LISTENER_OPTIONS);
    tile.removeEventListener('touchend', handleTileTouchEnd, TOUCH_LISTENER_OPTIONS);
    tile.removeEventListener('touchcancel', handleTileTouchCancel, TOUCH_LISTENER_OPTIONS);

    tile.addEventListener('dragstart', handleTileDragStart);
    tile.addEventListener('dragend', handleTileDragEnd);
    tile.addEventListener('keydown', handleTileKeyDown);

    if (supportsPointerEvents) {
      tile.addEventListener('pointerdown', handleTilePointerDown);
      tile.addEventListener('pointermove', handleTilePointerMove);
      tile.addEventListener('pointerup', handleTilePointerUp);
      tile.addEventListener('pointercancel', handleTilePointerCancel);
    } else if (supportsTouchEvents) {
      tile.addEventListener('touchstart', handleTileTouchStart, TOUCH_LISTENER_OPTIONS);
      tile.addEventListener('touchmove', handleTileTouchMove, TOUCH_LISTENER_OPTIONS);
      tile.addEventListener('touchend', handleTileTouchEnd, TOUCH_LISTENER_OPTIONS);
      tile.addEventListener('touchcancel', handleTileTouchCancel, TOUCH_LISTENER_OPTIONS);
    }
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

function handleTilePointerDown(event) {
  if (!event || !event.currentTarget) {
    return;
  }

  if (event.pointerType === 'mouse') {
    return;
  }

  const tile = event.currentTarget;
  if (!beginActivePointerDrag(tile, event.clientX, event.clientY)) {
    return;
  }

  dragDropState.pointerId = event.pointerId;
  if (typeof tile.setPointerCapture === 'function') {
    try {
      tile.setPointerCapture(event.pointerId);
    } catch (error) {
      console.warn('Failed to set pointer capture', error);
    }
  }

  event.preventDefault();
}

function handleTilePointerMove(event) {
  if (event.pointerType === 'mouse') {
    return;
  }

  if (!dragDropState.activeTile || dragDropState.pointerId !== event.pointerId) {
    return;
  }

  event.preventDefault();
  updateActivePointerDrag(event.clientX, event.clientY);
}

function handleTilePointerUp(event) {
  if (event.pointerType === 'mouse') {
    return;
  }

  if (!dragDropState.activeTile || dragDropState.pointerId !== event.pointerId) {
    return;
  }

  if (typeof dragDropState.activeTile.releasePointerCapture === 'function') {
    try {
      dragDropState.activeTile.releasePointerCapture(event.pointerId);
    } catch (error) {
      console.warn('Failed to release pointer capture', error);
    }
  }

  event.preventDefault();
  finalizeActivePointerDrag({ clientX: event.clientX, clientY: event.clientY });
}

function handleTilePointerCancel(event) {
  if (event.pointerType === 'mouse') {
    return;
  }

  if (!dragDropState.activeTile || dragDropState.pointerId !== event.pointerId) {
    return;
  }

  if (typeof dragDropState.activeTile.releasePointerCapture === 'function') {
    try {
      dragDropState.activeTile.releasePointerCapture(event.pointerId);
    } catch (error) {
      console.warn('Failed to release pointer capture', error);
    }
  }

  finalizeActivePointerDrag({ cancel: true });
}

function handleTileTouchStart(event) {
  if (!event || !event.currentTarget) {
    return;
  }

  const tile = event.currentTarget;
  if (!event.changedTouches || event.changedTouches.length === 0) {
    return;
  }

  const touch = event.changedTouches[0];
  if (!beginActivePointerDrag(tile, touch.clientX, touch.clientY)) {
    return;
  }

  dragDropState.pointerId = touch.identifier;
  event.preventDefault();
}

function handleTileTouchMove(event) {
  if (!dragDropState.activeTile) {
    return;
  }

  const identifier = dragDropState.pointerId;
  if (typeof identifier !== 'number') {
    return;
  }

  const touch =
    getTouchByIdentifier(event.changedTouches, identifier) ||
    getTouchByIdentifier(event.touches, identifier);

  if (!touch) {
    return;
  }

  event.preventDefault();
  updateActivePointerDrag(touch.clientX, touch.clientY);
}

function handleTileTouchEnd(event) {
  if (!dragDropState.activeTile) {
    return;
  }

  const identifier = dragDropState.pointerId;
  if (typeof identifier !== 'number') {
    return;
  }

  const touch = getTouchByIdentifier(event.changedTouches, identifier);
  if (!touch) {
    return;
  }

  event.preventDefault();
  finalizeActivePointerDrag({ clientX: touch.clientX, clientY: touch.clientY });
}

function handleTileTouchCancel(event) {
  if (!dragDropState.activeTile) {
    return;
  }

  const identifier = dragDropState.pointerId;
  if (typeof identifier !== 'number') {
    return;
  }

  const touch = getTouchByIdentifier(event.changedTouches, identifier);
  if (!touch) {
    return;
  }

  finalizeActivePointerDrag({ cancel: true });
}

function beginActivePointerDrag(tile, clientX, clientY) {
  if (!tile || tile.dataset.letter === '') {
    return false;
  }

  if (dragDropState.activeTile && dragDropState.activeTile !== tile) {
    finalizeActivePointerDrag({ cancel: true });
  }

  dragDropState.activeTile = tile;
  dragDropState.pointerStart = {
    x: typeof clientX === 'number' ? clientX : 0,
    y: typeof clientY === 'number' ? clientY : 0,
  };
  dragDropState.pointerHasMoved = false;
  dragDropState.pointerOverPool = false;
  tile.classList.add('is-dragging');
  tile.setAttribute('aria-grabbed', 'true');

  if (typeof clientX === 'number' && typeof clientY === 'number') {
    updateDropTargetFromPoint(clientX, clientY);
  } else {
    setDropTarget(null);
  }

  return true;
}

function updateActivePointerDrag(clientX, clientY) {
  if (!dragDropState.activeTile) {
    return;
  }

  if (typeof clientX === 'number' && typeof clientY === 'number') {
    if (!dragDropState.pointerHasMoved) {
      const deltaX = Math.abs(clientX - dragDropState.pointerStart.x);
      const deltaY = Math.abs(clientY - dragDropState.pointerStart.y);
      if (deltaX >= POINTER_MOVE_THRESHOLD || deltaY >= POINTER_MOVE_THRESHOLD) {
        dragDropState.pointerHasMoved = true;
      }
    }

    updateDropTargetFromPoint(clientX, clientY);
  }
}

function finalizeActivePointerDrag(options = {}) {
  const tile = dragDropState.activeTile;
  if (!tile) {
    return;
  }

  const { cancel = false } = options;

  if (typeof options.clientX === 'number' && typeof options.clientY === 'number') {
    updateDropTargetFromPoint(options.clientX, options.clientY);
  }

  const dropTarget = dragDropState.dropTarget;
  const overPool = dragDropState.pointerOverPool;
  const hasMoved = dragDropState.pointerHasMoved;
  const letter = tile.dataset.letter || tile.textContent || '';

  if (!cancel && letter !== '') {
    if (dropTarget) {
      fillDropSlot(dropTarget, letter);
    } else if (overPool && hasMoved) {
      // Dropped back into the pool: do nothing.
    } else if (!hasMoved) {
      const emptySlot = dropSlotElements.find((slot) => !slot.classList.contains('is-filled'));
      if (emptySlot) {
        fillDropSlot(emptySlot, letter);
      }
    }
  }

  handleTileDragEnd({ currentTarget: tile });
  dragDropState.pointerId = null;
  dragDropState.pointerOverPool = false;
  dragDropState.pointerHasMoved = false;
  dragDropState.pointerStart = { x: 0, y: 0 };
}

function updateDropTargetFromPoint(clientX, clientY) {
  if (typeof document === 'undefined') {
    return;
  }

  const element = document.elementFromPoint(clientX, clientY);
  if (!element) {
    dragDropState.pointerOverPool = false;
    setDropTarget(null);
    return;
  }

  if (letterPool && (element === letterPool || letterPool.contains(element))) {
    dragDropState.pointerOverPool = true;
    setDropTarget(null);
    return;
  }

  dragDropState.pointerOverPool = false;
  const slot = element.closest ? element.closest('.drop-slot') : null;
  setDropTarget(slot || null);
}

function getTouchByIdentifier(touchList, identifier) {
  if (!touchList || typeof touchList.length !== 'number') {
    return null;
  }

  for (let index = 0; index < touchList.length; index += 1) {
    const touch = touchList.item ? touchList.item(index) : touchList[index];
    if (touch && touch.identifier === identifier) {
      return touch;
    }
  }

  return null;
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
    if (wordDisplay && typeof state.currentWord === 'string') {
      wordDisplay.textContent = state.currentWord;
    }
    setIllustrationFor(state.currentWord, { showCaption: true });
    showCelebrationOverlay();
    setResultText('大正解！', true);
    playCelebrationSound();
    scheduleNextProblemTransition();
  } else if (!isComplete && state.wasWordCompleted) {
    state.wasWordCompleted = false;
    if (wordDisplay) {
      wordDisplay.textContent = '？？';
    }
    setResultText('？？');
    hideCelebrationOverlay();
    showIllustrationPreview();
    clearScheduledNextProblem();
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

  setResultText('？？');
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
    scheduleNextProblemTransition();
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
  hideCelebrationOverlay();

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
  if (typeof isCorrect === 'boolean') {
    resultText.style.color = isCorrect ? 'var(--correct)' : 'var(--incorrect)';
  } else {
    resultText.style.color = 'var(--muted)';
  }
}

function getIllustrationFor(word) {
  if (!word) {
    return PLACEHOLDER_IMAGE.src;
  }

  if (typeof WORD_IMAGE_MAP !== 'undefined' && WORD_IMAGE_MAP[word]) {
    const mappedValue = WORD_IMAGE_MAP[word];
    if (mappedValue.includes('.')) {
      return `assets/${mappedValue}`;
    }

    const extension = WORDS_WITH_PNG.has(word) ? '.png' : '.svg';
    return `assets/${mappedValue}${extension}`;
  }

  const extension = WORDS_WITH_PNG.has(word) ? '.png' : '.svg';
  return `assets/${word}${extension}`;
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

    const fallbackBuffers = createFallbackFeedbackBuffers(context);
    audioState.buffers.correct = fallbackBuffers.correct;
    audioState.buffers.incorrect = fallbackBuffers.incorrect;
    audioState.buffers.celebration = null;

    const isFileProtocol =
      typeof window.location === 'object' && window.location?.protocol === 'file:';
    const fetchUnavailable = typeof fetch !== 'function';

    if (isFileProtocol || fetchUnavailable) {
      if (isFileProtocol) {
        console.info(
          'プリロード済みの効果音は file: プロトコルでは使用できないため、合成音にフォールバックします。'
        );
      }
      audioState.buffers.celebration = null;
      return;
    }

    const clipPromises = Object.entries(FEEDBACK_CLIP_SOURCES).map(
      ([key, url]) =>
        fetch(url)
          .then((response) => {
            if (!response.ok) {
              throw new Error(`Failed to load feedback clip: ${url}`);
            }
            return response.arrayBuffer();
          })
          .then((arrayBuffer) => decodeAudioData(context, arrayBuffer))
          .then((buffer) => ({ key, buffer }))
    );

    Promise.all(clipPromises)
      .then((results) => {
        results.forEach(({ key, buffer }) => {
          audioState.buffers[key] = buffer;
        });
      })
      .catch((error) => {
        console.warn(
          'プリロード済みのフィードバックサウンドを読み込めなかったため、合成音にフォールバックします',
          error
        );
        audioState.buffers.correct = fallbackBuffers.correct;
        audioState.buffers.incorrect = fallbackBuffers.incorrect;
        audioState.buffers.celebration = null;
      });
  } catch (error) {
    console.warn('フィードバックサウンドの初期化に失敗しました', error);
    audioState.context = null;
    audioState.buffers.correct = null;
    audioState.buffers.incorrect = null;
    audioState.buffers.celebration = null;
  }
}

function createFallbackFeedbackBuffers(context) {
  return {
    correct: createToneBuffer(context, {
      duration: 0.28,
      attack: 0.01,
      release: 0.09,
      amplitude: 0.7,
      partials: [
        { frequency: 660, endFrequency: 990, amplitude: 1 },
        { frequency: 990, endFrequency: 1320, amplitude: 0.3 },
      ],
    }),
    incorrect: createToneBuffer(context, {
      duration: 0.32,
      attack: 0.01,
      release: 0.12,
      amplitude: 0.7,
      partials: [
        { frequency: 240, endFrequency: 160, amplitude: 1 },
        { frequency: 480, endFrequency: 220, amplitude: 0.35 },
      ],
    }),
  };
}

function decodeAudioData(context, arrayBuffer) {
  return new Promise((resolve, reject) => {
    let settled = false;

    const resolveOnce = (value) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(value);
    };

    const rejectOnce = (error) => {
      if (settled) {
        return;
      }
      settled = true;
      reject(error);
    };

    const decodePromise = context.decodeAudioData(
      arrayBuffer,
      (buffer) => resolveOnce(buffer),
      (error) => rejectOnce(error)
    );

    if (decodePromise && typeof decodePromise.then === 'function') {
      decodePromise.then(resolveOnce).catch(rejectOnce);
    }
  });
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

function playCelebrationSound() {
  const { context, buffers } = audioState;
  const clipUrl = FEEDBACK_CLIP_SOURCES.celebration;

  if (context && buffers.celebration) {
    try {
      if (context.state === 'suspended') {
        context.resume();
      }

      const bufferSource = context.createBufferSource();
      bufferSource.buffer = buffers.celebration;

      const gainNode = context.createGain();
      gainNode.gain.value = FEEDBACK_VOLUME.default;

      bufferSource.connect(gainNode);
      gainNode.connect(context.destination);
      bufferSource.start();
      return;
    } catch (error) {
      console.warn('お祝いサウンドの再生に失敗しました', error);
    }
  }

  if (typeof Audio === 'function' && typeof clipUrl === 'string') {
    if (!celebrationAudioElement) {
      celebrationAudioElement = new Audio(clipUrl);
    } else if (celebrationAudioElement.src !== clipUrl) {
      celebrationAudioElement.src = clipUrl;
    }

    try {
      celebrationAudioElement.currentTime = 0;
      const playPromise = celebrationAudioElement.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {});
      }
    } catch (error) {
      console.warn('お祝いサウンドの再生に失敗しました', error);
    }
    return;
  }

  playFeedbackSound(true);
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
