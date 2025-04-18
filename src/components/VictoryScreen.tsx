import React from 'react';

interface Winner {
  id: string;
  name: string;
  score: number;
  foundWords: string[];
  winReason: string;
}

interface VictoryScreenProps {
  winner: Winner;
  onReturnToLobby: () => void;
  roomId: string;  // Add roomId prop
}

export const VictoryScreen: React.FC<VictoryScreenProps> = ({ 
  winner, 
  onReturnToLobby,
  roomId 
}) => {
  return (
    <div className="victory-screen">
      <h1>Game Over!</h1>
      <div className="winner-info">
        <h2>{winner.name} Wins!</h2>
        <p className="win-reason">{winner.winReason}</p>
        <div className="stats">
          <p>Final Score: {winner.score}</p>
          <p>Words Found: {winner.foundWords.length}</p>
        </div>
        <div className="words-list">
          <h3>Winning Words:</h3>
          <ul>
            {winner.foundWords.map((word, index) => (
              <li key={index}>{word}</li>
            ))}
          </ul>
        </div>
      </div>
      <div className="room-info">
        <p>Room Code: {roomId}</p>
      </div>
      <button onClick={onReturnToLobby} className="return-button">
        Return to Lobby
      </button>
    </div>
  );
};