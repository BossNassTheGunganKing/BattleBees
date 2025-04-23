import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import './App.css';
import { LobbyScreen } from './components/LobbyScreen';
import { WaitingRoom } from './components/WaitingRoom';
import { GameScreen } from './components/GameScreen';
import { VictoryScreen } from './components/VictoryScreen';

const SOCKET_URL = import.meta.env.PROD 
  ? 'https://battlebeesserver.onrender.com' 
  : 'http://localhost:4000';

const socket: Socket = io(SOCKET_URL, {
  path: '/socket.io/',
  transports: ['polling', 'websocket'], // Try polling first, then websocket
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000,
  autoConnect: true
});

// Enhanced error logging
socket.on('connect_error', (error) => {
  console.error('Connection error:', error);
  console.log('Attempting to reconnect with polling...');
  
  // If WebSocket fails, try polling
  socket.io.opts.transports = ['polling', 'websocket'];
});

// Add connection state logging
socket.on('connect', () => {
  console.log('Connected successfully via:', socket.io.engine.transport.name);
});

socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
});

type Player = {
  id: string;
  name: string;
  score: number;
  foundWords: string[];
};

type GameState = {
  letters: string[];
  centerLetter: string;
  players: Player[];
  currentPlayerId: string;
  roomId: string;
  gameOver: boolean;
  gameOverReason: string;
  errorMessage: string;
  roomExists: boolean; // Added to track room validity
  countdown?: number | null; // Added countdown to game state
  winner: {
    id: string;
    name: string;
    score: number;
    foundWords: string[];
    winReason: string;
  } | null; // Make winner explicitly nullable
};

type GameStateUpdate = {
  letters: string[];
  centerLetter: string;
  players: Player[];
  roomId: string;
};

enum GameScreenEnum {
  LOBBY,
  WAITING,
  PLAYING,
  VICTORY
}

