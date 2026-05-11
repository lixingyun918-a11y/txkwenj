import { FrameTemplate } from '../utils/frames';

type FramePickerProps = {
  frames: FrameTemplate[];
  selectedId: string;
  isGenerating: boolean;
  onSelect: (frame: FrameTemplate) => void;
};

export function FramePicker({ frames, selectedId, isGenerating, onSelect }: FramePickerProps) {
  return (
    <section className="panel" aria-labelledby="frame-title">
      <div className="panel-heading">
        <div>
          <p className="section-kicker">第二步</p>
          <h2 id="frame-title">选择头像框</h2>
        </div>
        {isGenerating && <span className="status-pill">生成中</span>}
      </div>

      <div className="frame-grid">
        {frames.map((frame) => (
          <button
            className={`frame-card ${selectedId === frame.id ? 'is-selected' : ''}`}
            disabled={isGenerating}
            aria-label={`选择${frame.name}`}
            aria-pressed={selectedId === frame.id}
            key={frame.id}
            type="button"
            onClick={() => onSelect(frame)}
          >
            {selectedId === frame.id && <em>已选</em>}
            <img src={frame.src} alt={frame.name} loading={selectedId === frame.id ? 'eager' : 'lazy'} decoding="async" />
            <span>{frame.name}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
