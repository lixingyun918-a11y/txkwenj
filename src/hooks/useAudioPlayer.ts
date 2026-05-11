import { useCallback, useEffect, useRef, useState } from 'react';

type AudioState = {
  isPlaying: boolean;
  isPending: boolean;
  error: string;
  toggle: () => Promise<void>;
};

export function useAudioPlayer(src: string): AudioState {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isMountedRef = useRef(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      audioRef.current?.pause();
      audioRef.current?.removeAttribute('src');
      audioRef.current?.load();
      audioRef.current = null;
    };
  }, []);

  const getAudio = useCallback(() => {
    if (audioRef.current) return audioRef.current;

    const audio = new Audio(src);
    audio.loop = true;
    audio.preload = 'metadata';
    audio.addEventListener('play', () => {
      if (isMountedRef.current) setIsPlaying(true);
    });
    audio.addEventListener('pause', () => {
      if (isMountedRef.current) setIsPlaying(false);
    });
    audio.addEventListener('ended', () => {
      if (isMountedRef.current) setIsPlaying(false);
    });
    audio.addEventListener('error', () => {
      if (!isMountedRef.current) return;
      setIsPlaying(false);
      setError('音乐加载失败，请稍后重试');
    });
    audioRef.current = audio;

    return audio;
  }, [src]);

  const toggle = useCallback(async () => {
    if (isPending) return;
    setError('');
    setIsPending(true);
    const audio = getAudio();

    try {
      if (audio.paused) {
        await audio.play();
      } else {
        audio.pause();
      }
    } catch {
      setIsPlaying(false);
      setError('音乐播放失败');
    } finally {
      if (isMountedRef.current) setIsPending(false);
    }
  }, [getAudio, isPending]);

  return { isPlaying, isPending, error, toggle };
}
