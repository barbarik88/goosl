const gameState = {
  balance: 2500,
  bet: 2,
  minWin: 10,
  bonusBank: 1500,
  bonusPot: 0,
  freeSpins: 150,
  jackpots: {
    grand: 7500,
    major: 3200,
    minor: 950,
    mini: 150,
  },
  timerSeconds: 600,
  lastWin: 0,
  isSpinning: false,
  soundsEnabled: true,
};

const SYMBOLS = [
  { type: 'multiplier', multiplier: 2, displayValue: 'x2', note: 'Boost', tier: 'base', weight: 18 },
  { type: 'multiplier', multiplier: 3, displayValue: 'x3', note: 'Boost', tier: 'base', weight: 16 },
  { type: 'multiplier', multiplier: 5, displayValue: 'x5', note: 'Boost', tier: 'base', weight: 14 },
  { type: 'multiplier', multiplier: 10, displayValue: 'x10', note: 'Power', tier: 'base', weight: 10 },
  { type: 'multiplier', multiplier: 20, displayValue: 'x20', note: 'Power', tier: 'rare', weight: 8 },
  { type: 'multiplier', multiplier: 75, displayValue: 'x75', note: 'Jackpot', tier: 'rare', weight: 4 },
  { type: 'multiplier', multiplier: 150, displayValue: 'x150', note: 'Epic', tier: 'epic', weight: 2 },
  { type: 'multiplier', multiplier: 200, displayValue: 'x200', note: 'Legend', tier: 'epic', weight: 1 },
  { type: 'win', win: 20, displayValue: '20€', note: 'Instant', weight: 5 },
  { type: 'win', win: 50, displayValue: '50€', note: 'Instant', weight: 3 },
  { type: 'bonus', bonus: 75, displayValue: '+75€', note: 'Bonus', weight: 4 },
  { type: 'bonus', bonus: 120, displayValue: '+120€', note: 'Bonus', weight: 2 },
  { type: 'free-spin', freeSpins: 5, displayValue: '+5', note: 'Free Spins', weight: 4 },
  { type: 'respin', respin: true, displayValue: '↻', note: 'Re-spin', weight: 2 },
  { type: 'blank', displayValue: '—', note: 'Hold', weight: 6 },
];

const ui = {};
const gridCells = [];
const sounds = {};
let timerIntervalId;

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat('en-US');

document.addEventListener('DOMContentLoaded', () => {
  cacheUI();
  buildGrid();
  bindEvents();
  loadSounds();
  updateUI();
  startTimer();
});

function cacheUI() {
  ui.startButton = document.getElementById('start-button');
  ui.grid = document.getElementById('coin-grid');
  ui.balance = document.querySelector('[data-balance]');
  ui.bet = document.querySelector('[data-bet]');
  ui.bonusPot = document.querySelector('[data-bonus-pot]');
  ui.bonusCounter = document.querySelector('[data-counter-bonus]');
  ui.freeSpinsCounter = document.querySelector('[data-counter-fs]');
  ui.minWin = document.querySelector('[data-min-win]');
  ui.timer = document.querySelector('[data-timer]');
  ui.lastWin = document.querySelector('[data-last-win]');
  ui.muteToggle = document.querySelector('.mute-toggle');
  ui.jackpots = {
    grand: document.querySelector('[data-jackpot="grand"]'),
    major: document.querySelector('[data-jackpot="major"]'),
    minor: document.querySelector('[data-jackpot="minor"]'),
    mini: document.querySelector('[data-jackpot="mini"]'),
  };
}

function buildGrid() {
  const fragment = document.createDocumentFragment();
  for (let index = 0; index < 9; index += 1) {
    const cell = document.createElement('div');
    cell.className = 'coin-cell';
    cell.dataset.type = 'blank';
    cell.dataset.index = index;

    const coin = document.createElement('div');
    coin.className = 'coin';

    const value = document.createElement('span');
    value.className = 'coin-value';
    value.textContent = '—';

    const note = document.createElement('span');
    note.className = 'coin-note';
    note.textContent = 'Hold';

    coin.append(value, note);
    cell.append(coin);
    fragment.append(cell);
    gridCells.push(cell);
  }
  ui.grid.append(fragment);
}

function bindEvents() {
  ui.startButton.addEventListener('click', () => {
    startSpin('manual');
  });

  ui.muteToggle.addEventListener('click', () => {
    gameState.soundsEnabled = !gameState.soundsEnabled;
    ui.muteToggle.setAttribute('aria-pressed', String(!gameState.soundsEnabled));
    const icon = ui.muteToggle.querySelector('.mute-icon');
    if (icon) {
      icon.textContent = gameState.soundsEnabled ? '🔊' : '🔇';
    }
  });
}

