import { ChangeEvent } from 'react';

type UploadPanelProps = {
  previewUrl: string;
  fileName: string;
  onPick: (file: File) => void;
};

export function UploadPanel({ previewUrl, fileName, onPick }: UploadPanelProps) {
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) onPick(file);
  }

  return (
    <section className="panel upload-panel" aria-labelledby="upload-title">
      <div>
        <p className="section-kicker">第一步</p>
        <h2 id="upload-title">上传头像</h2>
      </div>
      <label className="upload-control">
        <input
          accept="image/jpeg,image/png,image/webp,image/gif,image/bmp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif"
          aria-describedby="upload-help"
          aria-label="选择头像图片"
          name="avatar"
          type="file"
          onClick={(event) => {
            event.currentTarget.value = '';
          }}
          onChange={handleChange}
        />
        <span className="upload-preview">
          {previewUrl ? <img src={previewUrl} alt="已上传头像预览" decoding="async" /> : <b>上传</b>}
        </span>
        <span className="upload-copy">
          <strong>{fileName || '选择手机相册中的头像'}</strong>
          <small id="upload-help">图片仅在本地处理，不上传服务器</small>
        </span>
      </label>
    </section>
  );
}
