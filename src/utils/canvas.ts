import { loadImage, loadImageFromFile } from './image';

const OUTPUT_SIZE = 1080;
const MAX_DECODE_SIDE = 2048;
const CANVAS_BLOB_TIMEOUT_MS = 8000;

type RenderedAvatar = {
  blob: Blob;
  dataUrl: string;
};

function get2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext('2d', {
    alpha: true,
    willReadFrequently: true
  });

  if (!context) {
    throw new Error('当前浏览器不支持 Canvas');
  }

  return context;
}

function makeCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function drawCover(
  context: CanvasRenderingContext2D,
  image: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
  portraitBias = 0.46
) {
  if (!sourceWidth || !sourceHeight || !targetWidth || !targetHeight) {
    throw new Error('图片尺寸异常，请更换图片');
  }

  const scale = Math.max(targetWidth / sourceWidth, targetHeight / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  const x = (targetWidth - drawWidth) / 2;
  const yBias = sourceHeight > sourceWidth ? portraitBias : 0.5;
  const y = targetHeight / 2 - drawHeight * yBias;

  context.drawImage(image, x, y, drawWidth, drawHeight);
}

function downscaleIfNeeded(image: HTMLImageElement): HTMLCanvasElement | HTMLImageElement {
  const maxSide = Math.max(image.naturalWidth, image.naturalHeight);

  if (maxSide <= MAX_DECODE_SIDE) {
    return image;
  }

  const scale = MAX_DECODE_SIDE / maxSide;
  const width = Math.round(image.naturalWidth * scale);
  const height = Math.round(image.naturalHeight * scale);
  const canvas = makeCanvas(width, height);
  const context = get2d(canvas);

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, 0, 0, width, height);

  return canvas;
}

function sourceSize(source: HTMLCanvasElement | HTMLImageElement) {
  if (source instanceof HTMLCanvasElement) {
    return { width: source.width, height: source.height };
  }

  return { width: source.naturalWidth, height: source.naturalHeight };
}

function prepareFrameLayer(frame: HTMLImageElement): HTMLCanvasElement {
  const canvas = makeCanvas(OUTPUT_SIZE, OUTPUT_SIZE);
  const context = get2d(canvas);

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(frame, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

  let imageData: ImageData;

  try {
    imageData = context.getImageData(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
  } catch {
    return canvas;
  }

  const data = imageData.data;
  const centerX = OUTPUT_SIZE / 2;
  const centerY = OUTPUT_SIZE * 0.49;
  const radiusX = OUTPUT_SIZE * 0.44;
  const radiusY = OUTPUT_SIZE * 0.45;

  for (let index = 0; index < data.length; index += 4) {
    const pixel = index / 4;
    const x = pixel % OUTPUT_SIZE;
    const y = Math.floor(pixel / OUTPUT_SIZE);
    const normalized = ((x - centerX) / radiusX) ** 2 + ((y - centerY) / radiusY) ** 2;

    if (normalized > 1.08) continue;

    const red = data[index];
    const green = data[index + 1];
    const blue = data[index + 2];
    const max = Math.max(red, green, blue);
    const min = Math.min(red, green, blue);
    const average = (red + green + blue) / 3;
    const nearWhite = average > 238 && max - min < 18;

    if (!nearWhite) continue;

    const strength = Math.min(1, Math.max(0, (average - 238) / 17));
    data[index + 3] = Math.round(data[index + 3] * (1 - strength));
  }

  context.putImageData(imageData, 0, 0);
  return canvas;
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (canvas.toBlob) {
      const timeout = window.setTimeout(() => {
        reject(new Error('图片导出超时，请重试'));
      }, CANVAS_BLOB_TIMEOUT_MS);

      canvas.toBlob((blob) => {
        window.clearTimeout(timeout);
        if (blob) {
          resolve(blob);
          return;
        }
        reject(new Error('保存失败，请长按图片保存'));
      }, 'image/png');
      return;
    }

    try {
      const dataUrl = canvas.toDataURL('image/png');
      const binary = atob(dataUrl.split(',')[1]);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }
      resolve(new Blob([bytes], { type: 'image/png' }));
    } catch {
      reject(new Error('保存失败，请长按图片保存'));
    }
  });
}

export async function composeAvatar(file: File, frameSrc: string): Promise<RenderedAvatar> {
  const [avatarImage, frameImage] = await Promise.all([
    loadImageFromFile(file),
    loadImage(frameSrc)
  ]);

  const avatarSource = downscaleIfNeeded(avatarImage);
  const avatarSize = sourceSize(avatarSource);

  if (!avatarSize.width || !avatarSize.height || !frameImage.naturalWidth || !frameImage.naturalHeight) {
    throw new Error('图片尺寸异常，请更换图片');
  }

  const canvas = makeCanvas(OUTPUT_SIZE, OUTPUT_SIZE);
  const context = get2d(canvas);

  context.clearRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  drawCover(context, avatarSource, avatarSize.width, avatarSize.height, OUTPUT_SIZE, OUTPUT_SIZE);

  const frameLayer = prepareFrameLayer(frameImage);
  context.drawImage(frameLayer, 0, 0);

  const blob = await canvasToBlob(canvas);
  let dataUrl: string;

  try {
    dataUrl = canvas.toDataURL('image/png');
  } catch {
    dataUrl = URL.createObjectURL(blob);
  }

  canvas.width = 1;
  canvas.height = 1;
  frameLayer.width = 1;
  frameLayer.height = 1;

  return { blob, dataUrl };
}
