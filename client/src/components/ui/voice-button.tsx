import React, { useState, useEffect } from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VoiceButtonProps {
  isRecording: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  className?: string;
}

export const VoiceButton: React.FC<VoiceButtonProps> = ({
  isRecording,
  onStartRecording,
  onStopRecording,
  isLoading = false,
  disabled = false,
  className,
}) => {
  const [volume, setVolume] = useState(0);

  // Simulate volume fluctuation when recording
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording) {
      interval = setInterval(() => {
        setVolume(Math.random() * 100);
      }, 100);
    } else {
      setVolume(0);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  return (
    <button
      onClick={isRecording ? onStopRecording : onStartRecording}
      disabled={isLoading || disabled}
      className={cn(
        "relative flex items-center justify-center w-16 h-16 rounded-full transition-all duration-300",
        isRecording ? "bg-red-500 hover:bg-red-600" : "bg-white hover:bg-gray-100",
        (isLoading || disabled) && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      {/* Ripple effect when recording */}
      {isRecording && (
        <div className="absolute inset-0 rounded-full animate-ping bg-red-500 opacity-20" />
      )}

      {/* Waveform ring */}
      {isRecording && (
        <div
          className="absolute inset-0 rounded-full border-2 border-red-300 opacity-50 transition-all duration-100"
          style={{ transform: `scale(${1 + volume / 200})` }}
        />
      )}

      {/* Icon */}
      <div className={cn("z-10", isRecording ? "text-white" : "text-black")}>
        {isLoading ? (
          <Loader2 className="w-6 h-6 animate-spin" />
        ) : isRecording ? (
          <Square className="w-6 h-6 fill-current" />
        ) : (
          <Mic className="w-6 h-6" />
        )}
      </div>
    </button>
  );
};
