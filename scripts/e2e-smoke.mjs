import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const appUrl = process.env.APP_URL || 'http://127.0.0.1:5173';
const outputDir = path.resolve('test-output');
const sourceAvatarPath = process.env.AVATAR_PATH || path.resolve('public', 'frames', '头像框1.png');
const avatarPath = path.join(outputDir, 'smoke-avatar.png');
const outputPrefix = process.env.OUTPUT_PREFIX || 'smoke';
const viewportWidth = Number(process.env.VIEWPORT_WIDTH || 390);
const viewportHeight = Number(process.env.VIEWPORT_HEIGHT || 844);
const deviceScaleFactor = Number(process.env.DEVICE_SCALE || 2);
const userAgent = process.env.USER_AGENT || '';
const port = 9222 + Math.floor(Math.random() * 1000);
const profileDir = path.join(outputDir, `chrome-profile-${port}`);

fs.mkdirSync(outputDir, { recursive: true });

if (!fs.existsSync(chromePath)) {
  throw new Error(`找不到 Chrome: ${chromePath}`);
}

if (!fs.existsSync(sourceAvatarPath)) {
  throw new Error(`找不到测试头像: ${sourceAvatarPath}`);
}

fs.copyFileSync(sourceAvatarPath, avatarPath);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForJson(url, timeout = 10000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
    } catch {
      await sleep(120);
    }
  }
  throw new Error(`等待 Chrome 调试端口超时: ${url}`);
}

function connect(wsUrl) {
  const socket = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  const listeners = new Map();

  socket.addEventListener('message', (event) => {
    const payload = JSON.parse(event.data);
    if (payload.id) {
      const request = pending.get(payload.id);
      if (!request) return;
      pending.delete(payload.id);
      if (payload.error) {
        request.reject(new Error(payload.error.message));
      } else {
        request.resolve(payload.result);
      }
      return;
    }

    if (payload.method) {
      const handlers = listeners.get(payload.method) || [];
      for (const handler of handlers) {
        handler(payload.params || {});
      }
    }
  });

  return new Promise((resolve, reject) => {
    socket.addEventListener('open', () => {
      resolve({
        send(method, params = {}) {
          const nextId = ++id;
          return new Promise((innerResolve, innerReject) => {
            pending.set(nextId, { resolve: innerResolve, reject: innerReject });
            socket.send(JSON.stringify({ id: nextId, method, params }));
          });
        },
        close() {
          socket.close();
        },
        on(method, handler) {
          const handlers = listeners.get(method) || [];
          handlers.push(handler);
          listeners.set(method, handlers);
        }
      });
    });
    socket.addEventListener('close', () => {
      for (const request of pending.values()) {
        request.reject(new Error('Chrome 调试连接已关闭'));
      }
      pending.clear();
    });
    socket.addEventListener('error', reject);
  });
}

async function createPageTarget() {
  const target = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' }).then((response) => response.json());
  if (!target.webSocketDebuggerUrl) {
    throw new Error(`创建 Chrome 页面失败: ${JSON.stringify(target)}`);
  }
  return target;
}

async function waitForPageLoad(client, timeout = 10000) {
  const result = await client.send('Runtime.evaluate', {
    expression: `(() => new Promise((resolve) => {
      if (document.readyState === 'complete') {
        resolve(true);
        return;
      }

      const timer = setTimeout(() => resolve(false), ${timeout});
      window.addEventListener('load', () => {
        clearTimeout(timer);
        resolve(true);
      }, { once: true });
    }))()`,
    awaitPromise: true,
    returnByValue: true
  });

  if (!result.result.value) {
    throw new Error('页面加载超时');
  }
}

async function waitForLoadingGone(client) {
  const result = await client.send('Runtime.evaluate', {
    expression: `(() => new Promise((resolve) => {
      const started = Date.now();
      function tick() {
        const loading = document.querySelector('.loading-screen');
        if (!loading) {
          resolve({ ok: true, elapsed: Date.now() - started });
          return;
        }
        if (Date.now() - started > 2200) {
          resolve({ ok: false, elapsed: Date.now() - started });
          return;
        }
        setTimeout(tick, 50);
      }
      tick();
    }))()`,
    awaitPromise: true,
    returnByValue: true
  });

  return result.result.value;
}

async function waitForResult(client, previousSrc = '') {
  const result = await client.send('Runtime.evaluate', {
    expression: `(() => new Promise((resolve) => {
      const started = Date.now();
      const previousSrc = ${JSON.stringify(previousSrc)};
      function tick() {
        const img = document.querySelector('.result-preview img');
        const toast = document.querySelector('.toast')?.textContent || '';
        if (img && img.complete && img.naturalWidth === 1080 && img.naturalHeight === 1080 && img.src !== previousSrc) {
          resolve({ ok: true, width: img.naturalWidth, height: img.naturalHeight, toast, src: img.src });
          return;
        }
        if (Date.now() - started > 15000) {
          resolve({ ok: false, width: img?.naturalWidth || 0, height: img?.naturalHeight || 0, toast, src: img?.src || '' });
          return;
        }
        setTimeout(tick, 100);
      }
      tick();
    }))()`,
    awaitPromise: true,
    returnByValue: true
  });

  return result.result.value;
}

