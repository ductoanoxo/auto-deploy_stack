import React from 'react';
import { ChevronDownIcon } from './Icons';

const Navbar = () => {
  return (
    <nav className="navbar">
      <div className="nav-logo">Logoipsum</div>
      
      <div className="nav-links">
        <a href="#" className="nav-item">Platform</a>
        <a href="#" className="nav-item">
          Features <ChevronDownIcon size={16} />
        </a>
        <a href="#" className="nav-item">Projects</a>
        <a href="#" className="nav-item">Community</a>
        <a href="#" className="nav-item">Contact</a>
      </div>
      
      <div className="nav-actions">
        <button className="btn btn-signup">Sign Up</button>
        <button className="btn btn-login">Log In</button>
      </div>
    </nav>
  );
};

export default Navbar;
