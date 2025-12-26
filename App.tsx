import React, { useState, useCallback, useRef, useEffect } from 'react';
import ThreeScene from './components/ThreeScene';
import UI from './components/UI';
import { AppMode, GestureType } from './types';
import { DEFAULT_PHOTOS } from './constants';

function App() {
  const [appMode, setAppMode] = useState<AppMode>(AppMode.TREE);
  const [currentGesture, setCurrentGesture] = useState<GestureType>(GestureType.NONE);
  const [photos, setPhotos] = useState<string[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Debounce logic could go here to prevent flickering states, 
  // but for a demo, direct setting feels more responsive.

  useEffect(() => {
    setPhotos(DEFAULT_PHOTOS);
  }, [])

  const handleGestureDetected = useCallback((gesture: GestureType) => {
    setCurrentGesture(gesture);

    // State Machine Transition Logic
    setAppMode((prevMode) => {
      // 1. Fist -> Always force Tree
      if (gesture === GestureType.FIST) {
        return AppMode.TREE;
      }

      // 2. Open Hand -> Scatter (if not already scattered or focused)
      // If we are in FOCUS, Open Hand breaks focus back to scatter
      if (gesture === GestureType.OPEN_HAND) {
        return AppMode.SCATTER;
      }

      // 3. PINCH Logic moved to ThreeScene
      // We do NOT automatically switch to FOCUS here anymore.
      // ThreeScene will call setAppMode(FOCUS) only if a photo is actually grabbed.

      return prevMode;
    });
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newPhotos: string[] = [];
      Array.from(e.target.files).forEach(file => {
        newPhotos.push(URL.createObjectURL(file));
      });
      // Append to existing or replace? Let's replace for a fresh tree.
      setPhotos(newPhotos);
      // Reset to tree mode to show them off
      setAppMode(AppMode.TREE);
    }
  };

  return (
    <div className="relative w-full h-screen bg-[#05100a] overflow-hidden">
      <ThreeScene
        photoUrls={photos}
        appMode={appMode}
        setAppMode={setAppMode}
        onGestureDetected={handleGestureDetected}
        videoRef={videoRef}
      />
      <UI
        currentMode={appMode}
        currentGesture={currentGesture}
        onUpload={handleFileUpload}
        videoRef={videoRef}
      />
    </div>
  );
}

export default App;