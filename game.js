/**
 * GRID BIKE - Vic-20 Standalone JavaScript Recreation
 * Original Vic-20 BASIC Game written by David Pearson of York (December 1983, PCN Magazine)
 * 
 * Recreated faithfully in JavaScript & Canvas with Web Audio API Vic-20 VIC chip emulation.
 */

// Custom defined character bitmaps (8x8 grid bitmasks from lines 9000-9100)
const CHAR_DEFINITIONS = {
  0:  [0, 231, 255, 255, 255, 255, 231, 0],       // Horizontal Bike Head
  1:  [126, 126, 126, 60, 60, 126, 126, 126],    // Vertical Bike Head
  2:  [255, 129, 129, 129, 129, 129, 129, 255],  // Grid Tile Box
  3:  [24, 24, 24, 24, 24, 24, 24, 24],          // Vertical Trail | (Cols 3,4)
  4:  [0, 0, 0, 255, 255, 0, 0, 0],              // Horizontal Trail - (Rows 3,4)
  5:  [0, 0, 0, 31, 31, 24, 24, 24],            // Corner ╔ (DATA 0,0,0,31,31,24,24,24 - Line 9050)
  6:  [0, 0, 0, 248, 248, 24, 24, 24],          // Corner ╗ (DATA 0,0,0,248,248,24,24,24 - Line 9060)
  7:  [24, 24, 24, 248, 248, 0, 0, 0],          // Corner ╝ (DATA 24,24,24,248,248,0,0,0 - Line 9070)
  8:  [24, 24, 24, 31, 31, 0, 0, 0],            // Corner ╚ (DATA 24,24,24,31,31,0,0,0 - Line 9080)
  9:  [255, 255, 255, 255, 255, 255, 255, 255],  // Outer Wall Solid Block
  10: [28, 28, 8, 62, 8, 20, 34, 65],            // Stranded Man Stick Figure
  230: [255, 255, 255, 255, 255, 255, 255, 255]  // Hard Mode Obstacle Block
};

// Vic-20 Authentic Color Palette
const VIC_COLORS = {
  0: '#000000', // Black
  1: '#ffffff', // White
  2: '#dd0000', // Red
  3: '#00e0e0', // Cyan
  4: '#cc00cc', // Purple
  5: '#00cc00', // Green
  6: '#0000aa', // Blue
  7: '#eeee00'  // Yellow
};

class GridBikeGame {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');

    // Vic-20 Screen Specs
    this.COLS = 22;
    this.ROWS = 23;
    this.TOTAL_CELLS = this.COLS * this.ROWS;
    this.SCREEN_BASE = 7680;
    this.COLOR_BASE = 38400;

    // Tile scaling (8x8 pixels per char, rendered at 16x16 on canvas)
    this.CHAR_SIZE = 8;
    this.SCALE = 2; // Each pixel is 2x2 canvas px -> 16x16 per cell
    this.CELL_PX = this.CHAR_SIZE * this.SCALE; // 16px

    this.canvas.width = this.COLS * this.CELL_PX; // 352px
    this.canvas.height = this.ROWS * this.CELL_PX; // 368px

    // Vic-20 Memory Arrays
    this.screenRAM = new Uint8Array(this.TOTAL_CELLS);
    this.colorRAM = new Uint8Array(this.TOTAL_CELLS);

    // Game Variables (matching BASIC line 10)
    this.state = 'LOADER'; // 'LOADER', 'DIFFICULTY', 'PLAYING', 'LEVEL_CLEAR', 'GAME_OVER'
    this.difficulty = 1;   // 1 = Easy, 2 = Hard
    this.gridLevel = 1;
    this.score = 0;
    this.highScore = parseInt(localStorage.getItem('gridbike_highscore') || '0', 10);
    this.menRemaining = 0;

