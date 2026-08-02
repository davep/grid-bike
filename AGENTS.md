# AGENTS.md

> **Guidelines and Repository Architecture for AI Coding Assistants working on Grid Bike.**

---

## 🚨 MANDATORY DIRECTIVE FOR ALL AGENTS

> [!IMPORTANT]
> **CRITICAL & MANDATORY:** Any time ANY modification, bug fix, feature addition, asset relocation, or refactoring is performed in this repository, **[`creating.md`](creating.md) MUST BE UPDATED IMMEDIATELY**.
> 
> `creating.md` serves as the official, living development log and blog post draft for this project. Every change must record:
> 1. The user request / prompt.
> 2. Root cause analysis & technical rationale.
> 3. Specific code changes, hardware calculations, or design decisions made.

---

## 📌 Repository Overview

**Grid Bike** is a standalone JavaScript and HTML5 Canvas recreation of a 1983 Commodore Vic-20 arcade game written by **David Pearson of York** and published in *Popular Computing Weekly / PCN* (Issue 83/85, Dec 15–21, 1983).

### Key Components:
- **`index.html`**: Arcade CRT frame UI, HUD status panel, mobile touch controls, and interactive magazine archive modal.
- **`game.js`**: Vic-20 character bitmap graphics engine, 22x23 tile grid RAM model (`7680` screen RAM, `38400` color RAM), game loop state machine, and hardware-accurate MOS 6560/6561 `Vic20SoundChip` synthesizer.
- **`style.css`**: Authentic Vic-20 color system, retro typography, CRT scanline overlay, and responsive layout.
- **`original/`**: High-resolution scans of the original 1983 magazine pages (`grid-bike-page-1.jpg`, `grid-bike-page-2.jpg`).
- **`README.md`**: User-facing repository overview, controls summary, and BASIC source code.
- **`creating.md`**: Living blog post draft tracking prompts, technical analysis, and build history.

---

## 🔊 Emulation Standards & Formulas

When modifying game logic or audio in `game.js`:

1. **Vic-20 VIC 6560 Sound Chip Emulation:**
   - Sound registers: `36874` (Voice 1 Bass), `36875` (Voice 2 Alto), `36876` (Voice 3 Soprano), `36877` (Voice 4 Noise), `36878` (Master Volume 0–15).
   - Tone Frequency Formula:
     $$F_{\text{out}} = \frac{138550.5}{255 - V} \times \text{OctaveMultiplier}$$
     - Voice 1 multiplier: `1x`
     - Voice 2 multiplier: `2x`
     - Voice 3 multiplier: `4x`
   - Engine motor hum must maintain the exact 3-voice chord from line 104 of David's BASIC listing (`POKE 36874,196: POKE 36875,196: POKE 36876,176`).

2. **Custom 8×8 Character Bitmaps (Lines 9000–9100):**
   - Char 0: Horizontal Bike Head
   - Char 1: Vertical Bike Head
   - Char 2: Grid Box Tile (`[255, 129, 129, 129, 129, 129, 129, 255]`)
   - Char 3: Vertical Trail (`[24, 24, 24, 24, 24, 24, 24, 24]`)
   - Char 4: Horizontal Trail (`[0, 0, 0, 255, 255, 0, 0, 0]`)
   - Char 5, 6, 7, 8: 90° Corner Connectors (╔ ╗ ╝ ╚) — Must share **Rows 3 & 4** with Char 4.
   - Char 9: Border Wall Block
   - Char 10: Stranded Man Stick Figure (`[28, 28, 8, 62, 8, 20, 34, 65]`)
   - Char 230: Obstacle Block

3. **Python Environment Rule:**
   - Never use global Python. Always run Python scripts via `uv run python`.
