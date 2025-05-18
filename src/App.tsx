import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { AdminPage } from "./pages/adminPage";
import { GamePage } from "./pages/gamePage";
import "./config/flow-config";
import gameAudio from "./assets/gmaudio.mp3";
import { useEffect, useRef } from "react";

function App() {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    // Try to play audio when component mounts
    if (audioRef.current) {
      audioRef.current.volume = 0.5; // Set volume to 50%
      const playPromise = audioRef.current.play();
      
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.log("Autoplay prevented:", error);
        });
      }
    }
  }, []);

  return (
    <Router>
      <audio 
        ref={audioRef}
        src={gameAudio} 
        loop 
        controls
        className="fixed bottom-4 right-4 z-50 bg-white/10 backdrop-blur-sm rounded-lg p-2 w-[calc(100%-2rem)] sm:w-auto max-w-[300px] shadow-lg border border-white/20"
      />
      <Routes>
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/" element={<GamePage />} />
      </Routes>
    </Router>
  );
}

export default App;