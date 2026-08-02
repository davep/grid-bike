# Recreating Grid Bike: From 1983 Vic-20 BASIC Scan to Web Application

> **A step-by-step account of taking a 1983 Commodore Vic-20 magazine listing published in *Popular Computing Weekly / PCN*, analyzing the code and hardware specs, and building a standalone JavaScript recreation.**

---

## Background & Vision

In December 1983, **David Pearson of York** published a game called **Grid Bike** in *Popular Computing Weekly / PCN* (Issue 83/85). Written in Commodore BASIC for an unexpanded Vic-20, the game was a light-cycle arcade variation where players navigate a grid, rescue stranded men (stick-figure graphics), and leave behind a fatal energy trail.

Over 40 years later, David provided two magazine page scans (`grid-bike-page-1.jpg` and `grid-bike-page-2.jpg`) with the goal of recreating the game as a playable HTML5 / JavaScript web app.

Below is the complete record of the prompts, technical analysis, debugging iterations, and implementation steps followed during the project.

---

## Act I: OCR, Code Disassembly & Initial Web App

### 💬 Prompt 1
> *"In this directory you will find grid-bike-page-1.jpg and grid-bike-page-2.jpg -- these are two scans from a magazine from the early 1980s, that contain a game I wrote for the Vic20. I want you to OCR the images to pull out the code, understand the code, and then create a faithful recreation of the game as a standalone webpage, with the game written in JavaScript, so that I can play the game once again."*

### 🛠️ Work Done
1. **Source Inspection & Metadata:**
   - Identified author credit: *David Pearson of York* (December 15–21, 1983, PCN, Pages 83 & 85).
   - Examined magazine scans to extract Vic-20 screen architecture:
     - Screen memory: `7680` to `8185` (22 columns × 23 rows = 506 characters).
     - Color RAM: `38400` to `38905` (`7680 + 30720`).
2. **BASIC Code Transcribing & Disassembly:**
   - **Loader Program (Lines 1000–9100):** Redefines VIC character memory at address `7168` ($1C00), sets background/border colors via `POKE 36879`, prints title/instructions, and defines 11 custom 8×8 pixel bitmasks.
   - **Main Program (Lines 0–3080):** Sets up game grid, places stranded men (`Char 10`) and optional obstacle blocks (`Char 230` in Hard mode), handles bike movement (`D = -22` for UP, `22` for DOWN, `-1` for LEFT, `1` for RIGHT), checks collision, and calculates corner turn connections.
3. **Decoded Custom 8×8 Character Bitmaps:**
   - `Char 0`: Horizontal Bike Head
   - `Char 1`: Vertical Bike Head
   - `Char 2`: Grid Box Tile (`255, 129, 129, ...`)
   - `Char 3`: Vertical Trail Line (`|`)
   - `Char 4`: Horizontal Trail Line (`-`)
   - `Char 5, 6, 7, 8`: 90-Degree Corner Connectors (╔ ╗ ╝ ╚)
   - `Char 9`: Outer Wall Block
   - `Char 10`: Stranded Man Stick Figure
   - `Char 230`: Hard Mode Obstacle Block
4. **Initial Web App Build:**
   - Built initial structure: `index.html`, `style.css`, and `game.js`.

---

## Act II: Isolated Python Tools & High-Res Inspection

### 💬 Prompt 2 & 3
> *"Don't use global Python environment; if you need Python use uv to make a venv here and install what you need."*  
> *"Just run Python with `uv run python`, etc."*

### 🛠️ Work Done
- Created an isolated Python environment using `uv venv` and installed `Pillow`.
- Wrote python cropping scripts via `uv run python` to generate focused high-resolution crops of ambiguous code sections:
  - `crops/p1_screenshot.png`: Vic-20 CRT screen monitor showing `"GRID 1 CLEARED"`.
  - `crops/data_zoom.png`: High-resolution zoom of DATA lines 9000–9100.
  - `crops/turns_zoom.png`: High-resolution zoom of turn calculation lines 3000–3070.

---

## Act III: Fixing Trail Line Directions & Corner Turns

### 💬 Prompt 4
> *"That's very close. However, the lines aren't quite right. Every line, even if I'm moving horizontally, is a vertical line. Also the turns should be corners."*

### 🔍 Root Cause Analysis & Debugging
1. **The Vertical Line Bug:**
   - In `game.js`, `this.WT` (working trail character) was being reset to `this.NW` (initialized to `3`, vertical line) on every tick before horizontal input updated `NW` to `4`.
2. **The Turn Sequence Bug:**
   - In original Vic-20 BASIC, line `103` draws the trail behind the bike head (`POKE A+(-D), WT`). When a turn happens, lines `3000-3070` set `WT` to the corner character (5, 6, 7, or 8) and `NW` to the new straight line character (3 or 4).
   - On the next pass through line `103`, `POKE A+(-D), WT` writes the corner tile at the exact cell where the turn occurred! Then lines `106-107` (`IF NW <> 0 THEN WT = NW`) transition `WT` to the straight line character for subsequent movement.

### 🛠️ Work Done
- Re-aligned `gameTick()` in `game.js` to strictly match the Vic-20 BASIC execution sequence:
  ```
  Line 103 (Draw Head & Previous Trail) -> Line 104 (Audio) -> Line 105 (Store OD) -> Lines 106-107 (WT = NW) -> Lines 110-150 (Input) -> Line 160 (Move A) -> Collision -> Lines 3000-3070 (Corner Check)
  ```
