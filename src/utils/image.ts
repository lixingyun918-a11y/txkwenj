const MAX_UPLOAD_SIZE = 16 * 1024 * 1024;
const ACCEPTED_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/pjpeg',
  'image/png',
  'image/x-png',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/gif',
  'image/bmp'
];
const ACCEPTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif', '.gif', '.bmp'];
const IMAGE_LOAD_TIMEOUT_MS = 10000;
const DECODE_TIMEOUT_MS = 1200;

export function validateImageFile(file: File): string | null {
  if (!file) return '请选择头像图片';
  const lowerName = file.name.toLowerCase();
  const hasAcceptedExtension = ACCEPTED_EXTENSIONS.some((extension) => lowerName.endsWith(extension));
  const supported = ACCEPTED_TYPES.includes(file.type) || (!file.type && hasAcceptedExtension) || hasAcceptedExtension;

  if (file.size <= 0) return '图片为空，请重新选择';
  if (!supported) return '请上传 JPG、PNG、WEBP、GIF、BMP 或 HEIC 图片';
  if (file.size > MAX_UPLOAD_SIZE) return '图片太大，请选择 16MB 以内图片';

  return null;
}

export async function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    return await loadImage(url);
  } catch {
    throw new Error(file.name.toLowerCase().match(/\.hei[cf]$/) ? '当前浏览器不支持 HEIC，请换 JPG 或 PNG' : '头像读取失败，请更换图片重试');
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const timeout = window.setTimeout(() => {
      image.onload = null;
      image.onerror = null;
      reject(new Error(src.startsWith('/frames/') ? '头像框加载超时，请刷新页面重试' : '图片加载超时，请更换图片重试'));
    }, IMAGE_LOAD_TIMEOUT_MS);

    image.decoding = 'async';
    image.onload = async () => {
      window.clearTimeout(timeout);
      if (image.decode) {
        try {
          await Promise.race([
            image.decode(),
            new Promise((innerResolve) => window.setTimeout(innerResolve, DECODE_TIMEOUT_MS))
          ]);
        } catch {
          // Some browsers reject decode() after onload for animated images, but the image is still usable.
        }
      }

      if (!image.naturalWidth || !image.naturalHeight) {
        reject(new Error('图片尺寸异常，请更换图片'));
        return;
      }

      resolve(image);
    };
    image.onerror = () => {
      window.clearTimeout(timeout);
      reject(new Error(src.startsWith('/frames/') ? '头像框加载失败，请刷新页面重试' : '图片加载失败'));
    };
    image.src = src;
  });
}
