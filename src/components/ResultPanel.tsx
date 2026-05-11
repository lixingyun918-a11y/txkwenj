type ResultPanelProps = {
  resultUrl: string;
  isWeChat: boolean;
  onSave: () => void;
  onReset: () => void;
};

export function ResultPanel({ resultUrl, isWeChat, onSave, onReset }: ResultPanelProps) {
  if (!resultUrl) return null;

  const saveLabel = isWeChat ? '长按保存' : '保存 PNG';

  return (
    <section className="panel result-panel" aria-labelledby="result-title">
      <div>
        <p className="section-kicker">第三步</p>
        <h2 id="result-title">喜报头像已生成</h2>
      </div>
      <div className="result-preview">
        <img src={resultUrl} alt="生成后的高清头像" decoding="async" draggable={false} />
      </div>
      <p className="result-note">{isWeChat ? '微信内请长按图片保存到相册' : '长按图片可保存，或点击按钮下载高清 PNG'}</p>
      <div className="action-row">
        <button className="primary-action" type="button" aria-label={saveLabel} onClick={onSave}>
          {saveLabel}
        </button>
        <button className="ghost-action" type="button" onClick={onReset}>
          返回重做
        </button>
      </div>
    </section>
  );
}
