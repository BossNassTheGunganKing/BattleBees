import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import './App.css';
import { LobbyScreen } from './components/LobbyScreen';
import { WaitingRoom } from './components/WaitingRoom';
import { GameScreen } from './components/GameScreen';
import { VictoryScreen } from './components/VictoryScreen';

const socket: Socket = io('http://localhost:4000', {
  reconnectionAttempts: 3,
  reconnectionDelay: 1000,
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
      if (!roomExists) {
        setGame(prev => ({
          ...prev,
          errorMessage: 'Room does not exist',
          roomExists: false
        }));
        return;
      }
      
      console.log('Join confirmed:', { playerId, roomId, players });
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
      setGame(prev => ({
        ...prev,
        errorMessage: message,
        roomExists: false
      }));
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
    };
  }, []);

  const generateRoomId = () => {
    return Math.random().toString(36).substring(2, 7).toUpperCase();
  };

  const handleCreateRoom = (playerName: string) => {
    const newRoomId = generateRoomId();
    console.log('Creating room with ID:', newRoomId);

    // Only emit the create room event and wait for server confirmation
    socket.emit('createRoom', { 
      roomId: newRoomId,
      playerName
    });

    // Don't set game state here - wait for 'joinConfirmed' event
    setLoading(true);
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
        />
      )}
      {currentScreen === GameScreenEnum.PLAYING && (
        <GameScreen
          letters={game.letters}
          centerLetter={game.centerLetter}
          players={game.players}
          currentPlayerId={game.currentPlayerId}
          onSubmitWord={handleSubmit}
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