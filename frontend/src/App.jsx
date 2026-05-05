import React, { useState } from 'react';
import VideoBackground from './components/VideoBackground';
import Navbar from './components/Navbar';
import HeroBadge from './components/HeroBadge';
import SearchInput from './components/SearchInput';

function App() {
  const [name, setName] = useState('');
  const [response, setResponse] = useState(null);
  const [error, setError] = useState(null);

  const handleSend = async () => {
    setResponse(null);
    setError(null);
    if (!name.trim()) return;

    try {
      const res = await fetch('http://localhost:8000/api/hello', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      const data = await res.json();
      setResponse(data);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="hero-wrapper">
      <VideoBackground src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260329_050842_be71947f-f16e-4a14-810c-06e83d23ddb5.mp4" />
      
      <div className="hero-overlay">
        <div className="content-container">
          <Navbar />
          
          <main className="hero-content">
            <HeroBadge />
            
            <h1 className="hero-title">Greeting App</h1>
            
            <p className="hero-subtitle">
              Enter your name below to receive a personalized greeting from our FastAPI backend. Experience seamless integration.
            </p>
            
            <SearchInput 
              name={name}
              setName={setName}
              handleSend={handleSend}
            />

            {(response || error) && (
              <div className="response-container">
                {error && <div className="error-text">Error: {error}</div>}
                {response && (
                  <>
                    <p className="response-message"><strong>Message:</strong> {response.message}</p>
                    <p className="response-time"><small>Time: {response.timestamp}</small></p>
                  </>
                )}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

export default App;
