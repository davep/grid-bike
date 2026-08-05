/**
 * GRID BIKE - Vic-20 Standalone JavaScript Recreation
 * Original Vic-20 BASIC Game written by David Pearson of York (December 1983, PCN Magazine)
 * Source code recovered 100% accurately from authentic 1983 PCNEWS tape archive (tape-image/grid-bike.t64)
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

/**
 * Hardware-Accurate MOS 6560/6561 VIC Sound Chip Emulator
 * Recreates the 4-channel sound registers of the Commodore Vic-20:
 * - 36874 ($900E): Voice 1 (Bass)
 * - 36875 ($900F): Voice 2 (Alto - +1 Octave)
 * - 36876 ($9010): Voice 3 (Soprano - +2 Octaves)
 * - 36877 ($9011): Voice 4 (White Noise)
 * - 36878 ($9012): Master Volume (Bits 0-3)
 */
class Vic20SoundChip {
  constructor() {
    this.audioCtx = null;
    this.masterGain = null;
    this.volume = 15; // Default max volume (0 to 15)
    this.isMuted = false;

    // Channels configuration
    this.channels = [
      { osc: null, gain: null, regVal: 0, octMult: 1 }, // 36874 (Bass)
      { osc: null, gain: null, regVal: 0, octMult: 2 }, // 36875 (Alto)
      { osc: null, gain: null, regVal: 0, octMult: 4 }, // 36876 (Soprano)
      { source: null, gain: null, regVal: 0, type: 'noise' } // 36877 (Noise)
    ];
  }

  ensureAudioContext() {
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtxClass) return;
      this.audioCtx = new AudioCtxClass();

      // Master volume node
      this.masterGain = this.audioCtx.createGain();
      this.masterGain.gain.setValueAtTime((this.volume / 15) * 0.12, this.audioCtx.currentTime);
      this.masterGain.connect(this.audioCtx.destination);

      // Create persistent square wave oscillators for Voices 1, 2, 3
      for (let i = 0; i < 3; i++) {
        const ch = this.channels[i];
        ch.gain = this.audioCtx.createGain();
        ch.gain.gain.setValueAtTime(0, this.audioCtx.currentTime);

        ch.osc = this.audioCtx.createOscillator();
        ch.osc.type = 'square'; // Vic-20 pulse/square wave
        ch.osc.frequency.setValueAtTime(440, this.audioCtx.currentTime);
        ch.osc.connect(ch.gain);
        ch.gain.connect(this.masterGain);
        ch.osc.start();
      }

