const express = require('express');
const { Server } = require('socket.io');
const { createServer } = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const axios = require('axios'); // Add axios for API calls
const fs = require('fs');
const path = require('path');
const csv = require('csv-parse/sync');
const debug = require('debug')('battlebees:server');

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 4000;

// Update CORS configuration for Express
app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://battlebees.onrender.com'
  ],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Add after CORS configuration
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    socketio: {
      connected: io.engine.clientsCount,
      rooms: Array.from(io.sockets.adapter.rooms.keys())
    }
  });
});

app.get('/debug/rooms', (req, res) => {
  res.json({
    rooms: Object.keys(rooms).map(roomId => ({
      roomId,
      playerCount: Object.keys(rooms[roomId].players).length,
      gameStarted: rooms[roomId].gameStarted,
      countdownActive: rooms[roomId].countdownActive
    }))
  });
});

// Update Socket.IO configuration
const io = new Server(httpServer, {
  path: '/socket.io/', // Explicit socket.io path
  cors: {
    origin: [
      'http://localhost:5173',
      'https://battlebees.onrender.com'
    ],
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling'], // Prefer WebSocket, fallback to polling
  pingTimeout: 60000,
  pingInterval: 25000,
  maxHttpBufferSize: 1e8
});

// Single listen call on httpServer
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket server available at wss://battlebeesserver.onrender.com`);
});

const rooms = {};
let countdownIntervals = {};

const calculateScore = (wordLength) => {
  if (wordLength === 4) return 1;
  if (wordLength === 5) return 5;
  if (wordLength === 6) return 6;
  return 7; // 7+ letters
};

// Dictionary API validation
const checkDictionary = async (word) => {
  try {
    const response = await axios.get(`https://api.dictionaryapi.dev/api/v2/entries/en/${word.toLowerCase()}`);
    return response.status === 200;
  } catch (error) {
    console.error("Dictionary API error:", error.message);
    return false;
  }
};

function getRandomLetterSet() {
  try {
    const fileContent = fs.readFileSync(path.join(__dirname, 'gameLetters.csv'));
    const records = csv.parse(fileContent, {
      columns: ['letters', 'pangrams'],
      skip_empty_lines: true,
      fromLine: 2 // Skip header row
    });

    // Select random row from CSV
    const randomRow = records[Math.floor(Math.random() * records.length)];
    
    // Get the letters and pangrams from the row
    const letterString = randomRow.letters;
    const pangrams = randomRow.pangrams.split('|');
    
    // First letter is the center letter, rest are surrounding letters
    const centerLetter = letterString[0];
    const letters = Array.from(letterString);

    // Validate letter count
    if (letters.length !== 7) {
      console.error('Invalid letter count in CSV row:', letterString);
      throw new Error('Invalid letter count');
    }

    return {
      letters,
      centerLetter,
      pangrams
    };
  } catch (error) {
    console.error('Error reading game letters:', error);
    // Fallback in case of file error
    return {
      letters: ['B', 'F', 'D', 'O', 'L', 'I', 'E'],
      centerLetter: 'B',
      pangrams: ['FOIBLE']
    };
  }
}

