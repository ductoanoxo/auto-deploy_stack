import React, { useState } from 'react';
import VideoBackground from './components/VideoBackground';
import Navbar from './components/Navbar';
import HeroBadge from './components/HeroBadge';
import SearchInput from './components/SearchInput';
import StatusCard from './components/StatusCard';

function App() {
  const [name, setName] = useState('');
  const [response, setResponse] = useState(null);
  const [statusData, setStatusData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    setResponse(null);
    setStatusData(null);
    setError(null);
    if (!name.trim()) return;

    setLoading(true);

    try {
      // ChatOps: detect /status command
      if (name.trim() === '/status') {
        const res = await fetch('http://localhost:8000/api/status');
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        const data = await res.json();
        setStatusData(data);
      } else {
        // Default: greeting
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
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
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
            
            <h1 className="hero-title">DevOps ChatOps</h1>
            
            <p className="hero-subtitle">
              Enter your name for a greeting, or type <strong>/status</strong> to check server & Docker container status in real-time.
            </p>
            
            <SearchInput 
              name={name}
              setName={setName}
              handleSend={handleSend}
            />

            {loading && (
              <div className="response-container">
                <div className="loading-text">
                  <span className="loading-spinner"></span>
                  Đang truy vấn hệ thống...
                </div>
              </div>
            )}

            {error && (
              <div className="response-container">
                <div className="error-text">Error: {error}</div>
              </div>
            )}

            {response && (
              <div className="response-container">
                <p className="response-message"><strong>Message:</strong> {response.message}</p>
                <p className="response-time"><small>Time: {response.timestamp}</small></p>
              </div>
            )}

            {statusData && <StatusCard data={statusData} />}
          </main>
        </div>
      </div>
    </div>
  );
}

export default App;
