# 家财险到万家头像框生成网站

纯前端静态 H5 项目。用户头像只在浏览器本地读取和 Canvas 合成，不上传服务器，不需要后端、数据库、登录或微信 JS-SDK。

## 技术栈

- Vite
- React
- TypeScript
- HTML5 Canvas
- 轻量 CSS 动效

## 本地运行

```bash
npm install
npm run dev
```

## 构建

```bash
npm run build
```

构建产物在 `dist/`，可直接作为静态资源部署。

## 资源目录

```text
public/
  frames/
    头像框1.png
    头像框2.png
    头像框3.png
    头像框4.png
    头像框5.png
    头像框6.png
  audio/
    bgm.mp3
```

头像框资源会通过 `src/utils/frames.ts` 自动生成配置。`bgm.mp3` 是本地背景音乐文件，浏览器会在用户点击音乐按钮后再加载，避免微信内自动播放限制。

## Cloudflare Pages

1. 连接仓库。
2. Framework preset 选择 `Vite`。
3. Build command 填写 `npm run build`。
4. Build output directory 填写 `dist`。
5. 环境变量无需配置。

本项目是纯静态站点，不需要 Node 服务、PM2、Docker 或数据库。

## Nginx 静态部署

将 `dist/` 上传到服务器目录，例如 `/usr/share/nginx/html/avatar-frame`。

```nginx
location / {
  root /usr/share/nginx/html/avatar-frame;
  try_files $uri $uri/ /index.html;
}
```

建议为静态资源开启长期缓存，HTML 保持短缓存。

## 兼容说明

- 支持 JPG、PNG、WEBP，HEIC 取决于浏览器解码能力。
- 输出 PNG 为 1080 x 1080。
- 微信浏览器内不强制下载，提示用户长按图片保存到相册。
- 超大图会在本地降采样，降低低端安卓设备 Canvas 内存压力。
