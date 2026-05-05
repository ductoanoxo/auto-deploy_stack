import React from 'react';
import { StarIcon } from './Icons';

const HeroBadge = () => {
  return (
    <div className="hero-badge">
      <div className="badge-dark">
        <StarIcon size={14} />
        New
      </div>
      <span className="badge-text">Discover what's possible</span>
    </div>
  );
};

export default HeroBadge;
