import React, { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import './WaitingRoom.css';
import '../App.css';

const COUNTDOWN = 3; // seconds

type Player = {
    id: string;
    name: string;
    score: number;
    foundWords: string[];
};

interface GameSettings {
  pointsToWin: number;
  isPanagramInstantWin: boolean;
  totalWordsToWin: number;
}

interface WaitingRoomProps {
  roomId: string;
  players: Player[];
  onStartGame: () => void;
  socket: Socket;
  gameSettings?: GameSettings;
}

export const WaitingRoom: React.FC<WaitingRoomProps> = ({ 
  roomId, 
  players, 
  onStartGame,
  socket,
  gameSettings: initialGameSettings
}) => {
  const [countdown, setCountdown] = useState<number | null>(null);
  const [showCopied, setShowCopied] = useState(false);
  const [gameSettings, setGameSettings] = useState<GameSettings>(initialGameSettings || {
    pointsToWin: 30,
    isPanagramInstantWin: true,
    totalWordsToWin: 10
  });

  useEffect(() => {
    const handleCountdownUpdate = ({ timeLeft }: { timeLeft: number }) => {
      console.log('Countdown update received:', timeLeft);
      setCountdown(timeLeft);
    };

    const handleCountdownCancel = () => {
      console.log('Countdown cancelled');
      setCountdown(null);
    };

    const handleGameStart = () => {
      console.log('Game started');
      setCountdown(null);
      onStartGame();
    };

    const handleGameSettingsUpdate = (settings: GameSettings) => {
      console.log('Game settings updated:', settings);
      setGameSettings(settings);
    };

    const handleGameState = (state: any) => {
      if (state.gameSettings) {
        console.log('Game settings received from state:', state.gameSettings);
        setGameSettings(state.gameSettings);
      }
    };

    socket.on('countdownUpdate', handleCountdownUpdate);
    socket.on('countdownCancelled', handleCountdownCancel);
    socket.on('gameStarted', handleGameStart);
    socket.on('gameSettingsUpdate', handleGameSettingsUpdate);
    socket.on('gameState', handleGameState);

    return () => {
      socket.off('countdownUpdate', handleCountdownUpdate);
      socket.off('countdownCancelled', handleCountdownCancel);
      socket.off('gameStarted', handleGameStart);
      socket.off('gameSettingsUpdate', handleGameSettingsUpdate);
      socket.off('gameState', handleGameState);
    };
  }, [onStartGame, socket]);

  const startCountdown = () => {
    console.log('Requesting countdown start for room:', roomId);
    socket.emit('startCountdown', { roomId });
  };

  const cancelCountdown = () => {
    console.log('Requesting countdown cancel for room:', roomId);
    socket.emit('cancelCountdown', { roomId });
  };

  const updateGameSettings = (updates: Partial<GameSettings>) => {
    const newSettings = { ...gameSettings, ...updates };
    setGameSettings(newSettings);
    socket.emit('updateGameSettings', { 
      roomId, 
      settings: newSettings 
    });
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomId).then(() => {
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2000); // Hide after 2 seconds
    });
  };

  return (
    <div className="waiting-room">
      <div className="room-info">
        <div className="room-id-container">
          <h2>Room Code:</h2>
          <div 
            className="room-id" 
            onClick={copyRoomCode}
            style={{ cursor: 'pointer' }}
          >
            {roomId}
            {showCopied && <div className="copied-notification">Copied!</div>}
          </div>
          <p className="room-id-helper">Click the code to copy to clipboard</p>
        </div>

        <div className="game-settings">
          <h3>Game Settings</h3>
          <div className="setting-item">
            <label>Points to Win: {gameSettings.pointsToWin}</label>
            <input 
              type="range" 
              min="10" 
              max="50" 
              value={gameSettings.pointsToWin}
              onChange={(e) => updateGameSettings({ pointsToWin: parseInt(e.target.value) })}
            />
            <input 
              type="number" 
              min="10" 
              max="50" 
              value={gameSettings.pointsToWin}
              onChange={(e) => updateGameSettings({ pointsToWin: parseInt(e.target.value) })}
            />
          </div>

          <div className="setting-item">
            <label>
              <input 
                type="checkbox" 
                checked={gameSettings.isPanagramInstantWin}
                onChange={(e) => updateGameSettings({ isPanagramInstantWin: e.target.checked })}
              />
              Panagram Instant Win
            </label>
          </div>

          <div className="setting-item">
            <label>Words to Win: {gameSettings.totalWordsToWin}</label>
            <input 
              type="range" 
              min="5" 
              max="20" 
              value={gameSettings.totalWordsToWin}
              onChange={(e) => updateGameSettings({ totalWordsToWin: parseInt(e.target.value) })}
            />
            <input 
              type="number" 
              min="5" 
              max="20" 
              value={gameSettings.totalWordsToWin}
              onChange={(e) => updateGameSettings({ totalWordsToWin: parseInt(e.target.value) })}
            />
          </div>
        </div>

        {countdown !== null && (
          <div className="countdown-overlay">
            <div className="countdown-modal">
              <h2>Game Starting In</h2>
              <div className="countdown-number">{countdown}</div>
              <button 
                onClick={cancelCountdown}
                className="cancel-button"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="players-container">
          <h3>Players ({players.length}/4):</h3>
          <ul className="players-list">
            {players.map((player) => (
              <li key={player.id} className="player-item">
                {player.name}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <button 
        onClick={startCountdown}
        disabled={players.length < 2 || countdown !== null}
        className="start-game-button"
      >
        Start Game
      </button>
    </div>
  );
};