- Verified all 8 turn conditions from `crops/turns_zoom.png`:
  - **UP -> LEFT:** Corner `6` (╗), next `NW = 4` (`-`)
  - **DOWN -> LEFT:** Corner `7` (╝), next `NW = 4` (`-`)
  - **UP -> RIGHT:** Corner `5` (╔), next `NW = 4` (`-`)
  - **DOWN -> RIGHT:** Corner `8` (╚), next `NW = 4` (`-`)
  - **RIGHT -> DOWN:** Corner `6` (╗), next `NW = 3` (`|`)
  - **RIGHT -> UP:** Corner `7` (╝), next `NW = 3` (`|`)
  - **LEFT -> UP:** Corner `8` (╚), next `NW = 3` (`|`)
  - **LEFT -> DOWN:** Corner `5` (╔), next `NW = 3` (`|`)

---

## Act IV: Bitmask Pixel Alignment & Text Contrast

### 💬 Prompt 5
> *"The horizontal line does't quite line up with the corner peices. Also, when you clear a level, the message that appears on the grid isn't readable."*

### 🔍 Root Cause Analysis & Debugging
1. **Bitmask Misalignment:**
   - In `CHAR_DEFINITIONS`, `Char 4` (horizontal trail) set bits on **Rows 3 & 4** (`[0, 0, 0, 255, 255, 0, 0, 0]`).
   - However, `Char 5` and `Char 6` had been transcribed with only 2 leading zeroes (`[0, 0, 31, 31, ...]`), putting their horizontal arms on **Rows 2 & 3**—off by 1 pixel row!
   - Inspecting `crops/data_zoom.png` confirmed lines 9050 and 9060 in the magazine listing had **3 leading zeroes**: `DATA 0,0,0,31,31,24,24,24` and `DATA 0,0,0,248,248,24,24,24`.
2. **Unreadable Level Clear Text:**
   - `"GRID X CLEARED"` was rendered with white text on a white canvas background without a background cell box, causing collision with grid lines.

### 🛠️ Work Done
- Updated `Char 5` and `Char 6` bitmasks in `game.js` to include 3 leading zeroes, bringing all 4 corners and the horizontal trail into 100% pixel alignment on **Rows 3 & 4**.
- Refactored `drawCharacter()` so ASCII text overlays render with a solid high-contrast dark blue background cell (`#0000aa`) and bright yellow font (`#eeee00`), making `"GRID X CLEARED"` crisp and clear.

---

## Act V: Hardware-Accurate VIC Sound Chip Emulation

### 💬 Prompt 6
> *"This looks much better. Now, the sound. This doesn't sound like it did originally on the Vic20. Do you think you can check how the sound chip worked on the Vic20, then take the POKE commands into account and do a faithful recreation of it?"*

### 🔊 Technical Analysis of the MOS 6560/6561 Sound Chip
The Vic-20 VIC chip features 4 sound registers:
- `36874` ($900E): Voice 1 (Bass square wave)
- `36875` ($900F): Voice 2 (Alto square wave, +1 octave)
- `36876` ($9010): Voice 3 (Soprano square wave, +2 octaves)
- `36877` ($9011): Voice 4 (White noise generator)
- `36878` ($9012): Master Volume (0–15)

The hardware frequency formula for Vic-20 sound voices is:
$$F = \frac{138550.5}{255 - V} \times \text{OctaveMultiplier}$$

#### Deconstructing Line 104 Engine Hum POKEs
Line 104 in David's code executes:
```basic
104 POKE 36874, 196 : POKE 36875, 196 : POKE 36876, 176
```
- **`POKE 36874, 196`** ($V_1 = 68$): $F_1 = \frac{138550.5}{255 - 68} = \mathbf{740.9\text{ Hz}}$ (Bass square wave)
- **`POKE 36875, 196`** ($V_2 = 68$): $F_2 = 740.9 \times 2 = \mathbf{1481.8\text{ Hz}}$ (Alto square wave)
- **`POKE 36876, 176`** ($V_3 = 48$): $F_3 = \frac{138550.5}{255 - 48} \times 4 = \mathbf{2677.3\text{ Hz}}$ (Soprano square wave)

### 🛠️ Work Done
- Built a dedicated `Vic20SoundChip` emulator class in `game.js`.
- Implemented persistent 50% duty-cycle Web Audio square wave oscillators for Voices 1, 2, and 3, and a noise buffer source for Voice 4.
- Added a direct `poke(register, value)` interface method that computes exact hardware frequencies dynamically.
- Wired line 104 POKEs to run on every tick during gameplay, reproducing the original 3-voice motor hum chord.

---

## Act VI: Asset Organization, Documentation & Polish

### 💬 Prompts 7, 8 & 9
> *"I moved the original scans into @original -- update the links to them please"*  
> *"Create a README.md"*  
> *"Please also create a creating.md which documents the process we've followed here. Record my prompts and then the work you did. I want to turn this into a blog post in the near future."*

### 🛠️ Work Done
- Updated file paths in `index.html` and documentation to point to `original/grid-bike-page-1.jpg` and `original/grid-bike-page-2.jpg`.
- Created comprehensive [`README.md`](README.md) containing repository guide, controls, CBM BASIC source code, and VIC sound formulas.
- Created this [`creating.md`](creating.md) document to archive the prompt history, technical analysis, and development journey for blog publication.

---

## Summary of Completed Files

- **[`index.html`](index.html):** Main web app with CRT monitor frame, HUD, and magazine archive modal.
- **[`game.js`](game.js):** 22x23 tile renderer, Vic-20 memory RAM simulation, and `Vic20SoundChip` emulator.
- **[`style.css`](style.css):** Retro arcade CRT styling and responsive controls layout.
- **[`README.md`](README.md):** Repository user guide and technical summary.
- **[`creating.md`](creating.md):** Detailed development blog post draft.