    // Movement & Bike State
    this.A = 8174;         // Screen address of bike head (Row 22, Col 10 approx)
    this.D = -22;          // Current direction delta (-22 = UP, 22 = DOWN, -1 = LEFT, 1 = RIGHT)
    this.OD = -22;         // Old direction
    this.CH = 1;           // Bike Head character (0 = Horizontal, 1 = Vertical)
    this.WT = 3;           // Trail segment character for current movement
    this.NW = 3;           // Next trail segment character
    this.inputQueue = [];

    // Game Loop Timing
    this.lastTickTime = 0;
    this.tickInterval = 120; // ms per tick (approx 8.3 FPS retro Vic20 feel)
    this.speedMultiplier = 1;
    this.soundEnabled = true;

    // Initialize Audio & Input
    this.initAudio();
    this.initInput();
    this.showLoaderScreen();

    // Start Animation Loop
    requestAnimationFrame(this.loop.bind(this));
  }

  // --- WEB AUDIO VIC-20 SYNTHESIZER ---
  initAudio() {
    this.audioCtx = null;
  }

  ensureAudioContext() {
    if (!this.audioCtx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.audioCtx = new AudioCtx();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  playVicSound(freq, duration, type = 'square', volume = 0.1) {
    if (!this.soundEnabled) return;
    this.ensureAudioContext();
    if (!this.audioCtx) return;

    try {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
      gain.gain.setValueAtTime(volume, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start();
      osc.stop(this.audioCtx.currentTime + duration);
    } catch (e) {
      console.error(e);
    }
  }

  playEngineHum() {
    // Vic-20 motor frequency (POKE 36874, 196: POKE 36875, 196: POKE 36876, 176)
    this.playVicSound(180, 0.08, 'sawtooth', 0.04);
  }

  playManPickupSound() {
    this.playVicSound(587.33, 0.08, 'square', 0.15); // D5
    setTimeout(() => this.playVicSound(880, 0.12, 'square', 0.2), 80); // A5
  }

  playCrashSound() {
    if (!this.soundEnabled) return;
    this.ensureAudioContext();
    if (!this.audioCtx) return;

    // Noise burst for Vic20 explosion
    try {
      const bufferSize = this.audioCtx.sampleRate * 0.4;
      const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
      const output = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const noise = this.audioCtx.createBufferSource();
      noise.buffer = buffer;

      const gain = this.audioCtx.createGain();
      gain.gain.setValueAtTime(0.3, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.4);

      noise.connect(gain);
      gain.connect(this.audioCtx.destination);

      noise.start();
    } catch (e) {
      console.error(e);
    }
  }

  playLevelClearFanfare() {
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, idx) => {
      setTimeout(() => this.playVicSound(freq, 0.1, 'square', 0.15), idx * 90);
    });
  }

  // --- INPUT HANDLING ---
  initInput() {
    window.addEventListener('keydown', (e) => {
      this.ensureAudioContext();

      if (this.state === 'LOADER') {
        this.showDifficultyPrompt();
        return;
      }

      if (this.state === 'DIFFICULTY') {
        if (e.key === '1') {
          this.startNewGame(1);
        } else if (e.key === '2') {
          this.startNewGame(2);
        }
        return;
      }

      if (this.state === 'GAME_OVER') {
        if (e.key === ' ' || e.key === 'Enter' || e.key.toUpperCase() === 'Z' || e.key.toUpperCase() === 'X') {
          this.showDifficultyPrompt();
        }
        return;
      }

      if (this.state === 'PLAYING') {
        const key = e.key.toUpperCase();
        if (key === 'Z' || key === 'ARROWLEFT' || key === 'A') {
          this.queueInput('LEFT');
        } else if (key === 'X' || key === 'ARROWRIGHT' || key === 'D') {
          this.queueInput('RIGHT');
        } else if (key === 'L' || key === 'ARROWUP' || key === 'W') {
          this.queueInput('UP');
        } else if (key === ',' || key === 'ARROWDOWN' || key === 'S') {
          this.queueInput('DOWN');
        }
      }
    });
  }

  queueInput(dir) {
    if (this.inputQueue.length < 2) {
      this.inputQueue.push(dir);
    }
  }

  // --- VIC-20 SCREEN RAM HELPERS ---
  poke(address, value) {
    const idx = address - this.SCREEN_BASE;
    if (idx >= 0 && idx < this.TOTAL_CELLS) {
      this.screenRAM[idx] = value;
    }
  }

  peek(address) {
    const idx = address - this.SCREEN_BASE;
    if (idx >= 0 && idx < this.TOTAL_CELLS) {
      return this.screenRAM[idx];
    }
    return 0;
  }

  pokeColor(address, colorCode) {
    const idx = address - this.SCREEN_BASE;
    if (idx >= 0 && idx < this.TOTAL_CELLS) {
      this.colorRAM[idx] = colorCode;
    }
  }

  // --- LOADER & PROMPTS ---
  showLoaderScreen() {
    this.state = 'LOADER';
    this.screenRAM.fill(32); // Space
    this.colorRAM.fill(6);  // Blue text

    const lines = [
      "           GRID BIKE",
      "",
      "YOU ARE THE DRIVER",
      "OF THE GRID BIKE.",
      "YOU MUST DRIVE ROUND",
      "THE GRID PICKING UP",
      "THE PEOPLE.",
      "AS YOU DRIVE AROUND",
      "THE GRID YOU LEAVE A",
      "TRAIL.",
      "IF YOU RUN INTO IT",
      "YOU WILL BE KILLED.",
      "",
      "Z=LEFT",
      "X=RIGHT",
      "L=UP",
      ",=DOWN",
      "",
      "     PRESS ANY KEY",
      "     BY D.PEARSON"
    ];

    lines.forEach((lineText, r) => {
      for (let c = 0; c < lineText.length && c < this.COLS; c++) {
        const charCode = lineText.charCodeAt(c);
        const cellIdx = r * this.COLS + c;
        this.screenRAM[cellIdx] = charCode;
        this.colorRAM[cellIdx] = 6;
      }
    });

    this.render();
  }

  showDifficultyPrompt() {
    this.state = 'DIFFICULTY';
    this.screenRAM.fill(32);
    this.colorRAM.fill(6);

    const prompt1 = "DO YOU WANT";
    const prompt2 = "EASY (PRESS 1)";
    const prompt3 = "OR HARD (PRESS 2)?";

    const startRow = 10;
    const writeLine = (str, row) => {
      const col = Math.max(0, Math.floor((this.COLS - str.length) / 2));
      for (let i = 0; i < str.length; i++) {
        const idx = row * this.COLS + col + i;
        this.screenRAM[idx] = str.charCodeAt(i);
        this.colorRAM[idx] = 6;
      }
    };

    writeLine(prompt1, startRow - 2);
    writeLine(prompt2, startRow);
    writeLine(prompt3, startRow + 2);

    this.render();
  }

  // --- GAME INITIALIZATION & LEVEL START ---
  startNewGame(diffMode) {
    this.difficulty = diffMode;
    this.gridLevel = 1;
    this.score = 0;
    this.initLevel();
  }

  initLevel() {
    this.state = 'PLAYING';
    this.A = 8174; // Starting bike position
    this.D = -22;  // Initial direction UP
    this.OD = -22;
    this.CH = 1;   // Vertical head
    this.WT = 3;   // Vertical trail
    this.NW = 3;
    this.inputQueue = [];

    this.menRemaining = this.gridLevel;

    // Fill screen with char 2 (Grid Box) and blue color
    for (let i = 0; i < this.TOTAL_CELLS; i++) {
      this.screenRAM[i] = 2;
      this.colorRAM[i] = 6;
    }

    // Left border wall char 9
    for (let addr = 7680; addr <= 8164; addr += 22) {
      this.poke(addr, 9);
      this.pokeColor(addr, 0);
    }

    // Place Men (Char 10)
    for (let n = 0; n < this.menRemaining; n++) {
      let rp = Math.floor(Math.random() * 506) + 7680;
      while (this.peek(rp) !== 2) {
        rp++;
        if (rp > 8185) rp = 7680;
      }
      this.poke(rp, 10);
      this.pokeColor(rp, 5);
    }

    // Hard mode obstacles
    if (this.difficulty === 2) {
      for (let n = 0; n < 10 + (this.gridLevel - 1) * 2; n++) {
        let sp = Math.floor(Math.random() * 506) + 7680;
        while (this.peek(sp) !== 2) {
          sp++;
          if (sp > 8185) sp = 7680;
        }
        this.poke(sp, 230);
        this.pokeColor(sp, 0);
      }
    }

    // Initial bike head draw
    this.poke(this.A, this.CH);
    this.pokeColor(this.A, 2);

    this.updateHUD();
    this.render();
  }

  // --- MAIN GAMEPLAY TICK ---
  gameTick() {
    if (this.state !== 'PLAYING') return;

    // 1. Line 103: Draw bike head at A and trail segment at previous cell (A - D)
    this.poke(this.A, this.CH);
    this.pokeColor(this.A, 2); // Red bike head

    const prevCell = this.A - this.D;
    if (this.peek(prevCell) !== 9 && this.peek(prevCell) !== 230) {
      this.poke(prevCell, this.WT);
      this.pokeColor(prevCell, 6); // Blue trail
    }

    // 2. Engine sound hum
    this.playEngineHum();

    // 3. Line 105: Store old direction
    this.OD = this.D;

    // 4. Lines 106-107: Update WT from NW if set (transitions corner to straight line)
    if (this.NW !== 0) {
      this.WT = this.NW;
    }

    // 5. Lines 110-150: Input handling
    if (this.inputQueue.length > 0) {
      const dir = this.inputQueue.shift();
      if (dir === 'LEFT' && this.D !== 1) {
        this.D = -1;
        this.WT = 4;
        this.CH = 0;
        this.NW = 4;
      } else if (dir === 'RIGHT' && this.D !== -1) {
        this.D = 1;
        this.WT = 4;
        this.CH = 0;
        this.NW = 4;
      } else if (dir === 'UP' && this.D !== 22) {
        this.D = -22;
        this.WT = 3;
        this.CH = 1;
        this.NW = 3;
      } else if (dir === 'DOWN' && this.D !== -22) {
        this.D = 22;
        this.WT = 3;
        this.CH = 1;
        this.NW = 3;
      }
    }

    // 6. Line 160: Advance bike position
    this.A = this.A + this.D;

    // 7. Bounds check (Line 180)
    if (this.A < 7680 || this.A > 8185) {
      this.handleCrash();
      return;
    }

    const hitChar = this.peek(this.A);

    // 8. Collision checks (Lines 162-163)
    if ((hitChar > 2 && hitChar < 10) || hitChar === 230) {
      this.handleCrash();
      return;
    }

    if (hitChar === 10) {
      this.handleManCollected();
      return;
    }

    // 9. Lines 3000-3070: Turn Corner Calculation
    // Matches exact BASIC logic from magazine page 85
    if (this.OD === -22 && this.D === -1)      { this.NW = 4; this.WT = 6; } // UP -> LEFT (╗ corner)
    else if (this.OD === 22 && this.D === -1)  { this.NW = 4; this.WT = 7; } // DOWN -> LEFT (╝ corner)
    else if (this.OD === -22 && this.D === 1)  { this.NW = 4; this.WT = 5; } // UP -> RIGHT (╔ corner)
    else if (this.OD === 22 && this.D === 1)   { this.NW = 4; this.WT = 8; } // DOWN -> RIGHT (╚ corner)
    else if (this.OD === 1 && this.D === 22)   { this.NW = 3; this.WT = 6; } // RIGHT -> DOWN (╗ corner)
    else if (this.OD === 1 && this.D === -22)  { this.NW = 3; this.WT = 7; } // RIGHT -> UP (╝ corner)
    else if (this.OD === -1 && this.D === -22) { this.NW = 3; this.WT = 8; } // LEFT -> UP (╚ corner)
    else if (this.OD === -1 && this.D === 22)  { this.NW = 3; this.WT = 5; } // LEFT -> DOWN (╔ corner)
  }

  handleManCollected() {
    this.score += 100;
    this.menRemaining--;
    this.playManPickupSound();
    this.updateHUD();

    if (this.menRemaining <= 0) {
      // Level Cleared!
      this.state = 'LEVEL_CLEAR';
      this.playLevelClearFanfare();

      // Write "GRID X CLEARED" at top row (high contrast yellow on blue background box)
      const clearStr = `GRID ${this.gridLevel} CLEARED`;
      const startCol = Math.floor((this.COLS - clearStr.length) / 2);
      for (let i = 0; i < clearStr.length; i++) {
        const cellIdx = 1 * this.COLS + startCol + i;
        this.screenRAM[cellIdx] = clearStr.charCodeAt(i);
        this.colorRAM[cellIdx] = 7; // Yellow color
      }
      this.render();

      setTimeout(() => {
        this.gridLevel++;
        this.initLevel();
      }, 1800);
    } else {
      // Move bike onto man's square and continue
      this.poke(this.A, this.CH);
      this.pokeColor(this.A, 2);
    }
  }

  handleCrash() {
    this.state = 'GAME_OVER';
    this.playCrashSound();

    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('gridbike_highscore', this.highScore.toString());
    }
    this.updateHUD();

    // Render Crash Message overlay on Vic20 screen
    const msg1 = "   CRASH! GAME OVER   ";
    const msg2 = "PRESS KEY TO RESTART ";

    const writeOverlay = (str, row, colCode = 2) => {
      for (let c = 0; c < str.length && c < this.COLS; c++) {
        const idx = row * this.COLS + c;
        this.screenRAM[idx] = str.charCodeAt(c);
        this.colorRAM[idx] = colCode;
      }
    };

    writeOverlay(msg1, 10, 2);
    writeOverlay(msg2, 12, 7);
    this.render();
  }

  updateHUD() {
    document.getElementById('hudScore').textContent = this.score;
    document.getElementById('hudHighScore').textContent = this.highScore;
    document.getElementById('hudLevel').textContent = this.gridLevel;
    document.getElementById('hudMen').textContent = this.menRemaining;
  }

  // --- RENDERING ENGINE ---
  render() {
    // Clear Vic20 background with screen color
    this.ctx.fillStyle = VIC_COLORS[1]; // Vic20 White background
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    for (let r = 0; r < this.ROWS; r++) {
      for (let c = 0; c < this.COLS; c++) {
        const idx = r * this.COLS + c;
        const charCode = this.screenRAM[idx];
        const colorCode = this.colorRAM[idx];
        const pixelColor = VIC_COLORS[colorCode] || '#0000aa';

        const x = c * this.CELL_PX;
        const y = r * this.CELL_PX;

        this.drawCharacter(charCode, x, y, pixelColor);
      }
    }
  }

  drawCharacter(charCode, destX, destY, colorHex) {
    const customDef = CHAR_DEFINITIONS[charCode];

    if (customDef) {
      // Render custom defined 8x8 bitmap
      this.ctx.fillStyle = colorHex;
      for (let row = 0; row < 8; row++) {
        const byte = customDef[row];
        for (let col = 0; col < 8; col++) {
          if ((byte & (1 << (7 - col))) !== 0) {
            this.ctx.fillRect(
              destX + col * this.SCALE,
              destY + row * this.SCALE,
              this.SCALE,
              this.SCALE
            );
          }
        }
      }
    } else {
      // Standard ASCII character cell (e.g. text message on grid)
      // Solid dark blue background box so text is crisp and legible over grid tiles
      const bgBoxColor = (colorHex === '#ffffff' || colorHex === VIC_COLORS[1] || colorHex === '#eeee00' || colorHex === VIC_COLORS[7]) 
        ? '#0000aa' 
        : '#ffffff';
      this.ctx.fillStyle = bgBoxColor;
      this.ctx.fillRect(destX, destY, this.CELL_PX, this.CELL_PX);

      // Render crisp text character
      this.ctx.fillStyle = colorHex;
      this.ctx.font = 'bold 11px "Share Tech Mono", monospace';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(
        String.fromCharCode(charCode),
        destX + this.CELL_PX / 2,
        destY + this.CELL_PX / 2 + 1
      );
    }
  }

  // --- ANIMATION LOOP ---
  loop(timestamp) {
    if (this.state === 'PLAYING') {
      if (timestamp - this.lastTickTime > (this.tickInterval / this.speedMultiplier)) {
        this.gameTick();
        this.render();
        this.lastTickTime = timestamp;
      }
    }
    requestAnimationFrame(this.loop.bind(this));
  }
}

