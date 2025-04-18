const express = require('express');
const socketIo = require('socket.io');
const cors = require('cors');
const axios = require('axios'); // Add axios for API calls
const fs = require('fs');
const path = require('path');
const csv = require('csv-parse/sync');
const debug = require('debug')('battlebees:server');

const app = express();
const PORT = process.env.PORT || 4000;

// Update CORS configuration for Express
app.use(cors({
  origin: [
    "http://localhost:5173",
    "https://battlebees.onrender.com",
    "https://battlebees.onrender.com/"
  ],
  methods: ["GET", "POST"],
  credentials: true
}));

// Add after the CORS configuration
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
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

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Update Socket.IO CORS configuration
const io = socketIo(server, {
  cors: {
    origin: [
      "http://localhost:5173",
      "https://battlebees.onrender.com",
      "https://battlebees.onrender.com/"
    ],
    methods: ["GET", "POST"],
    credentials: true,
    allowedHeaders: ["my-custom-header"]
  },
  // Add transport options for better connection handling
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000,
  // Add these options for better debugging
  connectTimeout: 45000,
  debug: true
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
      columns: true,
      skip_empty_lines: true
    });

    // Select random row from CSV
    const randomRow = records[Math.floor(Math.random() * records.length)];
    
    // Ensure we get exactly 7 letters
    const letters = Array.from(randomRow.letters).filter(char => 
      char.match(/[A-Z]/)
    ).slice(0, 7);

    // Validate letter count
    if (letters.length !== 7) {
      console.error('Invalid letter count in CSV row:', randomRow);
      throw new Error('Invalid letter count');
    }

    // Validate center letter is in the set
    if (!letters.includes(randomRow.centerLetter)) {
      console.error('Center letter not in letter set:', randomRow);
      throw new Error('Invalid center letter');
    }

    return {
      letters,
      centerLetter: randomRow.centerLetter
    };
  } catch (error) {
    console.error('Error reading game letters:', error);
    // Fallback in case of file error
    return {
      letters: ['B', 'F', 'D', 'O', 'L', 'I', 'E'],
      centerLetter: 'B'
    };
  }
}

io.on('connection', (socket) => {
  debug(`Client connected: ${socket.id}`);

  // Add connection event logging
  socket.onAny((eventName, ...args) => {
    debug(`Event received - ${eventName}:`, args);
  });

  socket.on('createRoom', ({ roomId, playerName }) => {
    console.log(`Creating room: ${roomId} for player: ${playerName}`);

    const { letters, centerLetter } = getRandomLetterSet();
    rooms[roomId] = {
      roomId,
      letters,
      centerLetter,
      players: {},
      gameStarted: false
    };

    // Add the creating player to the room
    rooms[roomId].players[socket.id] = {
      id: socket.id,
      name: playerName,
      score: 0,
      foundWords: []
    };

    socket.join(roomId);

    // Send confirmation with room details
    socket.emit('joinConfirmed', {
      playerId: socket.id,
      roomId,
      letters: rooms[roomId].letters,
      centerLetter: rooms[roomId].centerLetter,
      players: Object.values(rooms[roomId].players)
    });

    // Broadcast initial room state
    broadcastGameState(roomId);
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
  
    // Check if word contains center letter
    if (!word.toUpperCase().includes(room.centerLetter)) {
      socket.emit('wordError', { message: 'Word must contain center letter!' });
      return;
    }
  
    // Check if word was already found by this player
    if (player.foundWords.includes(word.toUpperCase())) {
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
    const isPangram = new Set(word.toLowerCase().split('')).size === room.letters.length;
    const wordScore = calculateScore(word.length) + (isPangram ? 7 : 0);
  
    // Update player's score and found words
    player.score += wordScore;
    player.foundWords.push(word.toUpperCase());

    console.log('Checking win conditions:', {
      wordCount: player.foundWords.length,
      score: player.score,
      isPangram
    });

    // Check win conditions with explicit comparisons
    const hasWon = (
      player.foundWords.length >= 10 || 
      player.score >= 30 || 
      isPangram === true
    );

    if (hasWon) {
      console.log('Game won!', {
        player: player.name,
        reason: isPangram ? 'pangram' : 
                player.foundWords.length >= 10 ? 'words' : 'score'
      });

      rooms[roomId].gameOver = true;
      rooms[roomId].winner = {
        id: player.id,
        name: player.name,
        score: player.score,
        foundWords: player.foundWords,
        winReason: isPangram ? 'Found a pangram!' : 
                   player.foundWords.length >= 10 ? 'Found 10 words!' :
                   'Reached 30 points!'
      };

      // Notify all players of game end
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
    const { letters, centerLetter } = getRandomLetterSet();
    rooms[roomId].letters = letters;
    rooms[roomId].centerLetter = centerLetter;
  
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

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
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
      countdownActive: rooms[roomId].countdownActive || false
    };

    debug(`Broadcasting game state for room ${roomId}:`, gameState);
    io.to(roomId).emit('gameState', gameState);
  }
});