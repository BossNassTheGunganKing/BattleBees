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
  serverError?: string;
}

export const GameScreen: React.FC<GameScreenProps> = ({
  letters,
  centerLetter,
  players,
  currentPlayerId,
  onSubmitWord,
  serverError
}) => {
  const [enteredWord, setEnteredWord] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isShaking, setIsShaking] = useState(false);
  
  const currentPlayer = players.find(p => p.id === currentPlayerId);
  const otherPlayers = players.filter(p => p.id !== currentPlayerId);

  if (!currentPlayer) {
    console.error('No current player found:', { currentPlayerId, players });
    return <div>Loading game...</div>;
  }

  // Handle server errors
  useEffect(() => {
    if (serverError) {
      showError(serverError);
    }
  }, [serverError]);

  const showError = (message: string) => {
    setErrorMessage(message);
    setIsShaking(true);
    setTimeout(() => {
      setIsShaking(false);
      setTimeout(() => setErrorMessage(''), 1000); // Clear error after shake
    }, 500);
  };

  const validateWord = (word: string): string | null => {
    if (word.length < 4) {
      return 'Word must be at least 4 letters long';
    }
    
    // Check if word uses valid letters
    const letterSet = new Set(letters);
    const invalidLetters = Array.from(word).filter(letter => !letterSet.has(letter));
    if (invalidLetters.length > 0) {
      return `Invalid letters used: ${invalidLetters.join(', ')}`;
    }

    // Check if word uses center letter
    if (!word.includes(centerLetter)) {
      return 'Word must use the center letter';
    }

    return null;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const word = enteredWord.trim().toUpperCase();
    if (!word) return;

    const error = validateWord(word);
    if (error) {
      showError(error);
      return;
    }

    onSubmitWord(word);
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
              className={`word-input ${isShaking ? 'shake' : ''}`}
            />
            <button type="submit" className="submit-button">Submit</button>
            <div className={`error-message ${errorMessage ? 'visible' : ''}`}>
              {errorMessage}
            </div>
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