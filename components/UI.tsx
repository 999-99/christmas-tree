import React, { useRef } from 'react';
import { Camera, Upload, Hand, Grip, Expand, Rotate3d } from 'lucide-react';
import { AppMode, GestureType } from '../types';

interface UIProps {
  currentMode: AppMode;
  currentGesture: GestureType;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  videoRef: React.RefObject<HTMLVideoElement | null>;
}

const UI: React.FC<UIProps> = ({ currentMode, currentGesture, onUpload, videoRef }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getGestureIcon = () => {
    switch (currentGesture) {
      case GestureType.FIST: return <Grip className="w-8 h-8 text-red-400 animate-pulse" />;
      case GestureType.OPEN_HAND: return <Expand className="w-8 h-8 text-green-400 animate-pulse" />;
      case GestureType.PINCH: return <Hand className="w-8 h-8 text-yellow-400 animate-pulse" />;
      default: return <Hand className="w-8 h-8 text-gray-500 opacity-50" />;
    }
  };

  const getStatusText = () => {
    switch (currentMode) {
      case AppMode.TREE: return "合拢态 (Closed Tree)";
      case AppMode.SCATTER: return "散开态 (Scattered)";
      case AppMode.FOCUS: return "照片展示 (Photo Focus)";
    }
  };

  return (
    <div className="absolute inset-0 pointer-events-none z-10 flex flex-col justify-between p-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
           <h1 className="text-4xl font-serif text-[#D4AF37] tracking-widest drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
            LUMIÈRE NOËL
          </h1>
          <p className="text-gray-400 text-sm mt-1 tracking-wider">MERRY CHRISTMAS</p>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="pointer-events-auto flex items-center gap-2 bg-[#D4AF37]/20 hover:bg-[#D4AF37]/40 border border-[#D4AF37] text-[#D4AF37] px-4 py-2 rounded-full transition-all backdrop-blur-sm"
          >
            <Upload size={18} />
            <span className="text-sm font-semibold">UPLOAD PHOTOS</span>
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            multiple 
            accept="image/*"
            onChange={onUpload}
          />
        </div>
      </div>

      {/* 
        Center Status Feedback - HIDDEN AS REQUESTED
        This section normally displays the current gesture icon and name in the center of the screen.
        It has been commented out to keep the view clean.
      */}
      {/* 
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
         {currentGesture !== GestureType.NONE && (
            <div className="bg-black/60 backdrop-blur-md px-6 py-3 rounded-2xl border border-[#D4AF37]/30 flex flex-col items-center gap-2 animate-fade-in-up">
              {getGestureIcon()}
              <span className="text-[#D4AF37] font-medium tracking-wide text-lg">{currentGesture}</span>
            </div>
         )}
      </div> 
      */}

      {/* Footer / Instructions */}
      <div className="flex justify-between items-end">
        {/* State Indicator */}
        <div className="bg-[#05100a]/80 border-l-4 border-[#8C001A] px-6 py-4 backdrop-blur-md max-w-md">
            <h2 className="text-[#D4AF37] text-xl font-serif mb-1">{getStatusText()}</h2>
            <p className="text-gray-400 text-xs">
              Interact with the scene using your hands.
            </p>
        </div>

        {/* Video Preview & Legend */}
        <div className="flex flex-col items-end gap-4">
            <div className="bg-black/40 p-4 rounded-xl border border-white/10 backdrop-blur-sm">
                <h3 className="text-white/80 text-xs font-bold mb-3 uppercase tracking-wider border-b border-white/10 pb-2">Gestures</h3>
                <ul className="space-y-3 text-sm text-gray-300">
                    <li className="flex items-center gap-3">
                        <Grip size={16} className="text-[#8C001A]" />
                        <span><strong className="text-white">Fist:</strong> Close Tree</span>
                    </li>
                    <li className="flex items-center gap-3">
                        <Expand size={16} className="text-[#2F4F4F]" />
                        <span><strong className="text-white">Open Hand:</strong> Scatter</span>
                    </li>
                    <li className="flex items-center gap-3">
                        <Rotate3d size={16} className="text-[#D4AF37]" />
                        <span><strong className="text-white">Move Hand:</strong> Rotate View</span>
                    </li>
                    <li className="flex items-center gap-3">
                        <Hand size={16} className="text-white" />
                        <span><strong className="text-white">Pinch:</strong> Grab Photo</span>
                    </li>
                </ul>
            </div>
            
            {/* Hidden Video Element for MediaPipe (It needs to be in DOM, but we hide it visually or style it small) */}
            <div className="relative w-32 h-24 rounded-lg overflow-hidden border-2 border-[#D4AF37] shadow-[0_0_15px_#D4AF37]">
                <video 
                  ref={videoRef}
                  id="webcam" 
                  autoPlay 
                  playsInline
                  muted
                  className="w-full h-full object-cover transform -scale-x-100" 
                ></video>
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none">
                    <Camera size={16} className="text-white/50" />
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default UI;