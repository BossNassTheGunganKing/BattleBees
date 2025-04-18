import React, { useState, useEffect } from 'react';
import '../App.css';

interface LobbyScreenProps {
  onCreateRoom: (playerName: string) => void;
  onJoinRoom: (roomId: string, playerName: string) => void;
  errorMessage?: string;
}

export const LobbyScreen: React.FC<LobbyScreenProps> = ({ 
  onCreateRoom, 
  onJoinRoom,
  errorMessage 
}) => {
  const [playerName, setPlayerName] = useState('');
  const [roomId, setRoomId] = useState('');

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim() || !roomId.trim()) return;
    console.log('Joining room:', roomId, 'as:', playerName); // Debug log
    onJoinRoom(roomId.toUpperCase(), playerName);
  };

  const handleCreate = () => {
    if (!playerName.trim()) return;
    onCreateRoom(playerName);
  };

  const isNameValid = playerName.trim().length > 0;

  return (
    <div className="username-screen">
      <div className="username-container">
        <h1 className="welcome-title">Battle Bees Multiplayer</h1>
        {errorMessage && (
          <div className="error-message">
            <p>{errorMessage}</p>
          </div>
        )}
        <div className="input-group">
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Enter your name"
            maxLength={20}
            className="username-input"
          />
          <input
            type="text"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            placeholder="Room ID (optional)"
            className="username-input"
          />
          <button 
            onClick={handleJoin} 
            className="join-button"
            disabled={!isNameValid}
          >
            Join Game
          </button>
          <button 
            onClick={handleCreate} 
            className="join-button"
            disabled={!isNameValid}
          >
            Create New Game
          </button>
        </div>
        <div className="game-description">
          <p>Create words using the letters in the honeycomb</p>
          <p>Each word must use the center letter</p>
          <p>Minimum 4 letters per word</p>
        </div>
      </div>
    </div>
  );
};