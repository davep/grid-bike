# Grid Bike (1983 Vic-20 Game)

> A faithful standalone JavaScript & HTML5 recreation of **Grid Bike**, a classic light-cycle arcade game originally written for the unexpanded Commodore Vic-20 by **David Pearson of York** and published in *Popular Computing Weekly / PCN* (December 15–21, 1983).

![Vic-20 Badge](https://img.shields.io/badge/Commodore-VIC--20-blue?style=for-the-badge)
![JS Badge](https://img.shields.io/badge/JavaScript-HTML5%20Canvas-yellow?style=for-the-badge)

---

## 🕹️ Game Overview

In **Grid Bike**, you control a high-speed energy bike on a 22x23 character grid. As your bike moves, it leaves behind an impassable trail. 

- **Objective:** Navigate the grid and rescue all stranded men (represented by custom stick-figure characters).
- **Hazards:** Avoid crashing into your own trail, outer border walls, or malicious computer-placed obstacle blocks.
- **Difficulty Modes:**
  - **Easy (Press 1):** Grid filled with stranded men and empty grid tiles.
  - **Hard (Press 2):** In addition to men, 10+ black obstacle blocks (`character 230`) are randomly placed across the grid.
- **Level Progression:** Rescuing all men on screen displays `"GRID X CLEARED"` and advances to the next stage with increased men and challenge!

---

## ✨ Features

- **Pixel-Accurate Vic-20 Renderer:** 22x23 tile matrix rendered via HTML5 Canvas with exact 8x8 custom character bitmasks and authentic Vic-20 color palette (Yellow border, White background, Blue grid/trail, Red bike head, Black blocks).
- **Hardware-Accurate MOS 6560/6561 VIC Sound Emulator:** Web Audio API synthesizer emulates the 4 sound channels of the Vic-20 sound chip:
  - Voice 1 Bass (`36874`), Voice 2 Alto (`36875`), Voice 3 Soprano (`36876`), Voice 4 Noise (`36877`), and Master Volume (`36878`).
  - Faithfully recreates the signature 3-voice engine hum chord (`POKE 36874,196: POKE 36875,196: POKE 36876,176`).
- **Seamless Corner Connection:** Faithfully reproduces line `3000-3070` turn logic with matching 90-degree corner character tiles (╔ ╗ ╚ ╝).
- **Multi-Input Controls:**
  - **Original Vic-20 Keys:** `Z` (Left), `X` (Right), `L` (Up), `,` (Down)
  - **Modern Keyboard:** Arrow Keys (`◀` `▶` `▲` `▼`), `WASD`
  - **Mobile / Touch:** Interactive D-Pad controls
- **Embedded Magazine Archive:** Integrated tabbed modal containing the high-resolution original magazine scans (`original/grid-bike-page-1.jpg` and `original/grid-bike-page-2.jpg`) and annotated CBM BASIC code listing.

---

## 🚀 How to Play

### Option 1: Direct File
Simply open `index.html` in any web browser:
```bash
open index.html
```

### Option 2: Local Web Server
Serve the project using Python or any HTTP server:
```bash
python3 -m http.server 8080
```
Then visit **[http://localhost:8080](http://localhost:8080)** in your browser!

---

## 🎮 Controls Summary

| Action | Original Vic-20 Key | Alternative Keys |
| :--- | :---: | :---: |
| **Move Left** | `Z` | `ArrowLeft` / `A` |
| **Move Right** | `X` | `ArrowRight` / `D` |
| **Move Up** | `L` | `ArrowUp` / `W` |
| **Move Down** | `,` (comma) | `ArrowDown` / `S` |
| **Easy Mode** | `1` | `1` |
| **Hard Mode** | `2` | `2` |

---

## 💻 Vic-20 CBM BASIC Source Code

Disassembled directly from the December 15–21, 1983 publication of *Popular Computing Weekly / PCN* (Pages 83 & 85).

The game is split into two standalone Commodore BASIC `.bas` files:
- **Part 1 Loader Program:** [`grid-bike-loader.bas`](grid-bike-loader.bas) (or [`grid-bike-1.bas`](grid-bike-1.bas)) — Loads custom graphics bitmasks, sets colors, prints instructions, and auto-chains into Part 2 via keyboard buffer POKEs (`POKE 198,7`).
- **Part 2 Main Game Program:** [`grid-bike-game.bas`](grid-bike-game.bas) (or [`grid-bike-2.bas`](grid-bike-2.bas)) — Initializes grid matrix, places stranded men, handles light-cycle movement, collision checks, corner turn logic, and stage clearing.

### Complete Combined Listing:


```basic
1000 POKE52,28:POKE56,28:CLR
1010 FORI=7168TO7256:POKEI,PEEK(I+25600):NEXT
1020 FORJ=7168TO7256:READQ:POKEJ,Q:NEXT
5000 PRINT"{CLR}{WHITE}"
5010 POKE36879,8
5020 PRINT"           GRID BIKE "
5030 PRINT"{DOWN}YOU ARE THE DRIVER "
5040 PRINT"OF THE GRID BIKE."
5050 PRINT"YOU MUST DRIVE ROUND "
5060 PRINT"THE GRID PICKING UP"
5070 PRINT"THE PEOPLE."
5080 PRINT"AS YOU DRIVE AROUND"
5090 PRINT"THE GRID YOU LEAVE A"
5100 PRINT"TRAIL."
5110 PRINT"IF YOU RUN INTO IT"
5120 PRINT"YOU WILL BE KILLED."
5130 PRINT"Z=LEFT"
5140 PRINT"X=RIGHT"
5150 PRINT"L=UP"
5160 PRINT",=DOWN"
5170 PRINT"{DOWN}     PRESS ANY KEY"
5175 PRINT"{DOWN}BY D.PEARSON"
5180 GETA$:IFA$=""THEN5180
5190 PRINT"{CLR}"
5200 PRINT"THIS PROGRAM LOADS THEGRAPHICS,SO LOAD IT EVERY TIME"
5300 POKE198,7:POKE631,76:POKE632,207:POKE633,159:POKE634,13
5400 POKE635,82:POKE636,213:POKE637,13
9000 DATA0,231,255,255,255,255,231,0
9010 DATA126,126,126,60,60,126,126,126
9020 DATA255,129,129,129,129,129,129,255
9030 DATA24,24,24,24,24,24,24,24
9040 DATA0,0,0,255,255,0,0,0
9050 DATA0,0,0,31,31,24,24,24
9060 DATA0,0,0,248,248,24,24,24
9070 DATA24,24,24,248,248,0,0,0
9080 DATA24,24,24,31,31,0,0,0
9090 DATA255,255,255,255,255,255,255,255
9100 DATA28,28,8,62,8,20,34,65,0

0 QWE=RND(1-TI)
1 CLR
2 PRINT"{CLR}DO YOU WANT EASY (1) OR HARD (2)";:INPUTTYU
3 IFTYU<1ORTYU>2THEN2
5 PRINT"{CLR}";:POKE36878,15:POKE36869,255
10 A=8174:GRID=1:CH=1:DF=1:WT=3:NW=3:D=-22:SC=0:MAN=1
45 POKE36879,56
50 FORN=7680TO8185:POKEN,2:NEXT
80 FORN=38400TO38905:POKEN,6:NEXT
96 FORN=7680TO8164STEP22:POKEN,9:NEXT
97 FORN=38400TO38884STEP22:POKEN,0:NEXT
98 FORN=1TOMAN:RP=INT(RND(1)*506)+7680:IFPEEK(RP)<>2THENRP=RP+1
99 POKERP,10:NEXTN
100 IFTYU=1THEN103
101 FORN=1TO10:SP=INT(RND(1)*506)+7680:IFPEEK(SP)<>2THENSP=SP+1
102 POKESP,230:POKESP+30720,0:NEXT
103 POKEA,CH:POKEA+30720,2:POKEA+(-D),WT
104 POKE36874,196:POKE36875,196:POKE36876,176
105 OD=D
106 IFNW=0THEN110
107 WT=NW
110 GETA$
120 IFA$="Z"THEND=-1:WT=4:CH=0
130 IFA$="X"THEND=1:WT=4:CH=0
140 IFA$="L"THEND=-22:WT=3:CH=1
150 IFA$=","THEND=22:WT=3:CH=1
160 A=A+D
162 IFPEEK(A)>2ANDPEEK(A)<10ORPEEK(A)=230THEN4000
163 IFPEEK(A)=10THENGOTO6100
165 GOTO3000
180 IFA<7680ORA>8185THENGOTO4000
190 GOTO103

3000 IFOD=-22ANDD=-1THENNW=4:WT=6
3010 IFOD=22ANDD=-1THENNW=4:WT=7
3020 IFOD=-22ANDD=1THENNW=4:WT=5
3030 IFOD=22ANDD=1THENNW=4:WT=8
3040 IFOD=1ANDD=22THENNW=3:WT=6
3050 IFOD=1ANDD=-22THENNW=3:WT=7
3060 IFOD=-1ANDD=-22THENNW=3:WT=8
3070 IFOD=-1ANDD=22THENNW=3:WT=5
3080 GOTO180

4000 POKE36878,0:POKE36874,0:POKE36875,0:POKE36876,0
4010 POKE36877,240:POKE36878,15:FORN=1TO300:NEXT:POKE36877,0:POKE36878,0
4020 PRINT"{CLR}{RED}      GAME OVER"
4030 PRINT"{DOWN}{WHITE}    PRESS ANY KEY"
4040 GETA$:IFA$=""THEN4040
4050 GOTO1

6100 MAN=MAN-1
6110 POKE36876,240:FORN=1TO50:NEXT:POKE36876,248:FORN=1TO50:NEXT
6120 POKE36874,196:POKE36875,196:POKE36876,176
6130 IFMAN>0THEN103
6140 GRID=GRID+1:MAN=GRID
6150 PRINT"{CLR}{WHITE}   GRID ";GRID-1;" CLEARED"
6160 FORN=1TO1500:NEXT
6170 GOTO50
```

---

## 📜 Credits & History

- **Original Author:** David Pearson of York
- **Publication:** *Popular Computing Weekly / PCN* (December 15–21, 1983)
- **Web Recreation:** JavaScript / HTML5 Canvas / Web Audio API (2026)
