// node scripts/models/chars_preview.mjs  -> art-src/models/characters/sheet-three.png
// Loads every public/models/characters/*.glb in three.js (headless Chromium), plays one clip per character
// (idle, walk, run, shoot, death, hit), prints skinned-bbox heights, and screenshots a line-up.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '../..');
const charDir = path.join(root, 'public/models/characters');
const files = fs.readdirSync(charDir).filter((f) => f.endsWith('.glb')).sort();
const clipOrder = ['idle', 'walk', 'run', 'shoot', 'death', 'hit'];
const html = `<!doctype html><body style="margin:0;background:#3a4250"><canvas id=c width=1800 height=500></canvas>
<script type="importmap">{"imports":{"three":"/three/build/three.module.js","three/addons/":"/three/examples/jsm/"}}</script>
<script type="module">
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
const files = ${JSON.stringify(files)}, order = ${JSON.stringify(clipOrder)};
const r = new T.WebGLRenderer({canvas: c, antialias: true, preserveDrawingBuffer: true}); r.setSize(1800, 500);
const scene = new T.Scene(); scene.add(new T.HemisphereLight(0xffffff, 0x445566, 1.6));
const sun = new T.DirectionalLight(0xffffff, 2); sun.position.set(2, 4, 3); scene.add(sun);
const cam = new T.OrthographicCamera(-4.5, 4.5, 1.25 * 500 / 1800 * 4.5 / 1.25 * 1.0, 0, 0.1, 50);
cam.left = -4.5; cam.right = 4.5; cam.top = 2.5 * 500 / 1000; cam.bottom = -0.2; cam.top = 2.2; cam.bottom = -0.1;
const aspect = 1800 / 500; const hh = 2.3, hw = hh * aspect / 2; cam.left = -hw; cam.right = hw; cam.top = hh - 0.15; cam.bottom = -0.15; cam.updateProjectionMatrix();
cam.position.set(0, 0, 6); cam.lookAt(0, 0, 0); scene.background = new T.Color(0x3a4250);
const mixers = []; const info = {};
const loader = new GLTFLoader();
await Promise.all(files.map((f, i) => new Promise((res, rej) => loader.load('/models/' + f, (g) => {
  const m = g.scene; m.position.x = (i - (files.length - 1) / 2) * 1.15; scene.add(m);
  const mx = new T.AnimationMixer(m); const clip = g.animations.find((a) => a.name === order[i % order.length]);
  mx.clipAction(clip).play(); mx.setTime(clip.duration * 0.4); mixers.push(mx);
  m.updateMatrixWorld(true); const b = new T.Box3().setFromObject(m, true);
  info[f] = { clips: g.animations.map((a) => a.name + ':' + a.duration.toFixed(2)), height: +(b.max.y - b.min.y).toFixed(2), shown: clip.name };
  res();
}, undefined, rej))));
r.render(scene, cam); window.__info = info; window.__done = true;
</script></body>`;

const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  let p = null;
  if (u === '/') { res.setHeader('content-type', 'text/html'); return res.end(html); }
  if (u.startsWith('/three/')) p = path.join(root, 'node_modules/three', u.slice(7));
  else if (u.startsWith('/models/')) p = path.join(charDir, u.slice(8));
  if (!p || !fs.existsSync(p)) { res.statusCode = 404; return res.end('nf'); }
  res.setHeader('content-type', p.endsWith('.js') ? 'text/javascript' : 'application/octet-stream');
  res.end(fs.readFileSync(p));
}).listen(0);
const port = server.address().port;
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1800, height: 500 } });
page.on('console', (m) => console.log('PAGE', m.text()));
page.on('pageerror', (e) => console.log('PAGEERR', e.message));
await page.goto(`http://localhost:${port}/`);
await page.waitForFunction('window.__done', null, { timeout: 60000 });
console.log(JSON.stringify(await page.evaluate('window.__info'), null, 1));
await page.screenshot({ path: path.join(root, 'art-src/models/characters/sheet-three.png') });
await browser.close(); server.close();