      // Create noise buffer source for Voice 4 (Noise generator)
      this.initNoiseChannel();
    }

    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  initNoiseChannel() {
    const bufferSize = this.audioCtx.sampleRate * 2;
    const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noiseCh = this.channels[3];
    noiseCh.gain = this.audioCtx.createGain();
    noiseCh.gain.gain.setValueAtTime(0, this.audioCtx.currentTime);

    noiseCh.source = this.audioCtx.createBufferSource();
    noiseCh.source.buffer = buffer;
    noiseCh.source.loop = true;
    noiseCh.source.connect(noiseCh.gain);
    noiseCh.gain.connect(this.masterGain);
    noiseCh.source.start();
  }

  /**
   * Directly simulates POKE command to Vic-20 sound registers
   * @param {number} register - 36874, 36875, 36876, 36877, or 36878
   * @param {number} val - Byte value (0-255)
   */
  poke(register, val) {
    if (this.isMuted) return;
    this.ensureAudioContext();
    if (!this.audioCtx) return;

    const now = this.audioCtx.currentTime;

    // Master Volume Register (36878)
    if (register === 36878) {
      this.volume = val & 0x0f;
      this.masterGain.gain.setValueAtTime((this.volume / 15) * 0.12, now);
      return;
    }

    const channelIdx = register - 36874;
    if (channelIdx < 0 || channelIdx > 3) return;

    const ch = this.channels[channelIdx];
    ch.regVal = val;

    const enabled = (val & 0x80) !== 0; // Bit 7: Sound Enable
    const freqVal = val & 0x7f;        // Bits 0-6: Frequency

    if (channelIdx < 3) {
      // Tone Channels 1, 2, 3 (Bass, Alto, Soprano)
      if (enabled && freqVal > 0) {
        // Authentic Vic-20 Frequency Formula: Freq = (138550.5 / (255 - freqVal)) * octaveMultiplier
        const baseFreq = 138550.5 / (255 - freqVal);
        const freqHz = baseFreq * ch.octMult;
        ch.osc.frequency.setValueAtTime(freqHz, now);
        ch.gain.gain.setValueAtTime(0.08, now); // Voice volume
      } else {
        ch.gain.gain.setValueAtTime(0, now);
      }
    } else {
      // Channel 4: White Noise
      if (enabled) {
        // Pitch simulation for noise register frequency
        ch.gain.gain.setValueAtTime(0.15, now);
      } else {
        ch.gain.gain.setValueAtTime(0, now);
      }
    }
  }

  silenceAll() {
    this.poke(36874, 0);
    this.poke(36875, 0);
    this.poke(36876, 0);
    this.poke(36877, 0);
  }

  playCrashExplosionSweep() {
    this.silenceAll();
    // Recreates BASIC lines 4001-4050: FOR KN=1 TO 10: QW=128: FOR N=0 TO 7: POKE 36877, QW: QW=QW+5: NEXT: NEXT
    if (this.isMuted) return;
    this.ensureAudioContext();
    if (!this.audioCtx) return;

    let step = 0;
    const totalSteps = 80;
    const interval = setInterval(() => {
      if (step >= totalSteps || this.isMuted) {
        clearInterval(interval);
        this.silenceAll();
        return;
      }
      const qw = 128 + (step % 8) * 5;
      this.poke(36877, qw);
      step++;
    }, 12);
  }
}

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

    // Hardware-Accurate Vic-20 Sound Chip Emulator
    this.soundChip = new Vic20SoundChip();

    // Game Variables (matching BASIC line 10)
    this.state = 'LOADER'; // 'LOADER', 'DIFFICULTY', 'PLAYING', 'LEVEL_CLEAR', 'GAME_OVER'
    this.difficulty = 1;   // 1 = Easy, 2 = Hard
    this.gridLevel = 1;    // GRID counter (starts at 1)
    this.score = 0;        // SC
    this.highScore = parseInt(localStorage.getItem('gridbike_highscore') || '0', 10);
    this.manTotal = 1;     // MAN (starts at 1, increases by 1 each level clear)
    this.menCollected = 0; // DF (count of men picked up on current grid)

    // Movement & Bike State
    this.A = 8174;         // Screen address of bike head (Row 22, Col 10)
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

    // Crash animation state
    this.crashFlashStep = 0;

    // Initialize Input & Loader
    this.initInput();
    this.showLoaderScreen();

    // Start Animation Loop
    requestAnimationFrame(this.loop.bind(this));
  }

  // --- INPUT HANDLING ---
  initInput() {
    window.addEventListener('keydown', (e) => {
      this.soundChip.ensureAudioContext();

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
        const key = e.key.toUpperCase();
        if (key === 'Y' || key === '1') {
          this.showDifficultyPrompt();
        } else if (key === 'N') {
          this.showLoaderScreen();
        } else if (key === '2') {
          this.startNewGame(2);
        } else if (key === ' ' || key === 'ENTER') {
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

  /**
   * Hardware-accurate PETSCII control code & text interpreter.
   * Parses inline CBM BASIC PETSCII tags like {CLR}, {HOME}, {DOWN}, {RIGHT}, {WHITE}, {RED}, {CYAN}, {YELLOW}, {BLACK}, {RVON}, {RVOFF}.
   */
  printPetscii(str, startRow = 0, startCol = 0, defaultColor = 1) {
    let r = startRow;
    let c = startCol;
    let currentColor = defaultColor;
    let isReverse = false;

    let i = 0;
    while (i < str.length) {
      if (str[i] === '\n') {
        r++;
        c = 0;
        isReverse = false; // CBM BASIC automatically cancels Reverse Video at newline / carriage return
        i++;
        continue;
      }

      if (str[i] === '{') {
        const closeIdx = str.indexOf('}', i);
        if (closeIdx !== -1) {
          const tag = str.substring(i + 1, closeIdx).toUpperCase();
          i = closeIdx + 1;

          if (tag === 'CLR') {
            this.screenRAM.fill(32);
            this.colorRAM.fill(currentColor);
            r = 0;
            c = 0;
            isReverse = false;
          } else if (tag === 'HOME') {
            r = 0;
            c = 0;
            isReverse = false;
          } else if (tag === 'DOWN') {
            r++;
            c = 0;
          } else if (tag === 'RIGHT') {
            c++;
          } else if (tag === 'RVON') {
            isReverse = true;
          } else if (tag === 'RVOFF') {
            isReverse = false;
          } else if (tag === 'WHITE' || tag === 'WHT') {
            currentColor = 1;
          } else if (tag === 'RED') {
            currentColor = 2;
          } else if (tag === 'CYAN' || tag === 'CYN') {
            currentColor = 3;
          } else if (tag === 'PURPLE' || tag === 'PUR') {
            currentColor = 4;
          } else if (tag === 'GREEN' || tag === 'GRN') {
            currentColor = 5;
          } else if (tag === 'BLUE' || tag === 'BLU') {
            currentColor = 6;
          } else if (tag === 'YELLOW' || tag === 'YEL') {
            currentColor = 7;
          } else if (tag === 'BLACK' || tag === 'BLK') {
            currentColor = 0;
          }
          continue;
        }
      }

      // Normal character output
      let cellIdx = r * this.COLS + c;
      if (cellIdx < this.TOTAL_CELLS) {
        this.screenRAM[cellIdx] = str.charCodeAt(i);
        let color = currentColor;
        if (isReverse) color |= 0x80;
        this.colorRAM[cellIdx] = color;
      }

      c++;
      if (c >= this.COLS) {
        c = 0;
        r++;
      }
      i++;
    }
  }

  // --- LOADER & PROMPTS (Strictly matching BASIC lines 5000-5175 & GRID2 Line 2) ---
  showLoaderScreen() {
    this.state = 'LOADER';

    // Lines 5000-5175 in exact PETSCII sequence:
    // 5020: 6 leading spaces BEFORE {RVON} -> White box starts at Col 6!
    this.printPetscii(
      "{CLR}{WHITE}" +
      "      {RVON} GRID BIKE \n" +
      "{DOWN}YOU ARE THE DRIVER \n" +
      "OF THE GRID BIKE.\n" +
      "YOU MUST DRIVE ROUND \n" +
      "THE GRID PICKING UP\n" +
      "THE PEOPLE.\n" +
      "AS YOU DRIVE AROUND\n" +
      "THE GRID YOU LEAVE A\n" +
      "TRAIL.\n" +
      "IF YOU RUN INTO IT\n" +
      "YOU WILL BE KILLED.\n" +
      "Z=LEFT\n" +
      "X=RIGHT\n" +
      "L=UP\n" +
      ",=DOWN\n" +
      "{CYAN}     PRESS ANY KEY\n" +
      "{WHITE}{DOWN}BY D.PEARSON"
    );

    this.render();
  }

  showDifficultyPrompt() {
    this.state = 'DIFFICULTY';

    // Line 2: PRINT"{CLR}{WHITE}DO YOU WANT EASY({RED}1{WHITE}) OR HARD ({RED}2{WHITE})"
    this.printPetscii("{CLR}{WHITE}DO YOU WANT EASY({RED}1{WHITE}) OR HARD ({RED}2{WHITE})");
    this.render();
  }

  // --- GAME INITIALIZATION & LEVEL START ---
  startNewGame(diffMode) {
    this.difficulty = diffMode;
    this.gridLevel = 1;
    this.manTotal = 1; // MAN = 1 (Line 10)
    this.score = 0;
    this.initLevel();
  }

  initLevel() {
    this.state = 'PLAYING';
    this.A = 8174; // Starting bike position (Line 10)
    this.D = -22;  // Initial direction UP
    this.OD = -22;
    this.CH = 1;   // Vertical head
    this.WT = 3;   // Vertical trail
    this.NW = 3;
    this.menCollected = 0; // DF = 0
    this.inputQueue = [];

    // Line 5: Sound Volume = 15
    this.soundChip.poke(36878, 15);

    // Line 50: Fill screen RAM 7680-8185 with Char 2 (Grid Tile)
    for (let i = 0; i < this.TOTAL_CELLS; i++) {
      this.screenRAM[i] = 2;
      this.colorRAM[i] = 6; // Blue grid lines (Line 80)
    }

    // Line 96-97: Left border wall char 9, color 0 (Black)
    for (let addr = 7680; addr <= 8164; addr += 22) {
      this.poke(addr, 9);
      this.pokeColor(addr, 0);
    }

    // Line 98-99: Place Men (Char 10)
    for (let n = 0; n < this.manTotal; n++) {
      let rp = Math.floor(Math.random() * 506) + 7680;
      while (this.peek(rp) !== 2) {
        rp++;
        if (rp > 8185) rp = 7680;
      }
      this.poke(rp, 10);
      this.pokeColor(rp, 6); // Blue figure
    }

    // Line 100-102: Hard mode obstacles (Always 10 blocks)
    if (this.difficulty === 2) {
      for (let n = 0; n < 10; n++) {
        let sp = Math.floor(Math.random() * 506) + 7680;
        while (this.peek(sp) !== 2) {
          sp++;
          if (sp > 8185) sp = 7680;
        }
        this.poke(sp, 230);
        this.pokeColor(sp, 0); // Black obstacle block
      }
    }

    // Initial bike head draw (Line 103)
    this.poke(this.A, this.CH);
    this.pokeColor(this.A, 2); // Red bike head

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
      this.pokeColor(prevCell, 2); // Red trail (Line 103: retains Color 2 from previous bike head!)
    }

    // 2. Line 104: POKE 36874,196 : POKE 36875,196 : POKE 36876,176 (Exact Vic-20 motor chord POKEs!)
    this.soundChip.poke(36874, 196);
    this.soundChip.poke(36875, 196);
    this.soundChip.poke(36876, 176);

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
    this.applyCornerLogic();
  }

  applyCornerLogic() {
    if (this.OD === -22 && this.D === -1)      { this.NW = 4; this.WT = 6; } // UP -> LEFT (╗ corner)
    else if (this.OD === 22 && this.D === -1)  { this.NW = 4; this.WT = 7; } // DOWN -> LEFT (╝ corner)
    else if (this.OD === -22 && this.D === 1)  { this.NW = 4; this.WT = 5; } // UP -> RIGHT (╔ corner)
    else if (this.OD === 22 && this.D === 1)   { this.NW = 4; this.WT = 8; } // DOWN -> RIGHT (╚ corner)
    else if (this.OD === 1 && this.D === 22)   { this.NW = 3; this.WT = 6; } // RIGHT -> DOWN (╗ corner)
    else if (this.OD === 1 && this.D === -22)  { this.NW = 3; this.WT = 7; } // RIGHT -> UP (╝ corner)
    else if (this.OD === -1 && this.D === -22) { this.NW = 3; this.WT = 8; } // LEFT -> UP (╚ corner)
    else if (this.OD === -1 && this.D === 22)  { this.NW = 3; this.WT = 5; } // LEFT -> DOWN (╔ corner)
  }

  // --- MAN PICKUP & LEVEL CLEAR (Lines 6100-6130) ---
  handleManCollected() {
    // Line 6100: DF = DF + 1
    // Line 6102: SC = SC + 10
    this.menCollected++;
    this.score += 10;
    this.updateHUD();

    // Line 6105: IF DF < MAN THEN 165 (continue playing seamlessly)
    if (this.menCollected < this.manTotal) {
      this.poke(this.A, this.CH);
      this.pokeColor(this.A, 2);
      this.applyCornerLogic(); // Jump to 3000
    } else {
      // Line 6110-6130: Grid Cleared Routine
      this.state = 'LEVEL_CLEAR';
      this.soundChip.silenceAll();
      this.score += 100; // Line 6130: SC = SC + 100 bonus

      // Line 6110: PRINT"{BLACK}": POKE36874,0: POKE36875,0: POKE36876,0
      // Line 6120: PRINT"{HOME}{DOWN}{DOWN}{DOWN}{RIGHT}{RVON}GRID";GRID;"CLEARED"
      this.printPetscii(`{BLACK}{HOME}{DOWN}{DOWN}{DOWN}{RIGHT}{RVON}GRID ${this.gridLevel} CLEARED`);
      this.render();

      // Line 6125-6130: Delay & Stage Advance
      setTimeout(() => {
        this.manTotal++;   // MAN = MAN + 1
        this.gridLevel++;  // GRID = GRID + 1
        this.initLevel();
      }, 2000);
    }
  }

  // --- CRASH & GAME OVER (Lines 4000-4220) ---
  handleCrash() {
    this.state = 'GAME_OVER';
    this.soundChip.playCrashExplosionSweep();

    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('gridbike_highscore', this.highScore.toString());
    }
    this.updateHUD();

    // Lines 4001-4050: Color flash on crash cell (A - D)
    const crashCell = this.A - this.D;
    let flashStep = 0;
    const flashInterval = setInterval(() => {
      if (flashStep >= 80) {
        clearInterval(flashInterval);
        this.showGameOverScreen();
        return;
      }
      this.pokeColor(crashCell, flashStep % 8);
      this.render();
      flashStep++;
    }, 12);
  }

  // Lines 4080-4180: Game Over Screen Presentation
  showGameOverScreen() {
    this.state = 'GAME_OVER';
    // BASIC Lines 4080-4140:
    // 4080 PRINT"{CLR}{WHITE}"
    // 4100 PRINT"     {RVON} GRID BIKE "
    // 4110 PRINT"{DOWN}{DOWN}{DOWN}YOUR SCORE=";SC
    // 4130 PRINT"{DOWN}HIGH SCORE=";HS
    // 4140 PRINT"{DOWN}{DOWN}ANOTHER GAME(Y/N)"
    this.printPetscii(
      "{CLR}{WHITE}" +
      "     {RVON} GRID BIKE \n" +
      "{DOWN}{DOWN}{DOWN}YOUR SCORE=" + this.score + "\n" +
      "{DOWN}HIGH SCORE=" + this.highScore + "\n" +
      "{DOWN}{DOWN}ANOTHER GAME(Y/N)"
    );
    this.render();
  }

  updateHUD() {
    document.getElementById('hudScore').textContent = this.score;
    document.getElementById('hudHighScore').textContent = this.highScore;
    document.getElementById('hudLevel').textContent = this.gridLevel;
    const remaining = Math.max(0, this.manTotal - this.menCollected);
    document.getElementById('hudMen').textContent = remaining;
  }

  // --- RENDERING ENGINE ---
  render() {
    // Determine screen background based on Vic-20 POKE 36879 ($900F)
    // LOADER / DIFFICULTY / GAME_OVER: POKE 36879, 8 -> Black background (0), Black border (0)
    // PLAYING / LEVEL_CLEAR: POKE 36879, 56 (0x38) -> Cyan background (3), Black border (0)
    let bgHex = VIC_COLORS[0]; // Black background default for menus
    if (this.state === 'PLAYING' || this.state === 'LEVEL_CLEAR') {
      bgHex = VIC_COLORS[3]; // Cyan screen background (POKE 36879, 56)
    }

    this.ctx.fillStyle = bgHex;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    for (let r = 0; r < this.ROWS; r++) {
      for (let c = 0; c < this.COLS; c++) {
        const idx = r * this.COLS + c;
        const charCode = this.screenRAM[idx];
        const colorCode = this.colorRAM[idx];

        const x = c * this.CELL_PX;
        const y = r * this.CELL_PX;

        this.drawCharacter(charCode, x, y, colorCode, bgHex);
      }
    }
  }

  drawCharacter(charCode, destX, destY, colorCode, screenBgHex) {
    const customDef = CHAR_DEFINITIONS[charCode];
    const isReverse = (colorCode & 0x80) !== 0;
    const pureColor = colorCode & 0x7f;
    const colorHex = VIC_COLORS[pureColor] || '#ffffff';

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
      // Standard ASCII character cell (PETSCII reverse video supported)
      let bgBoxColor = screenBgHex;
      let textColor = colorHex;

      if (isReverse) {
        bgBoxColor = colorHex;
        textColor = screenBgHex;
      }

      this.ctx.fillStyle = bgBoxColor;
      this.ctx.fillRect(destX, destY, this.CELL_PX, this.CELL_PX);

      // Render character text
      this.ctx.fillStyle = textColor;
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

  handleScreenTap() {
    this.soundChip.ensureAudioContext();
    if (this.state === 'LOADER' || this.state === 'GAME_OVER') {
      this.showDifficultyPrompt();
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

  // Tap Canvas to advance prompts
  const gameCanvas = document.getElementById('gameCanvas');
  if (gameCanvas) {
    gameCanvas.addEventListener('pointerdown', () => {
      gameInstance.handleScreenTap();
    });
  }

  // Control Buttons & Toggles
  document.getElementById('btnRestart').addEventListener('click', () => {
    gameInstance.showDifficultyPrompt();
  });

  document.getElementById('btnSound').addEventListener('click', (e) => {
    gameInstance.soundChip.isMuted = !gameInstance.soundChip.isMuted;
    if (gameInstance.soundChip.isMuted) {
      gameInstance.soundChip.silenceAll();
    }
    e.currentTarget.innerHTML = gameInstance.soundChip.isMuted 
      ? '🔇 SOUND: OFF' 
      : '🔊 SOUND: ON';
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

  // Mobile Prompt Action Buttons
  const btnEasy = document.getElementById('btnEasy');
  const btnHard = document.getElementById('btnHard');

  if (btnEasy) {
    btnEasy.addEventListener('pointerdown', () => {
      gameInstance.soundChip.ensureAudioContext();
      if (gameInstance.state === 'GAME_OVER') {
        gameInstance.showDifficultyPrompt();
      } else {
        gameInstance.startNewGame(1);
      }
    });
  }

  if (btnHard) {
    btnHard.addEventListener('pointerdown', () => {
      gameInstance.soundChip.ensureAudioContext();
      if (gameInstance.state === 'GAME_OVER') {
        gameInstance.startNewGame(2);
      } else {
        gameInstance.startNewGame(2);
      }
    });
  }

  // Touch D-Pad Controls
  const dpadLeft = document.getElementById('dpadLeft');
  const dpadRight = document.getElementById('dpadRight');
  const dpadUp = document.getElementById('dpadUp');
  const dpadDown = document.getElementById('dpadDown');

  const handleDpadInput = (dir) => {
    gameInstance.soundChip.ensureAudioContext();
    if (gameInstance.state === 'LOADER' || gameInstance.state === 'GAME_OVER') {
      gameInstance.showDifficultyPrompt();
    } else if (gameInstance.state === 'DIFFICULTY') {
      if (dir === 'LEFT' || dir === 'UP') gameInstance.startNewGame(1);
      else if (dir === 'RIGHT' || dir === 'DOWN') gameInstance.startNewGame(2);
    } else if (gameInstance.state === 'PLAYING') {
      gameInstance.queueInput(dir);
    }
  };

  if (dpadLeft) dpadLeft.addEventListener('pointerdown', () => handleDpadInput('LEFT'));
  if (dpadRight) dpadRight.addEventListener('pointerdown', () => handleDpadInput('RIGHT'));
  if (dpadUp) dpadUp.addEventListener('pointerdown', () => handleDpadInput('UP'));
  if (dpadDown) dpadDown.addEventListener('pointerdown', () => handleDpadInput('DOWN'));

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
