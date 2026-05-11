import { useAudioPlayer } from '../hooks/useAudioPlayer';

export function MusicButton() {
  const { isPlaying, isPending, error, toggle } = useAudioPlayer('/audio/bgm.mp3');
  const label = isPlaying ? '暂停音乐' : '播放音乐';

  return (
    <div className="music-shell">
      <button
        className={`music-button ${isPlaying ? 'is-playing' : ''}`}
        type="button"
        aria-label={label}
        aria-pressed={isPlaying}
        disabled={isPending}
        title={label}
        onClick={() => void toggle()}
      >
        <span />
      </button>
      {error && <p className="music-error">{error}</p>}
    </div>
  );
}
