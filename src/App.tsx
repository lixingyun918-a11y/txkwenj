import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FramePicker } from './components/FramePicker';
import { HeroHeader } from './components/HeroHeader';
import { MusicButton } from './components/MusicButton';
import { ParticleLayer } from './components/ParticleLayer';
import { ResultPanel } from './components/ResultPanel';
import { UploadPanel } from './components/UploadPanel';
import { composeAvatar } from './utils/canvas';
import { applyDeviceClasses, isWeChatBrowser, supportsCanvas } from './utils/env';
import { FrameTemplate, frameTemplates } from './utils/frames';
import { validateImageFile } from './utils/image';

function revokeObjectUrl(url: string) {
  if (url.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
}

function App() {
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [selectedFrame, setSelectedFrame] = useState<FrameTemplate>(frameTemplates[0]);
  const [resultUrl, setResultUrl] = useState('');
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [message, setMessage] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const resultRef = useRef<HTMLDivElement | null>(null);
  const previewUrlRef = useRef('');
  const resultUrlRef = useRef('');
  const generationIdRef = useRef(0);
  const inFlightKeyRef = useRef('');
  const isMountedRef = useRef(true);
  const isWeChat = useMemo(() => isWeChatBrowser(), []);

  useEffect(() => {
    isMountedRef.current = true;
    const cleanupDeviceClasses = applyDeviceClasses();

    return () => {
      isMountedRef.current = false;
      cleanupDeviceClasses();
      revokeObjectUrl(previewUrlRef.current);
      revokeObjectUrl(resultUrlRef.current);
    };
  }, []);

  const setNextPreviewUrl = useCallback((url: string) => {
    revokeObjectUrl(previewUrlRef.current);
    previewUrlRef.current = url;
    setPreviewUrl(url);
  }, []);

  const setNextResult = useCallback((url: string, blob: Blob | null) => {
    revokeObjectUrl(resultUrlRef.current);
    resultUrlRef.current = url;
    setResultBlob(blob);
    setResultUrl(url);
  }, []);

  async function generate(file: File, frame: FrameTemplate) {
    if (!supportsCanvas()) {
      setMessage('当前浏览器不支持 Canvas');
      return;
    }

    const generationKey = `${frame.id}:${file.name}:${file.size}:${file.lastModified}`;
    if (inFlightKeyRef.current === generationKey) return;

    const generationId = generationIdRef.current + 1;
    generationIdRef.current = generationId;
    inFlightKeyRef.current = generationKey;
    setIsGenerating(true);
    setMessage('');

    try {
      const result = await composeAvatar(file, frame.src);

      if (!isMountedRef.current || generationId !== generationIdRef.current) {
        revokeObjectUrl(result.dataUrl);
        return;
      }

      setNextResult(result.dataUrl, result.blob);
      window.setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
    } catch (error) {
      if (!isMountedRef.current || generationId !== generationIdRef.current) return;
      setMessage(error instanceof Error ? error.message : '生成失败，请重试');
      setNextResult('', null);
    } finally {
      if (inFlightKeyRef.current === generationKey) {
        inFlightKeyRef.current = '';
      }
      if (isMountedRef.current && generationId === generationIdRef.current) {
        setIsGenerating(false);
      }
    }
  }

  function handlePick(file: File) {
    const validation = validateImageFile(file);
    if (validation) {
      setMessage(validation);
      return;
    }

    const nextPreviewUrl = URL.createObjectURL(file);
    setAvatarFile(file);
    setNextPreviewUrl(nextPreviewUrl);
    setMessage('');
    void generate(file, selectedFrame);
  }

  function handleFrameSelect(frame: FrameTemplate) {
    setSelectedFrame(frame);
    if (!avatarFile) {
      setMessage('请先上传头像');
      return;
    }
    void generate(avatarFile, frame);
  }

  function handleSave() {
    if (isWeChat) {
      setMessage('请长按生成图片保存到相册');
      resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    if (!resultBlob) {
      setMessage('保存失败，请重新生成');
      return;
    }

    try {
      const url = URL.createObjectURL(resultBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `家财险到万家头像框-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setMessage('保存失败，请长按图片保存');
    }
  }

  function handleReset() {
    generationIdRef.current += 1;
    inFlightKeyRef.current = '';
    setAvatarFile(null);
    setNextPreviewUrl('');
    setNextResult('', null);
    setMessage('');
    setIsGenerating(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <>
      <main className="app-shell">
        <ParticleLayer />
        <MusicButton />

        <HeroHeader />

        <div className="content-grid">
          <UploadPanel fileName={avatarFile?.name || ''} previewUrl={previewUrl} onPick={handlePick} />
          <FramePicker
            frames={frameTemplates}
            isGenerating={isGenerating}
            selectedId={selectedFrame.id}
            onSelect={handleFrameSelect}
          />
          <div ref={resultRef}>
            <ResultPanel resultUrl={resultUrl} isWeChat={isWeChat} onReset={handleReset} onSave={handleSave} />
          </div>
        </div>

        {message && <div className="toast" role="status">{message}</div>}
      </main>
    </>
  );
}

export default App;