const App: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<GameScreenEnum>(GameScreenEnum.LOBBY);
  const [game, setGame] = useState<GameState>({
    letters: [], // Empty array initially
    centerLetter: '', // Empty string initially
    players: [],
    currentPlayerId: '',
    roomId: '',
    gameOver: false,
    gameOverReason: '',
    errorMessage: '',
    roomExists: true,
    countdown: null,
    winner: null // Add winner property with initial null value
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const urlRoomId = window.location.pathname.split('/')[1];
    if (urlRoomId) {
      setGame(prev => ({ ...prev, roomId: urlRoomId }));
    }

    socket.on('connect', () => {
      console.log('Connected with ID:', socket.id);
      setGame(prev => ({ ...prev, errorMessage: '' }));
    });

    socket.on('joinConfirmed', ({ playerId, letters, centerLetter, players, roomId, roomExists }) => {
      console.log('Join confirmed with data:', { playerId, roomId, players });
      
      if (!roomExists) {
        setLoading(false);
        setGame(prev => ({
          ...prev,
          errorMessage: 'Room does not exist',
          roomExists: false
        }));
        return;
      }
      
      setGame(prev => ({
        ...prev,
        currentPlayerId: playerId,
        letters,
        centerLetter,
        players,
        roomId,
        roomExists: true,
        errorMessage: ''
      }));
      setLoading(false);
      setCurrentScreen(GameScreenEnum.WAITING);
    });

    socket.on('roomError', (message) => {
      console.error('Room error:', message);
      setLoading(false);
      setGame(prev => ({
        ...prev,
        errorMessage: message,
        roomExists: false
      }));
    });

    // Add specific handler for disconnect during room creation/joining
    socket.on('disconnect', (reason) => {
      console.log('Disconnected:', reason);
      if (loading) {
        setLoading(false);
        setGame(prev => ({
          ...prev,
          errorMessage: 'Connection lost while creating/joining room'
        }));
      }
    });

    socket.on('gameState', (state) => {
      setGame(prev => ({
        ...prev,
        ...state,
        errorMessage: '',
        roomExists: true
      }));
    });

    socket.on('connect_error', (err) => {
      setGame(prev => ({
        ...prev,
        errorMessage: 'Connection failed. Trying to reconnect...'
      }));
      setLoading(false);  // Add this line to clear loading state on connection error
    });

    socket.on('playerJoined', ({ players }) => {
      setGame(prev => ({
        ...prev,
        players
      }));
    });

    socket.on('playerLeft', ({ players }) => {
      setGame(prev => ({
        ...prev,
        players
      }));
    });

    socket.on('countdownStarted', ({ countdown }) => {
      setGame(prev => ({ ...prev, countdown }));
    });

    socket.on('countdownUpdate', ({ countdown }) => {
      setGame(prev => ({ ...prev, countdown }));
    });

    socket.on('countdownCancelled', () => {
      setGame(prev => ({ ...prev, countdown: null }));
    });

    socket.on('gameStarted', () => {
      setCurrentScreen(GameScreenEnum.PLAYING);
    });

    socket.on('gameOver', ({ winner }) => {
      console.log('Game Over!', winner);
      setGame(prev => ({
        ...prev,
        gameOver: true,
        winner
      }));
      setCurrentScreen(GameScreenEnum.VICTORY);
    });

    socket.on('returnToLobby', (gameState: GameStateUpdate) => {
      console.log('Returning to lobby with state:', gameState);
      setGame(prev => ({
        ...prev,
        letters: gameState.letters,
        centerLetter: gameState.centerLetter,
        players: gameState.players,
        roomId: gameState.roomId, // Add this to ensure roomId is preserved
        gameOver: false,
        winner: null as GameState['winner'], // Explicitly type the null assignment
        roomExists: true,
        errorMessage: '', // Reset any error messages
        countdown: null, // Reset countdown state
        gameOverReason: '' // Reset game over reason as well
      }));
      setCurrentScreen(GameScreenEnum.WAITING);
    });

    socket.on('error', (error) => {
      console.error('Socket error:', error);
      setLoading(false);  // Clear loading state on any socket error
    });

    socket.on('wordError', ({ message }) => {
      // Pass the error to the GameScreen component
      setGame(prev => ({
        ...prev,
        errorMessage: message
      }));
    });

    return () => {
      socket.off('connect');
      socket.off('joinConfirmed');
      socket.off('roomError');
      socket.off('gameState');
      socket.off('connect_error');
      socket.off('playerJoined');
      socket.off('playerLeft');
      socket.off('countdownStarted');
      socket.off('countdownUpdate');
      socket.off('countdownCancelled');
      socket.off('gameStarted');
      socket.off('gameOver');
      socket.off('returnToLobby');
      socket.off('error');
      socket.off('wordError');
    };
  }, [loading]);

  const generateRoomId = () => {
    return Math.random().toString(36).substring(2, 7).toUpperCase();
  };

  const handleCreateRoom = (playerName: string) => {
    const newRoomId = generateRoomId();
    console.log('Creating room with ID:', newRoomId);
    
    setLoading(true);
    socket.emit('createRoom', { 
      roomId: newRoomId, 
      playerName 
    });
  };

  const handleJoinRoom = (roomId: string, playerName: string) => {
    console.log('Attempting to join room:', roomId); // Debug log
    socket.emit('joinRoom', 
      { 
        roomId, 
        playerName
        // Remove letters and centerLetter from here
      }
    );
  };

  const handleSubmit = (word: string) => {
    if (!game.roomId || !word.trim()) return;
    
    console.log('Submitting word:', {
      roomId: game.roomId,
      word,
      playerId: socket.id
    });
  
    socket.emit('submitWord', {
      roomId: game.roomId,
      word: word.trim()
    });
  };

  const handleStartGame = () => {
    socket.emit('startGame', { roomId: game.roomId });
    setCurrentScreen(GameScreenEnum.PLAYING);
  };

  const handleReturnToLobby = () => {
    if (!game.roomId) {
      console.error('No room ID found');
      return;
    }
    
    console.log('Requesting return to lobby for room:', game.roomId);
    socket.emit('returnToLobby', { 
      roomId: game.roomId 
    });
  };

  if (loading) {
    return (
      <div className="app-container">
        <div className="loading-screen">
          <h2>Creating room...</h2>
        </div>
      </div>
    );
  }

  if (!game.roomExists) {
    return (
      <div className="app-container">
        <div className="room-error-screen">
          <h1>Room Not Found</h1>
          <p className="error-message">{game.errorMessage || 'The requested room does not exist'}</p>
          <div className="action-buttons">
            <button onClick={() => handleCreateRoom('DefaultPlayerName')} className="action-button">
              Create New Room
            </button>
            <button onClick={() => window.location.reload()} className="action-button">
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // if (game.gameOver) {
  //   return (
  //     <div className="app-container">
  //       <div className="game-over-screen">
  //         <h1>Game Over!</h1>
  //         <p className="game-over-reason">{game.gameOverReason}</p>
  //         <div className="final-scores">
  //           <h2>Final Scores</h2>
  //           {game.players.map((player) => (
  //             <div key={player.id} className={`final-score ${player.id === game.currentPlayerId ? 'your-score' : ''}`}>
  //               {player.name}: {player.score} points
  //             </div>
  //           ))}
  //         </div>
  //         <button onClick={restartGame} className="play-again-button">
  //           Play Again
  //         </button>
  //       </div>
  //     </div>
  //   );
  // }

  return (
    <div className="app-container">
      {currentScreen === GameScreenEnum.LOBBY && (
        <LobbyScreen
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
          errorMessage={game.errorMessage}
        />
      )}
      {currentScreen === GameScreenEnum.WAITING && (
        <WaitingRoom
          roomId={game.roomId}
          players={game.players}
          onStartGame={handleStartGame}
          socket={socket}
        />
      )}
      {currentScreen === GameScreenEnum.PLAYING && (
        <GameScreen
          letters={game.letters}
          centerLetter={game.centerLetter}
          players={game.players}
          currentPlayerId={game.currentPlayerId}
          onSubmitWord={handleSubmit}
          serverError={game.errorMessage} // Add this prop
        />
      )}
      {currentScreen === GameScreenEnum.VICTORY && game.winner && (
        <VictoryScreen
          winner={game.winner}
          onReturnToLobby={handleReturnToLobby}
          roomId={game.roomId}
        />
      )}
    </div>
  );
};

export default App;