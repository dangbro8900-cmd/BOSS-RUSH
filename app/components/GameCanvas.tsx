'use client';

import { useEffect, useRef, useState } from 'react';
import { GameEngine } from '../game/engine';
import { Settings, X, Maximize } from 'lucide-react';

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  
  const [showSettings, setShowSettings] = useState(false);
  const [volume, setVolume] = useState(60);
  const [resolution, setResolution] = useState('1200x800');
  const [screenShake, setScreenShake] = useState(true);

  useEffect(() => {
    if (!canvasRef.current) return;

    const engine = new GameEngine(canvasRef.current);
    engineRef.current = engine;
    
    // Apply initial settings
    engine.setVolume(volume / 100);
    const [w, h] = resolution.split('x').map(Number);
    engine.setResolution(w, h);
    
    engine.running = true;
    engine.lastTime = performance.now();
    requestAnimationFrame(engine.loop);

    return () => {
      engine.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.paused = showSettings;
      engineRef.current.screenShakeEnabled = screenShake;
      if (canvasRef.current) {
        canvasRef.current.style.cursor = showSettings ? 'auto' : 'none';
      }
    }
  }, [showSettings, screenShake]);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value);
    setVolume(val);
    if (engineRef.current) {
      engineRef.current.setVolume(val / 100);
    }
  };

  const handleResolutionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setResolution(val);
    if (engineRef.current) {
      const [w, h] = val.split('x').map(Number);
      engineRef.current.setResolution(w, h);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement && containerRef.current) {
      containerRef.current.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  return (
    <div ref={containerRef} className="relative flex items-center justify-center w-full h-full bg-black overflow-hidden group">
      <canvas
        ref={canvasRef}
        className="max-w-full max-h-full object-contain shadow-2xl shadow-red-900/20 z-10"
        style={{ aspectRatio: resolution.replace('x', ' / ') }}
      />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%] z-30 opacity-40"></div>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_50%,rgba(0,0,0,0.8)_100%)] z-20"></div>
      
      {/* Settings Button */}
      <button 
        onClick={() => setShowSettings(true)}
        className="absolute top-4 right-4 z-50 p-2 bg-black/50 border border-cyan-500/30 text-cyan-500 rounded hover:bg-cyan-900/50 hover:text-cyan-300 transition-colors opacity-0 group-hover:opacity-100"
      >
        <Settings size={24} />
      </button>

      {/* Settings Modal */}
      {showSettings && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-gray-900 border border-cyan-500/50 p-6 rounded-lg w-80 shadow-[0_0_30px_rgba(0,255,255,0.2)]">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-cyan-400 font-mono">SYSTEM SETTINGS</h2>
              <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-cyan-300 mb-2 font-mono">
                  AUDIO VOLUME: {volume}%
                </label>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={volume} 
                  onChange={handleVolumeChange}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-cyan-300 mb-2 font-mono">
                  INTERNAL RESOLUTION
                </label>
                <select 
                  value={resolution}
                  onChange={handleResolutionChange}
                  className="w-full bg-gray-800 border border-gray-600 text-white rounded p-2 font-mono focus:border-cyan-500 focus:outline-none"
                >
                  <option value="800x600">800 x 600 (Performance)</option>
                  <option value="1200x800">1200 x 800 (Default)</option>
                  <option value="1600x900">1600 x 900 (Widescreen)</option>
                  <option value="1920x1080">1920 x 1080 (HD)</option>
                </select>
              </div>

              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-cyan-300 font-mono">
                  SCREEN SHAKE
                </label>
                <input 
                  type="checkbox" 
                  checked={screenShake} 
                  onChange={(e) => setScreenShake(e.target.checked)}
                  className="w-5 h-5 accent-cyan-500 cursor-pointer"
                />
              </div>

              <div className="pt-4 border-t border-gray-700">
                <button 
                  onClick={toggleFullscreen}
                  className="w-full flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-600 text-white rounded p-2 font-mono transition-colors"
                >
                  <Maximize size={16} />
                  TOGGLE FULLSCREEN
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
