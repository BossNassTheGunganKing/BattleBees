import React, { useState, useEffect } from 'react';

type Player = {
    id: string;
    name: string;
    score: number;
    foundWords: string[];
  };

interface GameScreenProps {
  letters: string[];
  centerLetter: string;
  players: Player[];
  currentPlayerId: string;
  onSubmitWord: (word: string) => void;
}

export const GameScreen: React.FC<GameScreenProps> = ({
  letters,
  centerLetter,
  players,
  currentPlayerId,
  onSubmitWord,
}) => {
  const [enteredWord, setEnteredWord] = useState('');
  
  // Add console.log to debug player data
  console.log('Current ID:', currentPlayerId);
  console.log('Players:', players);
  
  const currentPlayer = players.find(p => p.id === currentPlayerId);
  const otherPlayers = players.filter(p => p.id !== currentPlayerId);

  // Add more detailed null check with debug info
  if (!currentPlayer) {
    console.error('No current player found:', { currentPlayerId, players });
    return <div>Loading game...</div>;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!enteredWord.trim()) return;
    onSubmitWord(enteredWord.toUpperCase());
    setEnteredWord('');
  };

  return (
    <div className="game-screen">
      <div className="game-layout">
        <div className="other-players">
          <h2>Other Players</h2>
          {otherPlayers.map((player) => (
            <div key={player.id} className="player-score">
              <h3>{player.name}</h3>
              <p>Score: {player.score}</p>
              <p>Words: {player.foundWords.length}</p>
            </div>
          ))}
        </div>

        <div className="game-center">
          {renderHoneycomb(letters, centerLetter)}
          <form onSubmit={handleSubmit} className="word-input-form">
            <input
              type="text"
              value={enteredWord}
              onChange={(e) => setEnteredWord(e.target.value.toUpperCase())}
              placeholder="Enter word"
              className="word-input"
            />
            <button type="submit" className="submit-button">Submit</button>
          </form>
        </div>

        <div className="current-player-stats">
          <h2>My Progress</h2>
          <div className="player-score current-player">
            <h3>{currentPlayer.name}</h3>
            <p>Score: {currentPlayer.score}</p>
            <div className="found-words">
              <p>Words Found ({currentPlayer.foundWords.length}):</p>
              <ul>
                {currentPlayer.foundWords.map((word, index) => (
                  <li key={index}>{word}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const renderHoneycomb = (letters: string[], centerLetter: string) => {
  const surroundingLetters = letters.filter(l => l !== centerLetter);
  
  return (
    <div className="honeycomb">
      <div className="honeycomb-row">
        <div className="honeycomb-cell">{surroundingLetters[0]}</div>
        <div className="honeycomb-cell">{surroundingLetters[1]}</div>
      </div>
      <div className="honeycomb-row">
        <div className="honeycomb-cell">{surroundingLetters[2]}</div>
        <div className="honeycomb-cell center-letter">{centerLetter}</div>
        <div className="honeycomb-cell">{surroundingLetters[3]}</div>
      </div>
      <div className="honeycomb-row">
        <div className="honeycomb-cell">{surroundingLetters[4]}</div>
        <div className="honeycomb-cell">{surroundingLetters[5]}</div>
      </div>
    </div>
  );
};