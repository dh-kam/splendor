# Splendor: Renaissance Guild

> [한국어 문서 보기 (README.ko.md)](./README.ko.md)

**Splendor: Renaissance Guild** is a Renaissance gem-trading tabletop strategy web game built with React, Vite, Express, and Socket.IO. Compete against Renaissance guild AI merchants or gather friends around a shared TV board with smartphone controllers to become the first merchant to reach **15 prestige points**.

---

## Key Features

### Game Modes
- **Solo Match (1P vs AI)**: Play a 3-player or 4-player match against Renaissance guild AI opponents (Lorenzo, Beatrice, Cosimo) with customizable merchant name.
- **AI Spectator**: Watch a full 3-player or 4-player AI-vs-AI match unfold automatically on the tabletop.
- **TV + Mobile Local Multiplayer**: Display the shared gem bank, development market, and noble tiles on a TV or monitor while players scan a QR code to join from their smartphones as handheld controllers.

### Tabletop Craft & Effects
- **Full-Bleed Renaissance Velvet Tabletop**: Deep plum-velvet playmat with warm gilded framing, bespoke oil-painted merchant portraits, and ambient candlelight starlight.
- **3D Stacked Clay Poker Chips**: Tactile cylindrical gem stacks with hover levitation, selection lift, parabolic 3D flight arcs, and gem-toned sparkle bursts.
- **Illustrated Card Backs & Smooth Card Flip**: Custom Renaissance-themed Tier 1–3 card backs paired with smooth 3D card-flip replacement deals, card-purchase flights, and golden noble patronage banners.
- **Synthesized Tabletop Audio**: Zero-dependency Web Audio API sound effects (chip clinks, card deals, purchase chimes, turn bells, and noble fanfares) with an in-game mute toggle.

---

## How to Play

On each turn, perform **one** of the following actions:
1. **Take Gem Tokens**: Take **3 tokens of different colors**, or **2 tokens of the same color** (when at least 4 tokens of that color remain in the bank). Max 10 tokens held.
2. **Purchase a Development Card**: Spend tokens (reduced by your permanent gem bonuses) to buy a face-up card or a reserved card for permanent bonuses and prestige points.
3. **Reserve a Card**: Hold up to **3 cards** in reserve (from the market or blind-drawn from a deck) and receive **1 Gold Joker token** if available.

At the end of your turn, any **Noble** whose gem bonus requirements you meet automatically visits for **+3 prestige points**. When a merchant reaches **15 points**, the round finishes so all players get equal turns, and the highest-scoring merchant wins.

---

## Tech Stack

- **Frontend**: React 19, Vite, Lucide Icons, `qrcode.react`, Web Audio API
- **Backend & Real-Time Sync**: Node.js, Express 5, Socket.IO
- **Typography**: `Cinzel` / `Cormorant Garamond` (display) & locally embedded **SB Aggro (`Aggravo`)** (Korean UI & bold numerals)

---

## Getting Started

```bash
# Install dependencies
npm install

# Run development server (http://localhost:3000)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linter
npm run lint

# Run unit tests (game rules & state-diff FX)
npx tsx --test server/game.test.js src/utils/gameEffects.test.js
```

---

## Font Attribution

- **SB Aggro (`SBAggroL`, `SBAggroM`, `SBAggroB`)** — Created by Sandbox Network, Inc. Embedded locally for Korean typography and bold game numerals under its free-to-use license (redistribution of the font files themselves for resale is prohibited).
