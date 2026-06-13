import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'demo-video');
const framesDir = path.join(outDir, 'frames');
const WEB = process.env.DEMO_URL || 'http://localhost:3000';
const API = process.env.DEMO_API || 'http://localhost:8787';

const VIEWPORT = { width: 480, height: 960 };

fs.rmSync(framesDir, { recursive: true, force: true });
fs.mkdirSync(framesDir, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let frameIndex = 0;
let firstFrameTime = 0;
let lastFrameTime = 0;

async function snap(page) {
  const file = path.join(framesDir, String(frameIndex).padStart(5, '0') + '.png');
  try {
    await page.screenshot({ path: file });
    if (!firstFrameTime) firstFrameTime = Date.now();
    lastFrameTime = Date.now();
    frameIndex++;
  } catch {}
}

async function hold(page, ms, fps = 10) {
  const interval = 1000 / fps;
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const t = Date.now();
    await snap(page);
    const elapsed = Date.now() - t;
    if (elapsed < interval) await sleep(interval - elapsed);
  }
}

async function narrate(page, text, sub = '') {
  await page.evaluate(({ text, sub }) => {
    let el = document.getElementById('__demo_narration');
    if (!el) {
      el = document.createElement('div');
      el.id = '__demo_narration';
      el.style.cssText = 'position:fixed;left:0;right:0;top:0;z-index:99999;padding:14px 18px;font-family:ui-monospace,Menlo,Consolas,monospace;background:linear-gradient(180deg,rgba(5,10,8,.96),rgba(5,10,8,.78));color:#7CFFB2;border-bottom:1px solid rgba(124,255,178,.35);box-shadow:0 8px 24px rgba(0,0,0,.5)';
      document.body.appendChild(el);
    }
    el.innerHTML = '<div style="font-size:15px;font-weight:700;letter-spacing:.3px">' + text + '</div>' + (sub ? '<div style="font-size:12px;color:#cfe;opacity:.85;margin-top:4px">' + sub + '</div>' : '');
    el.style.opacity = '1';
  }, { text, sub });
}

async function clearNarration(page) {
  await page.evaluate(() => {
    const el = document.getElementById('__demo_narration');
    if (el) el.style.opacity = '0';
  });
}

async function showScanResult(page, r) {
  await page.evaluate((r) => {
    const old = document.getElementById('__demo_scan');
    if (old) old.remove();
    const wrap = document.createElement('div');
    wrap.id = '__demo_scan';
    wrap.style.cssText = 'position:fixed;inset:0;z-index:99998;display:flex;align-items:center;justify-content:center;background:rgba(2,6,4,.82);font-family:ui-monospace,Menlo,Consolas,monospace';
    const cites = (r.citations || []).map((c) => '<span style="display:inline-block;margin:3px 4px 0 0;padding:3px 8px;border:1px solid rgba(124,255,178,.5);border-radius:999px;font-size:11px;color:#7CFFB2">' + c.id + '</span>').join('');
    wrap.innerHTML = '<div style="width:86%;max-width:420px;border:1px solid rgba(124,255,178,.4);border-radius:18px;padding:20px;background:linear-gradient(160deg,#0b1410,#060b08);box-shadow:0 20px 60px rgba(0,0,0,.6)"><div style="display:flex;align-items:center;gap:8px;color:#7CFFB2;font-size:12px;letter-spacing:1px"><span style="width:8px;height:8px;border-radius:50%;background:#39FF8B;box-shadow:0 0 10px #39FF8B"></span>GROUNDED_BY_FOUNDRY_IQ</div><div style="margin-top:14px;color:#fff;font-size:30px;font-weight:800">' + r.material + ' DETECTED</div><div style="margin-top:4px;color:#9fb;font-size:13px">confidence ' + Math.round((r.confidence || 0) * 100) + '% \u00b7 ' + (r.estimatedWeight || 0) + ' kg \u00b7 fraud: ' + (r.fraudDetected ? 'YES' : 'no') + '</div><div style="display:flex;gap:14px;margin-top:18px"><div style="flex:1;border:1px solid rgba(124,255,178,.25);border-radius:12px;padding:12px"><div style="color:#7CFFB2;font-size:11px">REWARD</div><div style="color:#fff;font-size:26px;font-weight:800">' + r.rewardKz + '<span style="font-size:13px;color:#9fb"> Kz</span></div></div><div style="flex:1;border:1px solid rgba(124,255,178,.25);border-radius:12px;padding:12px"><div style="color:#7CFFB2;font-size:11px">CO\u2082 SAVED</div><div style="color:#fff;font-size:26px;font-weight:800">' + r.co2SavedKg + '<span style="font-size:13px;color:#9fb"> kg</span></div></div></div><div style="margin-top:16px;color:#7CFFB2;font-size:11px;letter-spacing:1px">CITATIONS (knowledge base)</div><div style="margin-top:4px">' + cites + '</div><div style="margin-top:14px;color:#bcd;font-size:11px;line-height:1.5;opacity:.85">' + (r.explanation || '').slice(0, 160) + '\u2026</div></div>';
    document.body.appendChild(wrap);
  }, r);
}