io.on('connection', (socket) => {
  debug(`Client connected: ${socket.id}`);
  console.log('Transport:', socket.conn.transport.name);

  // Add connection event logging
  socket.onAny((eventName, ...args) => {
    debug(`Event received - ${eventName}:`, args);
  });

  socket.on('createRoom', ({ roomId, playerName }) => {
    console.log(`Creating room: ${roomId} for player: ${playerName}`);

    const { letters, centerLetter, pangrams } = getRandomLetterSet();
    rooms[roomId] = {
      roomId,
      letters,
      centerLetter,
      pangrams,
      players: {},
      gameStarted: false,
      gameSettings: {
        pointsToWin: 30,
        isPanagramInstantWin: true,
        totalWordsToWin: 10
      }
    };

    // Add the creating player to the room
    rooms[roomId].players[socket.id] = {
      id: socket.id,
      name: playerName,
      score: 0,
      foundWords: []
    };

    socket.join(roomId);

    // Send explicit joinConfirmed event to the room creator
    socket.emit('joinConfirmed', {
      playerId: socket.id,
      roomId,
      letters: rooms[roomId].letters,
      centerLetter: rooms[roomId].centerLetter,
      players: Object.values(rooms[roomId].players),
      roomExists: true
    });

    // Broadcast initial room state
    broadcastGameState(roomId);
    
    console.log(`Room ${roomId} created and joined by ${playerName}`);
  });

  socket.on('joinRoom', ({ roomId, playerName }) => {
    debug(`Join room request - Room: ${roomId}, Player: ${playerName}`);

    if (!rooms[roomId]) {
      debug(`Room ${roomId} not found`);
      socket.emit('roomError', 'Room not found');
      return;
    }

    // Add player to room
    rooms[roomId].players[socket.id] = {
      id: socket.id,
      name: playerName,
      score: 0,
      foundWords: []
    };

    socket.join(roomId);
    debug(`Player ${playerName} joined room ${roomId}`);

    // Emit join confirmation
    const joinData = {
      playerId: socket.id,
      roomId,
      letters: rooms[roomId].letters,
      centerLetter: rooms[roomId].centerLetter,
      players: Object.values(rooms[roomId].players),
      roomExists: true
    };

    debug('Sending join confirmation:', joinData);
    socket.emit('joinConfirmed', joinData);

    // Broadcast to other players
    socket.to(roomId).emit('playerJoined', {
      players: Object.values(rooms[roomId].players)
    });

    // Broadcast updated game state
    broadcastGameState(roomId);

    console.log(`Room ${roomId} players:`, rooms[roomId].players);
  });

  socket.on('submitWord', async ({ roomId, word }) => {
    console.log('Submit word details:', {
      roomId,
      socketId: socket.id,
      rooms: Object.keys(rooms),
      playersInRoom: rooms[roomId]?.players ? Object.keys(rooms[roomId].players) : []
    });
    
    if (!rooms[roomId] || !rooms[roomId].players[socket.id]) {
      console.log('Invalid room or player not found:', {
        roomExists: !!rooms[roomId],
        playerExists: rooms[roomId]?.players[socket.id]
      });
      return;
    }
  
    const room = rooms[roomId];
    const player = room.players[socket.id];
    
    // Basic word validation
    if (!word || word.length < 4) {
      socket.emit('wordError', { message: 'Word must be at least 4 letters long!' });
      return;
    }

    // Convert word to uppercase for consistent comparison
    const upperWord = word.toUpperCase();
    
    // Check if word only uses letters from the letter pool
    const letterPool = new Set(room.letters);
    const invalidLetters = Array.from(upperWord).filter(letter => !letterPool.has(letter));
    if (invalidLetters.length > 0) {
      socket.emit('wordError', { 
        message: `Invalid letters used: ${invalidLetters.join(', ')}. Only use letters from the honeycomb!` 
      });
      return;
    }
  
    // Check if word contains center letter
    if (!upperWord.includes(room.centerLetter)) {
      socket.emit('wordError', { message: 'Word must contain center letter!' });
      return;
    }
  
    // Check if word was already found by this player
    if (player.foundWords.includes(upperWord)) {
      socket.emit('wordError', { message: 'Word already found!' });
      return;
    }
  
    // Validate word exists in dictionary
    const isValid = await checkDictionary(word);
    if (!isValid) {
      socket.emit('wordError', { message: 'Word not in dictionary!' });
      return;
    }
  
    // Calculate score
    const isPangram = new Set(upperWord.split('')).size === room.letters.length;
    const wordScore = calculateScore(word.length) + (isPangram ? 14 : 0); // Changed from 7 to 14 for pangrams
  
    // Update player's score and found words
    player.score += wordScore;
    player.foundWords.push(upperWord);

    console.log('Checking win conditions:', {
      wordCount: player.foundWords.length,
      score: player.score,
      isPangram
    });

    // Check win conditions with explicit comparisons
    const hasWon = (
      player.score >= rooms[roomId].gameSettings.pointsToWin || 
      player.foundWords.length >= rooms[roomId].gameSettings.totalWordsToWin || 
      (isPangram && rooms[roomId].gameSettings.isPanagramInstantWin)
    );

    if (hasWon) {
      const winReason = isPangram && rooms[roomId].gameSettings.isPanagramInstantWin 
        ? 'Found a pangram!' 
        : player.foundWords.length >= rooms[roomId].gameSettings.totalWordsToWin 
          ? `Found ${rooms[roomId].gameSettings.totalWordsToWin} words!`
          : `Reached ${rooms[roomId].gameSettings.pointsToWin} points!`;

      rooms[roomId].gameOver = true;
      rooms[roomId].winner = {
        id: player.id,
        name: player.name,
        score: player.score,
        foundWords: player.foundWords,
        winReason,
        pangrams: rooms[roomId].pangrams
      };

      io.to(roomId).emit('gameOver', {
        winner: rooms[roomId].winner
      });

      // Also broadcast final game state
      broadcastGameState(roomId);
      return; // End processing after win
    }
  
    console.log(`Word accepted - Player: ${player.name}, Word: ${word}, Score: ${wordScore}`);
  
    // Notify the submitting player
    socket.emit('wordAccepted', {
      word: word.toUpperCase(),
      score: wordScore,
      isPangram
    });
  
    // Broadcast updated game state to all players
    broadcastGameState(roomId);
  });

  socket.on('startCountdown', ({ roomId }) => {
    if (!rooms[roomId]) return;
    
    console.log('Starting countdown for room:', roomId);
    
    // Set initial game state
    rooms[roomId].countdownActive = true;
    let timeLeft = 3;
    
    // Clear any existing interval for this room
    if (countdownIntervals[roomId]) {
      clearInterval(countdownIntervals[roomId]);
    }
    
    // Function to broadcast countdown
    const broadcastCountdown = () => {
      io.to(roomId).emit('countdownUpdate', { timeLeft });
      console.log('Countdown update sent:', timeLeft);
    };

    // Send initial countdown immediately
    broadcastCountdown();
    
    // Start countdown interval
    countdownIntervals[roomId] = setInterval(() => {
      timeLeft--;
      
      if (timeLeft >= 0) {
        broadcastCountdown();
      } else {
        // Clean up and start game
        clearInterval(countdownIntervals[roomId]);
        delete countdownIntervals[roomId];
        rooms[roomId].countdownActive = false;
        rooms[roomId].gameStarted = true;
        io.to(roomId).emit('gameStarted');
        broadcastGameState(roomId);
      }
    }, 1000);
  });

  socket.on('cancelCountdown', ({ roomId }) => {
    if (!rooms[roomId]) return;

    if (countdownIntervals[roomId]) {
      clearInterval(countdownIntervals[roomId]);
      delete countdownIntervals[roomId];
      rooms[roomId].countdownActive = false;
      
      // Notify all players that countdown was cancelled
      io.to(roomId).emit('countdownCancelled');
      broadcastGameState(roomId);
    }
  });

  socket.on('returnToLobby', ({ roomId }) => {
    console.log(`Return to lobby request for room: ${roomId}`);
    
    if (!rooms[roomId]) {
      console.error(`Room ${roomId} not found`);
      return;
    }
  
    // Reset room state but keep players
    rooms[roomId].gameStarted = false;
    rooms[roomId].gameOver = false;
    rooms[roomId].winner = null;
  
    // Reset all players' scores and words
    Object.values(rooms[roomId].players).forEach(player => {
      player.score = 0;
      player.foundWords = [];
    });
  
    // Get new letters
    const { letters, centerLetter, pangrams } = getRandomLetterSet();
    rooms[roomId].letters = letters;
    rooms[roomId].centerLetter = centerLetter;
    rooms[roomId].pangrams = pangrams;
  
    // Broadcast to all players in the room
    io.to(roomId).emit('returnToLobby', {
      letters,
      centerLetter,
      players: Object.values(rooms[roomId].players),
      roomId
    });
  
    console.log(`Room ${roomId} reset and returned to lobby`);
  });

  socket.on('disconnecting', () => {
    // Find which room the disconnecting player was in
    const roomId = Object.keys(socket.rooms).find(room => rooms[room]);
    if (roomId && rooms[roomId]) {
      // Remove player from room
      delete rooms[roomId].players[socket.id];
      
      // Notify remaining players
      io.to(roomId).emit('playerLeft', {
        players: Object.values(rooms[roomId].players)
      });

      // Clean up empty rooms
      if (Object.keys(rooms[roomId].players).length === 0) {
        delete rooms[roomId];
      }
    }
    // Clean up intervals when socket disconnects
    if (roomId && rooms[roomId]?.countdownInterval) {
      clearInterval(rooms[roomId].countdownInterval);
      delete rooms[roomId].countdownInterval;
    }
  });

  socket.on('disconnect', (reason) => {
    console.log(`Client disconnected: ${socket.id}, reason: ${reason}`);
    // Clean up empty rooms
    for (const roomId in rooms) {
      if (rooms[roomId].players[socket.id]) {
        delete rooms[roomId].players[socket.id];
        if (Object.keys(rooms[roomId].players).length === 0) {
          delete rooms[roomId];
        } else {
          broadcastGameState(roomId);
        }
      }
    }
  });

  socket.on('updateGameSettings', ({ roomId, settings }) => {
    if (!rooms[roomId]) return;
    
    rooms[roomId].gameSettings = {
      ...rooms[roomId].gameSettings,
      ...settings
    };
    
    // Broadcast updated game state to all players
    broadcastGameState(roomId);
  });

  function broadcastGameState(roomId) {
    if (!rooms[roomId]) {
      debug(`Cannot broadcast - Room ${roomId} not found`);
      return;
    }
    
    const gameState = {
      roomId,
      letters: rooms[roomId].letters,
      centerLetter: rooms[roomId].centerLetter,
      players: Object.values(rooms[roomId].players),
      gameStarted: rooms[roomId].gameStarted,
      gameOver: rooms[roomId].gameOver,
      winner: rooms[roomId].winner,
      countdownActive: rooms[roomId].countdownActive || false,
      gameSettings: rooms[roomId].gameSettings
    };

    debug(`Broadcasting game state for room ${roomId}:`, gameState);
    io.to(roomId).emit('gameState', gameState);
  }
});

// Add this after your route definitions
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Add a catch-all route
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});