function loadSounds() {
  const soundFiles = {
    click: 'sounds/click.mp3',
    spin: 'sounds/spin.mp3',
    win: 'sounds/win.mp3',
  };

  Object.keys(soundFiles).forEach((key) => {
    try {
      const audio = new Audio(soundFiles[key]);
      audio.preload = 'auto';
      sounds[key] = audio;
    } catch (error) {
      sounds[key] = null;
    }
  });
}

function playSound(name) {
  if (!gameState.soundsEnabled) {
    return;
  }
  const audio = sounds[name];
  if (!audio) {
    return;
  }
  try {
    audio.currentTime = 0;
    void audio.play();
  } catch (error) {
    // Ignore playback issues on locked devices.
  }
}

function startTimer() {
  updateTimerText();
  timerIntervalId = setInterval(() => {
    if (gameState.timerSeconds > 0) {
      gameState.timerSeconds -= 1;
      updateTimerText();
    }
  }, 1000);
}

function updateTimerText() {
  const minutes = Math.floor(gameState.timerSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (gameState.timerSeconds % 60).toString().padStart(2, '0');
  ui.timer.textContent = `${minutes}:${seconds}`;
}

async function startSpin(trigger = 'manual') {
  if (gameState.isSpinning) {
    return;
  }

  const isManual = trigger === 'manual';
  const usingFreeSpin = isManual && gameState.freeSpins > 0;

  if (isManual && !usingFreeSpin && gameState.balance < gameState.bet) {
    indicateInsufficientBalance();
    return;
  }

  gameState.isSpinning = true;
  ui.startButton.disabled = true;
  ui.startButton.classList.add('is-busy');

  playSound('click');

  if (isManual) {
    if (usingFreeSpin) {
      gameState.freeSpins -= 1;
    } else {
      gameState.balance = Math.max(0, gameState.balance - gameState.bet);
    }
  }

  if (trigger === 'respin') {
    ui.startButton.textContent = 'RE-SPIN';
  } else if (usingFreeSpin) {
    ui.startButton.textContent = 'FREE SPIN';
  } else {
    ui.startButton.textContent = 'SPINNING';
  }

  clearHighlights();
  gameState.lastWin = 0;
  updateUI();

  const spinResult = generateSpinResult();
  playSound('spin');

  await animateSpin(spinResult);
  const outcome = applySpinResult(spinResult);

  updateUI();

  if (gameState.lastWin > 0) {
    playSound('win');
    flashWinIndicator();
  }

  ui.startButton.classList.remove('is-busy');
  gameState.isSpinning = false;

  if (outcome.respin) {
    ui.startButton.textContent = 'RE-SPIN';
    setTimeout(() => {
      startSpin('respin');
    }, 850);
  } else {
    ui.startButton.disabled = false;
    ui.startButton.textContent = 'START';
  }
}

function indicateInsufficientBalance() {
  ui.startButton.classList.add('is-busy');
  setTimeout(() => {
    ui.startButton.classList.remove('is-busy');
  }, 600);
}

function clearHighlights() {
  gridCells.forEach((cell) => {
    cell.dataset.highlight = 'false';
  });
  ui.lastWin.classList.remove('active');
}

function generateSpinResult() {
  const results = [];
  let nonBlankCount = 0;
  let hasRespin = false;

  while (results.length < 9) {
    const symbol = pickSymbol();
    if (symbol.type === 'respin' && hasRespin) {
      continue;
    }
    if (symbol.type !== 'blank') {
      nonBlankCount += 1;
    }
    if (symbol.type === 'respin') {
      hasRespin = true;
    }
    results.push({ ...symbol });
  }

  if (nonBlankCount < 4) {
    return generateSpinResult();
  }

  return results;
}

function pickSymbol() {
  const totalWeight = SYMBOLS.reduce((sum, symbol) => sum + symbol.weight, 0);
  let randomValue = Math.random() * totalWeight;

  for (let index = 0; index < SYMBOLS.length; index += 1) {
    const symbol = SYMBOLS[index];
    randomValue -= symbol.weight;
    if (randomValue <= 0) {
      return symbol;
    }
  }

  return SYMBOLS[SYMBOLS.length - 1];
}

function animateSpin(results) {
  const columnDelay = 180;
  const settleDuration = 520;
  const columnPromises = [];

  for (let column = 0; column < 3; column += 1) {
    columnPromises.push(
      new Promise((resolve) => {
        setTimeout(() => {
          const cells = [gridCells[column], gridCells[column + 3], gridCells[column + 6]];
          cells.forEach((cell, rowIndex) => {
            const coin = cell.querySelector('.coin');
            coin.classList.add('coin--rolling');
            setTimeout(() => {
              coin.classList.remove('coin--rolling');
              const symbolIndex = rowIndex * 3 + column;
              setCoinSymbol(cell, results[symbolIndex]);
              requestAnimationFrame(() => {
                coin.classList.add('coin--show');
                setTimeout(() => {
                  coin.classList.remove('coin--show');
                }, 420);
              });
              if (rowIndex === cells.length - 1) {
                resolve();
              }
            }, settleDuration);
          });
        }, column * columnDelay);
      })
    );
  }

  return Promise.all(columnPromises);
}

function setCoinSymbol(cell, symbol) {
  const value = cell.querySelector('.coin-value');
  const note = cell.querySelector('.coin-note');
  cell.dataset.type = symbol.type;
  cell.dataset.highlight = symbol.type !== 'blank' ? 'true' : 'false';
  cell.dataset.tier = symbol.tier || '';

  switch (symbol.type) {
    case 'multiplier':
      value.textContent = symbol.displayValue;
      note.textContent = symbol.note;
      break;
    case 'win':
      value.textContent = symbol.displayValue;
      note.textContent = 'Instant';
      break;
    case 'bonus':
      value.textContent = symbol.displayValue;
      note.textContent = 'Bonus';
      break;
    case 'free-spin':
      value.textContent = symbol.displayValue;
      note.textContent = 'Free Spins';
      break;
    case 'respin':
      value.textContent = symbol.displayValue;
      note.textContent = 'Re-spin';
      break;
    default:
      value.textContent = symbol.displayValue;
      note.textContent = symbol.note || '';
  }
}

function applySpinResult(results) {
  let totalMultiplier = 0;
  let instantWin = 0;
  let bonusGain = 0;
  let freeSpinsGain = 0;
  let shouldRespin = false;

  results.forEach((symbol, index) => {
    const cell = gridCells[index];
    if (symbol.type === 'multiplier') {
      totalMultiplier += symbol.multiplier;
    }
    if (symbol.type === 'win') {
      instantWin += symbol.win;
    }
    if (symbol.type === 'bonus') {
      bonusGain += symbol.bonus;
    }
    if (symbol.type === 'free-spin') {
      freeSpinsGain += symbol.freeSpins;
    }
    if (symbol.type === 'respin') {
      shouldRespin = true;
    }
    if (symbol.type === 'multiplier' || symbol.type === 'win' || symbol.type === 'bonus') {
      cell.dataset.highlight = 'true';
    }
  });

  let totalWin = totalMultiplier * gameState.bet + instantWin;

  if (totalWin > 0 && totalWin < gameState.minWin) {
    totalWin = gameState.minWin;
  }

  if (totalWin > 0) {
    gameState.balance += totalWin;
  }

  if (bonusGain > 0) {
    gameState.bonusBank += bonusGain;
    gameState.bonusPot += bonusGain;
  }

  if (freeSpinsGain > 0) {
    gameState.freeSpins += freeSpinsGain;
  }

  if (totalWin > 0) {
    gameState.lastWin = totalWin;
  } else {
    gameState.lastWin = 0;
  }

  nudgeJackpots(totalWin);

  return { respin: shouldRespin };
}

function nudgeJackpots(totalWin) {
  Object.keys(gameState.jackpots).forEach((key) => {
    const baseIncrease = Math.floor(Math.random() * 25) + 5;
    const bonus = totalWin > 0 ? Math.floor(totalWin / 20) : 0;
    gameState.jackpots[key] += baseIncrease + bonus;
  });
}

function updateUI() {
  ui.balance.textContent = currencyFormatter.format(gameState.balance);
  ui.bet.textContent = currencyFormatter.format(gameState.bet);
  ui.bonusPot.textContent = currencyFormatter.format(gameState.bonusPot);
  ui.bonusCounter.textContent = currencyFormatter.format(gameState.bonusBank);
  ui.freeSpinsCounter.textContent = numberFormatter.format(gameState.freeSpins);
  ui.minWin.textContent = currencyFormatter.format(gameState.minWin);
  ui.lastWin.textContent = currencyFormatter.format(gameState.lastWin);

  if (gameState.lastWin > 0) {
    ui.lastWin.classList.add('active');
  }

  Object.keys(gameState.jackpots).forEach((key) => {
    const element = ui.jackpots[key];
    if (element) {
      element.textContent = currencyFormatter.format(gameState.jackpots[key]);
    }
  });
}

function flashWinIndicator() {
  ui.lastWin.classList.add('active');
  setTimeout(() => {
    ui.lastWin.classList.remove('active');
  }, 2200);
}
