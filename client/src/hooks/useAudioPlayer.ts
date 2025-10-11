import { useState, useRef, useCallback, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

interface AudioPlayerState {
  isPlaying: boolean;
  currentTrackId: string | null;
  volume: number;
  currentTime: number;
  duration: number;
  isLoading: boolean;
  error: string | null;
}

interface AudioQueueItem {
  id: string;
  url: string;
  title?: string;
  onEnd?: () => void;
}

export function useAudioPlayer() {
  const { toast } = useToast();
  const [state, setState] = useState<AudioPlayerState>({
    isPlaying: false,
    currentTrackId: null,
    volume: 1,
    currentTime: 0,
    duration: 0,
    isLoading: false,
    error: null
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const queueRef = useRef<AudioQueueItem[]>([]);
  const isProcessingQueueRef = useRef(false);

  // Create audio element with proper configuration
  const createAudioElement = useCallback((url: string) => {
    const audio = new Audio(url);
    audio.crossOrigin = 'anonymous';
    audio.preload = 'metadata';
    
    // Add event listeners
    audio.addEventListener('loadstart', () => {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
    });

    audio.addEventListener('loadedmetadata', () => {
      setState(prev => ({ 
        ...prev, 
        duration: audio.duration || 0,
        isLoading: false 
      }));
    });

    audio.addEventListener('timeupdate', () => {
      setState(prev => ({ ...prev, currentTime: audio.currentTime }));
    });

    audio.addEventListener('ended', () => {
      setState(prev => ({ 
        ...prev, 
        isPlaying: false, 
        currentTime: 0 
      }));
      
      // Process next item in queue
      processNextInQueue();
    });

    audio.addEventListener('error', (e) => {
      const error = e.target?.error;
      let errorMessage = 'Audio playback failed';
      
      if (error) {
        switch (error.code) {
          case MediaError.MEDIA_ERR_ABORTED:
            errorMessage = 'Audio playback was aborted';
            break;
          case MediaError.MEDIA_ERR_NETWORK:
            errorMessage = 'Network error while loading audio';
            break;
          case MediaError.MEDIA_ERR_DECODE:
            errorMessage = 'Audio format not supported';
            break;
          case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
            errorMessage = 'Audio source not supported';
            break;
          default:
            errorMessage = 'Unknown audio error';
        }
      }

      setState(prev => ({ 
        ...prev, 
        isPlaying: false, 
        isLoading: false,
        error: errorMessage 
      }));

      toast({
        title: "Audio Error",
        description: errorMessage,
        variant: "destructive"
      });

      // Process next item in queue even on error
      processNextInQueue();
    });

    audio.addEventListener('canplay', () => {
      setState(prev => ({ ...prev, isLoading: false }));
    });

    return audio;
  }, [toast]);

  // Process next item in queue
  const processNextInQueue = useCallback(() => {
    if (isProcessingQueueRef.current || queueRef.current.length === 0) {
      return;
    }

    isProcessingQueueRef.current = true;
    const nextItem = queueRef.current.shift();
    
    if (nextItem) {
      playAudio(nextItem);
    }
    
    isProcessingQueueRef.current = false;
  }, []);

  // Play audio with enhanced error handling
  const playAudio = useCallback(async (item: AudioQueueItem) => {
    try {
      // Stop current audio if playing
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      setState(prev => ({ 
        ...prev, 
        currentTrackId: item.id,
        error: null 
      }));

      const audio = createAudioElement(item.url);
      audioRef.current = audio;
      audio.volume = state.volume;

      // Set up end callback
      if (item.onEnd) {
        audio.addEventListener('ended', item.onEnd, { once: true });
      }

      await audio.play();
      
      setState(prev => ({ 
        ...prev, 
        isPlaying: true,
        currentTime: 0 
      }));

    } catch (error) {
      console.error('Error playing audio:', error);
      
      setState(prev => ({ 
        ...prev, 
        isPlaying: false,
        isLoading: false,
        error: 'Failed to play audio'
      }));

      toast({
        title: "Playback Error",
        description: "Could not play audio recording",
        variant: "destructive"
      });

      // Process next item in queue
      processNextInQueue();
    }
  }, [createAudioElement, state.volume, toast, processNextInQueue]);

  // Queue audio for playback
  const queueAudio = useCallback((item: AudioQueueItem) => {
    queueRef.current.push(item);
    
    // If nothing is currently playing, start processing the queue
    if (!state.isPlaying && !isProcessingQueueRef.current) {
      processNextInQueue();
    }
  }, [state.isPlaying, processNextInQueue]);

  // Play or pause current audio
  const togglePlayPause = useCallback(async () => {
    if (!audioRef.current) return;

    try {
      if (state.isPlaying) {
        audioRef.current.pause();
        setState(prev => ({ ...prev, isPlaying: false }));
      } else {
        await audioRef.current.play();
        setState(prev => ({ ...prev, isPlaying: true }));
      }
    } catch (error) {
      console.error('Error toggling playback:', error);
      toast({
        title: "Playback Error",
        description: "Could not toggle audio playback",
        variant: "destructive"
      });
    }
  }, [state.isPlaying, toast]);

  // Seek to specific time
  const seekTo = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setState(prev => ({ ...prev, currentTime: time }));
    }
  }, []);

  // Set volume
  const setVolume = useCallback((volume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    setState(prev => ({ ...prev, volume: clampedVolume }));
    
    if (audioRef.current) {
      audioRef.current.volume = clampedVolume;
    }
  }, []);

  // Stop playback and clear queue
  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    
    queueRef.current = [];
    isProcessingQueueRef.current = false;
    
    setState(prev => ({ 
      ...prev, 
      isPlaying: false, 
      currentTrackId: null,
      currentTime: 0,
      error: null 
    }));
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  return {
    ...state,
    queueAudio,
    togglePlayPause,
    seekTo,
    setVolume,
    stop,
    clearError,
    queueLength: queueRef.current.length
  };
}