async function getCompatibilityState(client) {
  const result = await client.send('Runtime.evaluate', {
    expression: `(() => {
      const viewportWidth = window.innerWidth;
      const documentWidth = Math.max(
        document.documentElement.scrollWidth,
        document.body?.scrollWidth || 0
      );
      const selectors = [
        '.app-shell',
        '.hero',
        '.hero-title-art',
        '.hero-badge',
        '.hero p',
        '.panel',
        '.upload-control',
        '.upload-copy',
        '.frame-grid',
        '.frame-card',
        '.result-preview',
        '.result-note',
        '.action-row',
        '.primary-action',
        '.ghost-action',
        '.toast'
      ];
      const overflow = [];
      const touchTargets = [];
      const selectorList = selectors.join(',');

      document.querySelectorAll(selectorList).forEach((element) => {
        const rect = element.getBoundingClientRect();
        if (!rect.width || !rect.height) return;

        if (rect.left < -1 || rect.right > viewportWidth + 1) {
          overflow.push({
            selector: element.className || element.tagName.toLowerCase(),
            left: Math.round(rect.left),
            right: Math.round(rect.right),
            width: Math.round(rect.width)
          });
        }
      });

      document.querySelectorAll('button, label.upload-control').forEach((element) => {
        const rect = element.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        if (rect.width < 44 || rect.height < 44) {
          touchTargets.push({
            selector: element.className || element.tagName.toLowerCase(),
            width: Math.round(rect.width),
            height: Math.round(rect.height)
          });
        }
      });

      const brokenImages = Array.from(document.images)
        .filter((image) => image.complete && (!image.naturalWidth || !image.naturalHeight))
        .map((image) => image.currentSrc || image.src || image.alt || 'unknown');

      return {
        viewportWidth,
        viewportHeight: window.innerHeight,
        visualViewportWidth: Math.round(window.visualViewport?.width || viewportWidth),
        visualViewportHeight: Math.round(window.visualViewport?.height || window.innerHeight),
        documentWidth,
        hasHorizontalOverflow: documentWidth > viewportWidth + 1,
        overflow,
        touchTargets,
        brokenImages,
        rootClasses: Array.from(document.documentElement.classList),
        saveLabel: document.querySelector('.primary-action')?.textContent?.trim() || '',
        resultNote: document.querySelector('.result-note')?.textContent?.trim() || ''
      };
    })()`,
    returnByValue: true
  });

  return result.result.value;
}

function formatEvent(event) {
  return Object.fromEntries(
    Object.entries(event)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .slice(0, 8)
  );
}

function writeDataUrl(file, dataUrl) {
  const match = dataUrl.match(/^data:image\/png;base64,(.+)$/);
  if (!match) return false;
  fs.writeFileSync(file, Buffer.from(match[1], 'base64'));
  return true;
}

