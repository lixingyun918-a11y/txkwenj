import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const outputDir = path.resolve('test-output');
const resultPath = path.join(outputDir, 'wechat-matrix-results.json');
let appUrl = process.env.APP_URL || '';

const cases = [
  {
    name: 'wechat-ios-se-320',
    width: 320,
    height: 568,
    scale: 2,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_8 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.49(0x1800312f) NetType/WIFI Language/zh_CN'
  },
  {
    name: 'wechat-ios-modern-390',
    width: 390,
    height: 844,
    scale: 3,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.50(0x1800322f) NetType/WIFI Language/zh_CN'
  },
  {
    name: 'wechat-ios-max-430',
    width: 430,
    height: 932,
    scale: 3,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.50(0x1800322f) NetType/4G Language/zh_CN'
  },
  {
    name: 'wechat-android-huawei-360',
    width: 360,
    height: 780,
    scale: 3,
    userAgent: 'Mozilla/5.0 (Linux; Android 12; HUAWEI HarmonyOS; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/116.0.0.0 XWEB/116 MMWEBSDK/20240404 Mobile Safari/537.36 MicroMessenger/8.0.49.2600(0x2800315D) WeChat/arm64 Weixin NetType/WIFI Language/zh_CN ABI/arm64'
  },
  {
    name: 'wechat-android-xiaomi-393',
    width: 393,
    height: 851,
    scale: 2.75,
    userAgent: 'Mozilla/5.0 (Linux; Android 13; Redmi K60 Build/TKQ1.221114.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/119.0.0.0 XWEB/119 MMWEBSDK/20240404 Mobile Safari/537.36 MicroMessenger/8.0.50.2700(0x2800323D) WeChat/arm64 Weixin NetType/WIFI Language/zh_CN ABI/arm64'
  },
  {
    name: 'wechat-android-oppo-360',
    width: 360,
    height: 800,
    scale: 3,
    userAgent: 'Mozilla/5.0 (Linux; Android 13; OPPO PFEM10 Build/TP1A.220905.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/118.0.0.0 XWEB/118 MMWEBSDK/20240404 Mobile Safari/537.36 MicroMessenger/8.0.49.2600(0x2800315D) WeChat/arm64 Weixin NetType/WIFI Language/zh_CN ABI/arm64'
  },
  {
    name: 'wechat-android-vivo-393',
    width: 393,
    height: 873,
    scale: 2.75,
    userAgent: 'Mozilla/5.0 (Linux; Android 13; V2241A Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/119.0.0.0 XWEB/119 MMWEBSDK/20240404 Mobile Safari/537.36 MicroMessenger/8.0.49.2600(0x2800315D) WeChat/arm64 Weixin NetType/WIFI Language/zh_CN ABI/arm64'
  },
  {
    name: 'wechat-android-samsung-412',
    width: 412,
    height: 915,
    scale: 2.625,
    userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-S9180 Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.0.0 XWEB/120 MMWEBSDK/20240404 Mobile Safari/537.36 MicroMessenger/8.0.50.2700(0x2800323D) WeChat/arm64 Weixin NetType/5G Language/zh_CN ABI/arm64'
  }
];

fs.mkdirSync(outputDir, { recursive: true });

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForUrl(url, timeout = 12000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      await sleep(150);
    }
  }

  throw new Error(`等待预览服务超时: ${url}`);
}

async function startPreviewIfNeeded() {
  if (appUrl) return null;

  const port = 53220 + Math.floor(Math.random() * 600);
  appUrl = `http://127.0.0.1:${port}`;
  const viteBin = path.resolve('node_modules', 'vite', 'bin', 'vite.js');
  const outLog = path.join(outputDir, `wechat-matrix-preview-${port}.out.log`);
  const errLog = path.join(outputDir, `wechat-matrix-preview-${port}.err.log`);
  const out = fs.openSync(outLog, 'w');
  const err = fs.openSync(errLog, 'w');
  const child = spawn(process.execPath, [viteBin, 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
    cwd: process.cwd(),
    stdio: ['ignore', out, err],
    windowsHide: true
  });

  try {
    await waitForUrl(appUrl);
    return child;
  } catch (error) {
    child.kill();
    throw error;
  }
}

function extractJson(stdout) {
  const start = stdout.indexOf('{');
  const end = stdout.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;

  try {
    return JSON.parse(stdout.slice(start, end + 1));
  } catch {
    return null;
  }
}

const previewProcess = await startPreviewIfNeeded();
const results = [];

try {
  for (const testCase of cases) {
    console.log(`Running ${testCase.name} (${testCase.width}x${testCase.height}@${testCase.scale})`);

    const child = spawnSync(process.execPath, ['scripts/e2e-smoke.mjs'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: {
        ...process.env,
        APP_URL: appUrl,
        OUTPUT_PREFIX: testCase.name,
        USER_AGENT: testCase.userAgent,
        VIEWPORT_WIDTH: String(testCase.width),
        VIEWPORT_HEIGHT: String(testCase.height),
        DEVICE_SCALE: String(testCase.scale)
      }
    });

    const summary = extractJson(child.stdout);
    const passed = child.status === 0 && Boolean(summary?.ok);
    const result = {
      name: testCase.name,
      viewport: {
        width: testCase.width,
        height: testCase.height,
        scale: testCase.scale
      },
      passed,
      summary,
      error: passed ? '' : (child.stderr || child.stdout).trim()
    };

    results.push(result);
    console.log(`${passed ? 'PASS' : 'FAIL'} ${testCase.name}`);
  }

  const report = {
    appUrl,
    createdAt: new Date().toISOString(),
    total: results.length,
    passed: results.filter((result) => result.passed).length,
    failed: results.filter((result) => !result.passed).length,
    results
  };

  fs.writeFileSync(resultPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Wrote ${resultPath}`);

  if (report.failed > 0) {
    process.exitCode = 1;
  }
} finally {
  previewProcess?.kill();
}
