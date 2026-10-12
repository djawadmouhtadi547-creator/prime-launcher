// موقع Prime Launcher: صفحة تعريفية + سيرفر سكنات لمود CustomSkinLoader
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const DATA = path.join(__dirname, 'data');
const SKINS = path.join(DATA, 'skins');
const CAPES = path.join(DATA, 'capes');
const DOWNLOADS = path.join(__dirname, 'downloads');
const TOKENS = path.join(DATA, 'tokens.json');
for (const d of [SKINS, CAPES, DOWNLOADS]) fs.mkdirSync(d, { recursive: true });

const NAME_RE = /^[A-Za-z0-9_]{3,16}$/;
let tokens = {};
try {
  tokens = JSON.parse(fs.readFileSync(TOKENS, 'utf8'));
} catch {
  tokens = {};
}
const saveTokens = () => fs.writeFileSync(TOKENS, JSON.stringify(tokens, null, 2));
const hash = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');

// null = الاسم غير محجوز، true/false = تطابق الرمز
function tokenMatches(key, token) {
  const stored = tokens[key];
  if (!stored) return null;
  const a = Buffer.from(stored, 'hex');
  const b = Buffer.from(hash(token), 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// حد بسيط للطلبات: 30 عملية كتابة في الساعة لكل IP
const hits = new Map();
function rateLimit(req, res, next) {
  const now = Date.now();
  const rec = hits.get(req.ip);
  if (!rec || rec.reset < now) hits.set(req.ip, { count: 1, reset: now + 3600_000 });
  else if (++rec.count > 30) return res.status(429).json({ error: 'عدد كبير من الطلبات، حاول لاحقاً.' });
  next();
}

function validSkin(buf) {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (!Buffer.isBuffer(buf) || buf.length < 24 || sig.some((b, i) => buf[i] !== b)) return 'الملف ليس PNG صالحاً';
  const w = buf.readUInt32BE(16);
  const h = buf.readUInt32BE(20);
  if (w !== 64 || (h !== 64 && h !== 32)) return `المقاس ${w}×${h} غير مدعوم (المقبول 64×64 أو 64×32)`;
  return '';
}

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use((req, res, next) => {
  res.set({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,HEAD,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,X-Skin-Token',
  });
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

const serveImage = (dir) => (req, res) => {
  const name = req.params.name.toLowerCase();
  if (!NAME_RE.test(name)) return res.sendStatus(404);
  const file = path.join(dir, `${name}.png`);
  if (!fs.existsSync(file)) return res.sendStatus(404);
  res.set('Cache-Control', 'public, max-age=60');
  res.type('png').sendFile(file);
};
app.get('/skins/:name.png', serveImage(SKINS));
app.get('/capes/:name.png', serveImage(CAPES));

app.put('/api/skins/:name', rateLimit, express.raw({ type: 'image/png', limit: '256kb' }), (req, res) => {
  const name = req.params.name;
  if (!NAME_RE.test(name)) return res.status(400).json({ error: 'اسم لاعب غير صالح' });
  const problem = validSkin(req.body);
  if (problem) return res.status(400).json({ error: problem });
  const token = req.get('x-skin-token') || '';
  if (token.length < 16) return res.status(401).json({ error: 'رمز الحماية مفقود' });
  const key = name.toLowerCase();
  const match = tokenMatches(key, token);
  if (match === false) return res.status(403).json({ error: 'هذا الاسم محجوز من جهاز آخر' });
  if (match === null) {
    tokens[key] = hash(token);
    saveTokens();
  }
  fs.writeFileSync(path.join(SKINS, `${key}.png`), req.body);
  res.json({ ok: true });
});

app.delete('/api/skins/:name', rateLimit, (req, res) => {
  const name = req.params.name;
  if (!NAME_RE.test(name)) return res.status(400).json({ error: 'اسم لاعب غير صالح' });
  const key = name.toLowerCase();
  if (tokenMatches(key, req.get('x-skin-token') || '') !== true) {
    return res.status(403).json({ error: 'غير مصرّح لك بحذف هذا السكن' });
  }
  fs.rmSync(path.join(SKINS, `${key}.png`), { force: true });
  res.json({ ok: true });
});

app.get('/api/downloads', (req, res) => {
  const files = fs
    .readdirSync(DOWNLOADS)
    .filter((f) => !f.startsWith('.'))
    .map((name) => ({ name, size: fs.statSync(path.join(DOWNLOADS, name)).size }));
  res.json(files);
});

app.use('/downloads', express.static(DOWNLOADS));
app.use(express.static(path.join(__dirname, 'public')));

app.use((err, req, res, next) => {
  if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'الملف كبير جداً' });
  res.status(500).json({ error: 'خطأ في السيرفر' });
});

app.listen(PORT, () => console.log(`Prime Launcher site: http://localhost:${PORT}`));
