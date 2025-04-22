import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import './WaitingRoom.css'; // Import your CSS file for styling
import '../App.css';

const SOCKET_URL = import.meta.env.PROD 
  ? 'wss://battlebeesserver.onrender.com' 
  : 'ws://localhost:4000';

const socket: Socket = io(SOCKET_URL, {
  path: '/socket.io/',
  transports: ['websocket'], // Try websocket only first
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000,
  autoConnect: true,
  forceNew: true,
  withCredentials: true
});

const COUNTDOWN = 3; // seconds

type Player = {
    id: string;
    name: string;
    score: number;
    foundWords: string[];
};

interface WaitingRoomProps {
  roomId: string;
  players: Player[];
  onStartGame: () => void;
}

export const WaitingRoom: React.FC<WaitingRoomProps> = ({ roomId, players, onStartGame }) => {
  const [countdown, setCountdown] = useState<number | null>(null);

  const startCountdown = () => {
    console.log('Requesting countdown start'); // Debug log
    socket.emit('startCountdown', { roomId });
  };

  const cancelCountdown = () => {
    console.log('Requesting countdown cancel'); // Debug log
    socket.emit('cancelCountdown', { roomId });
  };

  useEffect(() => {
    const handleCountdownUpdate = ({ timeLeft }: { timeLeft: number }) => {
      console.log('Countdown update received:', timeLeft); // Debug log
      setCountdown(timeLeft);
    };

    const handleCountdownCancel = () => {
      console.log('Countdown cancelled'); // Debug log
      setCountdown(null);
    };

    const handleGameStart = () => {
      console.log('Game started'); // Debug log
      setCountdown(null);
      onStartGame();
    };

    // Add socket listeners
    socket.on('countdownUpdate', handleCountdownUpdate);
    socket.on('countdownCancelled', handleCountdownCancel);
    socket.on('gameStarted', handleGameStart);

    // Cleanup listeners
    return () => {
      socket.off('countdownUpdate', handleCountdownUpdate);
      socket.off('countdownCancelled', handleCountdownCancel);
      socket.off('gameStarted', handleGameStart);
    };
  }, [onStartGame, roomId]);

  return (
    <div className="waiting-room">
      <div className="room-info">
        <div className="room-id-container">
          <h2>Room Code:</h2>
          <div className="room-id">{roomId}</div>
          <p className="room-id-helper">Share this code with other players</p>
        </div>

        {/* New countdown display section */}
        {countdown !== null && (
          <div className="countdown-container">
            <div className="countdown-display">
              <h2>Game Starting In</h2>
              <div className="countdown-number">{countdown}</div>
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
        onClick={countdown === null ? startCountdown : cancelCountdown}
        disabled={players.length < 2}
        className={countdown === null ? "start-game-button" : "cancel-button"}
      >
        {countdown === null ? "Start Game" : "Cancel Countdown"}
      </button>
    </div>
  );
};