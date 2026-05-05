import React, { useEffect, useRef } from 'react';

const VideoBackground = ({ src }) => {
  const videoRef = useRef(null);
  const fadingOutRef = useRef(false);
  const animationFrameRef = useRef(null);

  const performFade = (targetOpacity, durationMs, callback) => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    if (!videoRef.current) return;
    
    const startOpacity = parseFloat(videoRef.current.style.opacity || '1');
    const startTime = performance.now();
    
    const fade = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      
      const currentOpacity = startOpacity + (targetOpacity - startOpacity) * progress;
      if (videoRef.current) {
        videoRef.current.style.opacity = currentOpacity.toString();
      }
      
      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(fade);
      } else if (callback) {
        callback();
      }
    };
    
    animationFrameRef.current = requestAnimationFrame(fade);
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Set initial opacity to 0 for fade in
    video.style.opacity = '0';

    const handleLoadedData = () => {
      // 250ms fade-in on load
      performFade(1, 250);
    };

    const handleTimeUpdate = () => {
      if (!video.duration) return;
      
      // Calculate remaining time
      const remainingTime = video.duration - video.currentTime;
      
      // 250ms fade-out when 0.55 seconds remain
      if (remainingTime <= 0.55 && !fadingOutRef.current) {
        fadingOutRef.current = true;
        performFade(0, 250);
      }
    };

    const handleEnded = () => {
      // On ended: opacity set to 0, 100ms delay, reset to currentTime = 0, play, fade back in
      if (videoRef.current) {
        videoRef.current.style.opacity = '0';
      }
      
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.currentTime = 0;
          videoRef.current.play().then(() => {
            fadingOutRef.current = false;
            performFade(1, 250);
          }).catch(err => console.error("Play prevented", err));
        }
      }, 100);
    };

    video.addEventListener('loadeddata', handleLoadedData);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('ended', handleEnded);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return (
    <video
      ref={videoRef}
      className="video-bg"
      src={src}
      autoPlay
      muted
      playsInline
    />
  );
};

export default VideoBackground;