const chrome = spawn(chromePath, [
  '--headless=new',
  '--disable-gpu',
  '--no-first-run',
  '--no-default-browser-check',
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profileDir}`
], { stdio: 'ignore' });

try {
  await waitForJson(`http://127.0.0.1:${port}/json/version`);
  const target = await createPageTarget();
  const client = await connect(target.webSocketDebuggerUrl);
  const runtimeErrors = [];
  const consoleErrors = [];
  const requestFailures = [];
  const badResponses = [];

  await client.send('Page.enable');
  await client.send('Runtime.enable');
  await client.send('DOM.enable');
  await client.send('Log.enable');
  await client.send('Network.enable');

  client.on('Runtime.exceptionThrown', ({ exceptionDetails }) => {
    runtimeErrors.push({
      text: exceptionDetails?.text,
      url: exceptionDetails?.url,
      lineNumber: exceptionDetails?.lineNumber,
      columnNumber: exceptionDetails?.columnNumber
    });
  });
  client.on('Log.entryAdded', ({ entry }) => {
    if (entry?.level === 'error') {
      consoleErrors.push({
        source: entry.source,
        text: entry.text,
        url: entry.url,
        lineNumber: entry.lineNumber
      });
    }
  });
  client.on('Network.loadingFailed', ({ errorText, type, canceled, requestId }) => {
    if (!canceled) {
      requestFailures.push({ requestId, type, errorText });
    }
  });
  client.on('Network.responseReceived', ({ response, type }) => {
    if (response?.status >= 400 && !response.url.startsWith('data:') && !response.url.startsWith('blob:')) {
      badResponses.push({
        status: response.status,
        type,
        url: response.url
      });
    }
  });

  if (userAgent) {
    await client.send('Emulation.setUserAgentOverride', { userAgent });
  }
  await client.send('Emulation.setDeviceMetricsOverride', {
    width: viewportWidth,
    height: viewportHeight,
    deviceScaleFactor,
    mobile: true
  });
  await client.send('Page.navigate', { url: appUrl });
  await waitForPageLoad(client);
  await sleep(200);

  const loadingState = await waitForLoadingGone(client);
  if (!loadingState.ok) {
    throw new Error(`Loading 未在 2.2 秒内移除: ${JSON.stringify(loadingState)}`);
  }

  const initialCompatibility = await getCompatibilityState(client);
  if (initialCompatibility.hasHorizontalOverflow || initialCompatibility.overflow.length) {
    throw new Error(`首屏存在横向溢出: ${JSON.stringify(initialCompatibility)}`);
  }
  if (initialCompatibility.brokenImages.length) {
    throw new Error(`首屏存在加载失败图片: ${JSON.stringify(initialCompatibility.brokenImages)}`);
  }

  const documentNode = await client.send('DOM.getDocument', { depth: -1 });
  const input = await client.send('DOM.querySelector', {
    nodeId: documentNode.root.nodeId,
    selector: 'input[type=file]'
  });
  if (!input.nodeId) throw new Error('没有找到上传 input');

  await client.send('DOM.setFileInputFiles', {
    nodeId: input.nodeId,
    files: [avatarPath]
  });

  const firstResult = await waitForResult(client);
  if (!firstResult.ok) {
    throw new Error(`上传生成失败: ${JSON.stringify(firstResult)}`);
  }

  const headerState = await client.send('Runtime.evaluate', {
    expression: `(() => {
      const title = document.querySelector('.hero h1');
      return {
        title: title?.textContent || '',
        titleWidth: Math.round(title?.getBoundingClientRect().width || 0),
        subtitle: document.querySelector('.hero p')?.textContent || '',
        loadingExists: Boolean(document.querySelector('.loading-screen')),
        viewportWidth: window.innerWidth
      };
    })()`,
    returnByValue: true
  });
  if (headerState.result.value.titleWidth > headerState.result.value.viewportWidth - 24) {
    throw new Error(`标题溢出视口: ${JSON.stringify(headerState.result.value)}`);
  }

  const frameResults = [firstResult];
  let previousSrc = firstResult.src;

  for (let index = 1; index < 6; index += 1) {
    await client.send('Runtime.evaluate', {
      expression: `document.querySelectorAll('.frame-card')[${index}].click()`
    });

    const frameResult = await waitForResult(client, previousSrc);
    if (!frameResult.ok) {
      throw new Error(`切换头像框 ${index + 1} 失败: ${JSON.stringify(frameResult)}`);
    }

    frameResults.push(frameResult);
    previousSrc = frameResult.src;
  }

  const finalCompatibility = await getCompatibilityState(client);
  if (finalCompatibility.hasHorizontalOverflow || finalCompatibility.overflow.length) {
    throw new Error(`生成后存在横向溢出: ${JSON.stringify(finalCompatibility)}`);
  }
  if (finalCompatibility.brokenImages.length) {
    throw new Error(`生成后存在加载失败图片: ${JSON.stringify(finalCompatibility.brokenImages)}`);
  }
  if (finalCompatibility.touchTargets.length) {
    throw new Error(`存在小于 44px 的触控目标: ${JSON.stringify(finalCompatibility.touchTargets)}`);
  }
  if (/MicroMessenger/i.test(userAgent || '') && !finalCompatibility.rootClasses.includes('browser-wechat')) {
    throw new Error(`微信 UA 未应用 browser-wechat 类: ${JSON.stringify(finalCompatibility.rootClasses)}`);
  }
  if (/MicroMessenger/i.test(userAgent || '') && !finalCompatibility.saveLabel.includes('长按')) {
    throw new Error(`微信内保存按钮文案异常: ${JSON.stringify(finalCompatibility)}`);
  }
  if (runtimeErrors.length || consoleErrors.length || requestFailures.length || badResponses.length) {
    throw new Error(`页面存在运行时或资源错误: ${JSON.stringify({
      runtimeErrors: runtimeErrors.map(formatEvent),
      consoleErrors: consoleErrors.map(formatEvent),
      requestFailures: requestFailures.map(formatEvent),
      badResponses: badResponses.map(formatEvent)
    })}`);
  }

  const screenshot = await client.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  fs.writeFileSync(path.join(outputDir, `${outputPrefix}-page.png`), Buffer.from(screenshot.data, 'base64'));
  writeDataUrl(path.join(outputDir, `${outputPrefix}-generated-avatar.png`), frameResults.at(-1).src);

  const summary = {
    ok: true,
    viewport: { width: viewportWidth, height: viewportHeight, deviceScaleFactor },
    header: headerState.result.value,
    loading: loadingState,
    compatibility: finalCompatibility,
    errors: {
      runtime: runtimeErrors.length,
      console: consoleErrors.length,
      requests: requestFailures.length,
      responses: badResponses.length
    },
    frameCount: frameResults.length,
    frameResults: frameResults.map((item, index) => ({ frame: index + 1, width: item.width, height: item.height, toast: item.toast })),
    screenshot: path.join(outputDir, `${outputPrefix}-page.png`),
    generated: path.join(outputDir, `${outputPrefix}-generated-avatar.png`)
  };

  console.log(JSON.stringify(summary, null, 2));
  client.close();
} finally {
  chrome.kill();
  fs.rmSync(profileDir, { recursive: true, force: true });
}
