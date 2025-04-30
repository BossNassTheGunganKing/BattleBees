# BattleBees Multiplayer

A multiplayer word game inspired by spelling bee puzzles, built with React, TypeScript, and Socket.IO.

## Features

- 🎮 Real-time multiplayer gameplay
- 🐝 Honeycomb letter grid with center letter mechanic
- 🏆 Multiple win conditions
- 🎲 Random puzzle selection
- 📝 Word validation with dictionary API
- 🔄 Dynamic room creation and joining
- ⚙️ Customizable game settings

## Game Rules

- Create words using the letters in the honeycomb
- Each word must:
  - Use the center letter
  - Be at least 4 letters long
  - Be a valid English word (according to https://dictionaryapi.dev/)
- Scoring:
  - 4 letters = 1 point
  - 5 letters = 5 points
  - 6 letters = 6 points
  - 7+ letters = 7 points
  - Pangrams (using all letters) = +14 bonus points!

## Win Conditions

Players can win by:

- Reaching the target score (default: 30 points)
- Finding a pangram (optional setting)
- Finding a set number of valid words (default: 10 words)

## Technologies Used

- Frontend:

  - React
  - TypeScript
  - Vite
  - Socket.IO Client
  - CSS3

- Backend:
  - Node.js
  - Express
  - Socket.IO
  - CSV-Parse

## Getting Started

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
4. Start the game server:
   ```bash
   node src/server/index.js
   ```

## Game Flow

1. Create or join a room with a unique room code
2. Wait for other players (2-4 players)
3. Configure game settings (optional)
4. Start the game with a countdown
5. Find words using the provided letters
6. First player to meet any win condition wins!

## Deployment

- Frontend is deployable to Vercel
- Backend is deployable to any Node.js hosting service (e.g., Render)

## Environment Variables

- `SOCKET_URL`: WebSocket server URL (defaults to localhost:4000 in development)
- `PORT`: Server port (defaults to 4000)