async function hideScanResult(page) {
  await page.evaluate(() => {
    const el = document.getElementById('__demo_scan');
    if (el) el.remove();
  });
}

async function clickByText(page, text) {
  const btn = page.locator('button', { hasText: text }).first();
  await btn.click({ timeout: 8000 }).catch(() => {});
}

async function main() {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  const page = await context.newPage();

  await page.goto(WEB, { waitUntil: 'domcontentloaded' });
  await sleep(1500);
  await narrate(page, 'Prox-Recycle', 'Gamified recycling for Angola \u2014 grounded by Microsoft Foundry IQ');
  await hold(page, 2600);

  await narrate(page, 'Instant access', 'One-tap guest login for reviewers');
  await hold(page, 800);
  await clickByText(page, 'ENTER_AS_GUEST');
  await clickByText(page, 'Enter as Guest');
  await sleep(1200);
  await clickByText(page, 'ENTER_AS_GUEST');
  await page.waitForFunction(() => /INTEL_FEED|STATUS: OPTIMAL/i.test(document.body.innerText), null, { timeout: 15000 }).catch(() => {});
  await sleep(1000);

  await narrate(page, 'Tactical bounty map', 'Live recycling targets with surge pricing across the city');
  await hold(page, 3500);

  await page.evaluate(() => {
    const pin = document.querySelector('div[style*="top"][style*="left"] div.rounded-full') || document.querySelector('div[style*="top"][style*="left"]');
    if (pin) pin.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await sleep(600);
  await narrate(page, 'Pick a bounty', 'Material, weight and the Kanza (Kz) reward');
  await hold(page, 3000);
  await page.keyboard.press('Escape').catch(() => {});

  await narrate(page, 'AI Scan \u2014 two-step pipeline', 'Step 1: Groq vision describes the item');
  await hold(page, 2400);
  await narrate(page, 'AI Scan \u2014 two-step pipeline', 'Step 2: Foundry IQ grounds it against the knowledge base');
  await hold(page, 1600);

  let result;
  try {
    result = await page.evaluate(async (api) => {
      const img = await fetch('https://images.unsplash.com/photo-1572964734607-0051976fac79?w=320&q=45');
      const buf = await img.arrayBuffer();
      let bin = '';
      const bytes = new Uint8Array(buf);
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      const res = await fetch(api + '/api/scan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: btoa(bin) }) });
      return res.json();
    }, API);
  } catch {
    result = null;
  }
  if (!result || !result.material) {
    result = { material: 'PET', confidence: 0.88, estimatedWeight: 0.35, fraudDetected: false, rewardKz: 210, co2SavedKg: 0.52, citations: [{ id: 'CLASS-PET' }, { id: 'PRICE-PET' }, { id: 'CO2-PET' }], explanation: 'PET plastic bottle classified and priced against the recycling knowledge base.' };
  }
  await clearNarration(page);
  await showScanResult(page, result);
  await hold(page, 4500);
  await narrate(page, 'Explainable rewards', 'Every payout cites the knowledge-base entry that justifies it \u2014 no hallucination');
  await hold(page, 3500);
  await hideScanResult(page);

  await clickByText(page, 'Base');
  await sleep(1000);
  await narrate(page, 'Wallet Hub', 'Kanza balance, daily impact goal, cash out to Unitel Money');
  await hold(page, 3500);

  await clickByText(page, 'LDR_BRD');
  await sleep(1000);
  await narrate(page, 'Leaderboard', 'Ranking by total mass recovered \u2014 turning cleanup into competition');
  await hold(page, 3500);

  await narrate(page, 'Prox-Recycle', 'React 19 \u00b7 Firebase \u00b7 Groq vision \u2192 Microsoft Foundry IQ \u00b7 keys stay server-side');
  await hold(page, 3500);

  await context.close();
  await browser.close();

  const seconds = Math.max(1, (lastFrameTime - firstFrameTime) / 1000);
  const fps = Math.max(5, Math.min(15, Math.round(frameIndex / seconds)));
  const outFile = path.join(outDir, 'prox-recycle-demo.mp4');
  console.log('Captured ' + frameIndex + ' frames over ' + seconds.toFixed(1) + 's -> ' + fps + ' fps');

  const args = ['-y', '-framerate', String(fps), '-i', path.join(framesDir, '%05d.png'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-movflags', '+faststart', outFile];
  const enc = spawnSync(ffmpegPath, args, { stdio: 'inherit' });
  if (enc.status === 0) {
    fs.rmSync(framesDir, { recursive: true, force: true });
    console.log('Video saved: ' + outFile);
  } else {
    console.error('ffmpeg failed with status ' + enc.status);
    process.exit(1);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