// Global instance & UI setup
let gameInstance = null;

window.addEventListener('DOMContentLoaded', () => {
  gameInstance = new GridBikeGame('gameCanvas');

  // Control Buttons & Toggles
  document.getElementById('btnRestart').addEventListener('click', () => {
    gameInstance.showDifficultyPrompt();
  });

  document.getElementById('btnSound').addEventListener('click', (e) => {
    gameInstance.soundEnabled = !gameInstance.soundEnabled;
    e.currentTarget.innerHTML = gameInstance.soundEnabled 
      ? '🔊 SOUND: ON' 
      : '🔇 SOUND: OFF';
  });

  document.getElementById('btnCrt').addEventListener('click', (e) => {
    const frame = document.querySelector('.screen-frame');
    frame.classList.toggle('crt-off');
    const isOff = frame.classList.contains('crt-off');
    e.currentTarget.innerHTML = isOff ? '📺 CRT EFFECT: OFF' : '📺 CRT EFFECT: ON';
  });

  // Speed selector
  document.getElementById('speedSelect').addEventListener('change', (e) => {
    gameInstance.speedMultiplier = parseFloat(e.target.value);
  });

  // Touch D-Pad Controls
  const dpadLeft = document.getElementById('dpadLeft');
  const dpadRight = document.getElementById('dpadRight');
  const dpadUp = document.getElementById('dpadUp');
  const dpadDown = document.getElementById('dpadDown');

  if (dpadLeft) dpadLeft.addEventListener('pointerdown', () => gameInstance.queueInput('LEFT'));
  if (dpadRight) dpadRight.addEventListener('pointerdown', () => gameInstance.queueInput('RIGHT'));
  if (dpadUp) dpadUp.addEventListener('pointerdown', () => gameInstance.queueInput('UP'));
  if (dpadDown) dpadDown.addEventListener('pointerdown', () => gameInstance.queueInput('DOWN'));

  // Modals setup
  const modalOverlay = document.getElementById('modalOverlay');
  const btnInfo = document.getElementById('btnInfo');
  const btnCode = document.getElementById('btnCode');
  const modalClose = document.getElementById('modalClose');

  const openModal = (tabName) => {
    modalOverlay.classList.add('active');
    switchTab(tabName);
  };

  const switchTab = (tabName) => {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.toggle('active', content.id === `tab-${tabName}`);
    });
  };

  if (btnInfo) btnInfo.addEventListener('click', () => openModal('instructions'));
  if (btnCode) btnCode.addEventListener('click', () => openModal('code'));
  if (modalClose) modalClose.addEventListener('click', () => modalOverlay.classList.remove('active'));

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) modalOverlay.classList.remove('active');
  });
});
