import React from 'react';
import VideoBackground from './components/VideoBackground';
import Navbar from './components/Navbar';
import HeroBadge from './components/HeroBadge';
import UserList from './components/UserList';

function App() {
  return (
    <div className="hero-wrapper">
      <VideoBackground src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260329_050842_be71947f-f16e-4a14-810c-06e83d23ddb5.mp4" />
      
      <div className="hero-overlay">
        <div className="content-container">
          <Navbar />
          
          <main className="hero-content">
            <HeroBadge />
            
            <h1 className="hero-title">DevOps Depzainhatvutri Data Platform</h1>
            
            <p className="hero-subtitle">
              Manage your cloud assets in real-time. Simply fill out the form to easily manage your data directly onto the platform.
            </p>

            <UserList />
          </main>
        </div>
      </div>
    </div>
  );
}

export default App;
