import React from 'react';
import { SparkleIcon, UpArrowIcon, AttachIcon, MicIcon, SearchIcon } from './Icons';

const SearchInput = ({ name, setName, handleSend }) => {
  return (
    <div className="search-container">
      <div className="search-top-row">
        <div className="credits-info">
          60/450 credits
          <button className="btn-upgrade">Upgrade</button>
        </div>
        <div className="ai-info">
          <SparkleIcon size={14} />
          Powered by GPT-4o
        </div>
      </div>

      <div className="search-input-area">
        <input 
          type="text" 
          className="search-input" 
          placeholder="Enter your name..." 
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
        />
        <button className="btn-submit" onClick={handleSend}>
          <UpArrowIcon size={20} />
        </button>
      </div>

      <div className="search-bottom-row">
        <div className="action-buttons">
          <button className="action-btn">
            <AttachIcon size={14} />
            Attach
          </button>
          <button className="action-btn">
            <MicIcon size={14} />
            Voice
          </button>
          <button className="action-btn">
            <SearchIcon size={14} />
            Prompts
          </button>
        </div>
        <div className="char-counter">
          0/3,000
        </div>
      </div>
    </div>
  );
};

export default SearchInput;
