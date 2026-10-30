// 把 songs/ 裡的每個 .md 樂譜檔轉成：
//   public/songs.json          網站讀取的樂譜資料
//   public/song/<網址代稱>/     每首歌自己的網頁（給 Google 搜尋用）
//   public/sitemap.xml、robots.txt
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

const SRC = 'songs', PUB = 'public';
const SITE = (process.env.URL || 'https://guitarpuli.netlify.app').replace(/\/$/, '');
const SECTION = {
  '前奏':'intro','主歌':'verse','導歌':'prechorus','副歌':'chorus','橋段':'bridge','間奏':'solo','尾奏':'outro',
  '主歌（12 小節）':'verse12','間奏（12 小節）':'solo12',
  intro:'intro',verse:'verse','pre-chorus':'prechorus',prechorus:'prechorus',chorus:'chorus',bridge:'bridge',solo:'solo',outro:'outro'
};
const SECTION_ZH = {intro:'前奏',verse:'主歌',prechorus:'導歌',chorus:'副歌',bridge:'橋段',solo:'間奏',outro:'尾奏',verse12:'主歌（12 小節）',solo12:'間奏（12 小節）'};
const FEELS = {straight8:'平均八分',swing:'搖擺八分',shuffle:'三連音拖曳',straight16:'平均十六分',triplet:'12/8 三連音'};
const GENRES = ['pop','folk','blues','rock','ballad','oldies'];
const LANGS = {zh:'華語',tw:'台語',yue:'粵語',en:'英文',ja:'日文',ko:'韓文',inst:'演奏曲',other:'其他'};
const CHORD = /^[A-G][#b]?[^\s/|]*(\/[A-G][#b]?)?$/;
const ORDER_NAMES = ['順序', 'order', 'Order', 'ORDER'];
// Obsidian 習慣寫法 → 網站寫法：♯→#、♭→b、△→maj7、—→-
const normChord = c => c.replace(/♯/g, '#').replace(/♭/g, 'b').replace(/△7?/g, 'maj7').replace(/^[—–]$/, '-');
const ONLY = /^(?:第\s*(\d+)\s*次[^:：|]*|末次|最後一次)\s*[:：]\s*/;
const REPEAT = /^[×xX*]\s*(\d+)$/;
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

const errors = [];
const songs = fs.readdirSync(SRC).filter(f => f.endsWith('.md') && !f.startsWith('_')).map(file => {
  const id = path.basename(file, '.md');
  const where = `${SRC}/${file}`;
  if (!/^[a-z0-9-]+$/.test(id)) errors.push(`${where}：檔名只能用小寫英文、數字和 -`);
  let parsed;
  try { parsed = matter(fs.readFileSync(path.join(SRC, file), 'utf8')); }
  catch (e) { errors.push(`${where}：開頭 --- 之間的欄位格式有誤（${e.reason || e.message}）`); return null; }
  const { data: d, content } = parsed;
  for (const k of ['title', 'key']) if (!d[k]) errors.push(`${where}：缺少 ${k}`);
  if (d.feel && !FEELS[d.feel]) errors.push(`${where}：feel 必須是 ${Object.keys(FEELS).join(' / ')}`);
  if (d.genre && !GENRES.includes(d.genre)) errors.push(`${where}：genre 必須是 ${GENRES.join(' / ')}`);
  if (d.language && !LANGS[d.language]) errors.push(`${where}：language 必須是 ${Object.keys(LANGS).join(' / ')}`);
  const added = d.added instanceof Date ? d.added.toISOString().slice(0, 10) : String(d.added || '');
  if (added && !/^\d{4}-\d{2}-\d{2}$/.test(added)) errors.push(`${where}：added 要寫成 2026-10-29 這種格式`);

  const sections = [];
  let cur = null, orderLines = null;
  content.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    const h = line.match(/^##\s+(.+)$/);
    if (h) {
      const name = h[1].trim();
      if (ORDER_NAMES.includes(name)) { orderLines = []; cur = null; return; }
      orderLines = null;
      cur = { name: SECTION[name] || SECTION[name.toLowerCase()] || name, raw: name, rows: [] }; sections.push(cur); return;
    }
    if (orderLines) { if (line) orderLines.push({ line, i }); return; }
    let body = line, only;
    const om = body.match(ONLY);
    if (om) { only = om[1] ? Number(om[1]) : 'last'; body = body.slice(om[0].length).trim(); }
    if (!body.startsWith('|')) return;
    if (!cur) { cur = { name: '', raw: '', rows: [] }; sections.push(cur); }
    const parts = body.split('|');
    let tail = parts.pop().trim(), x;
    if (tail) {
      const rm = tail.match(REPEAT);
      if (rm) x = Number(rm[1]); else errors.push(`${where} 第 ${i + 1} 行：行尾看不懂「${tail}」（重複請寫 ×2）`);
    }
    const bars = parts.map(b => b.trim()).filter(Boolean).map(b => b.split(/\s+/).map(normChord));
    bars.flat().forEach(c => { if (!CHORD.test(c) && c !== '%' && c !== '-') errors.push(`${where} 第 ${i + 1} 行：看不懂的和弦「${c}」`); });
    if (!bars.length) return;
    const row = { b: bars };
    if (x && x > 1) row.x = x;
    if (only !== undefined) row.only = only;
    cur.rows.push(row);
  });
  if (!sections.some(s => s.rows.length)) errors.push(`${where}：沒有任何和弦列（每列要用 | 開頭）`);

  // 順序：「主歌 ×2 → 副歌 → 間奏 → 副歌」；沒寫就照段落由上到下
  let order = sections.map((_, k) => k);
  if (orderLines && orderLines.length) {
    order = [];
    orderLines.forEach(({ line, i }) => line.split(/\s*(?:→|->|➜|,|，)\s*/).filter(Boolean).forEach(tok => {
      const m = tok.match(/^(.*?)\s*(?:[×xX*]\s*(\d+))?$/);
      const nm = m[1].trim(), times = Number(m[2]) || 1;
      const canon = SECTION[nm] || SECTION[nm.toLowerCase()] || nm;
      const k = sections.findIndex(s => s.raw === nm || s.name === canon);
      if (k < 0) { errors.push(`${where} 第 ${i + 1} 行：順序裡的「${nm}」找不到對應的段落`); return; }
      for (let r = 0; r < times; r++) order.push(k);
    }));
  }
  sections.forEach((s, k) => {
    const n = order.filter(o => o === k).length;
    s.rows.forEach(r => { if (typeof r.only === 'number' && r.only > n) errors.push(`${where}：「${s.raw}」有一列寫第 ${r.only} 次才彈，但順序裡只出現 ${n} 次`); });
    delete s.raw;
  });

  return {
    id, title: String(d.title || id), artist: String(d.artist || ''), key: String(d.key || 'C'),
    capo: Number(d.capo) || 0, bpm: Number(d.bpm) || 90, time: String(d.time || '4/4'),
    feel: d.feel || 'straight8', strum: String(d.strum || ''), strumNote: String(d.strum_note || ''), strumNoteEn: String(d.strum_note_en || ''),
    diff: Number(d.level) || 1, genre: d.genre || 'pop', language: d.language || 'other', added, sections, order
  };
}).filter(Boolean);

if (errors.length) { console.error('樂譜檔有問題：\n- ' + errors.join('\n- ')); process.exit(1); }

/* 1. songs.json */
fs.writeFileSync(path.join(PUB, 'songs.json'), JSON.stringify(songs));

/* 2. 每首歌的網頁：用 index.html 當外框，換上標題、說明，並預先放入和弦內容讓搜尋引擎讀得到 */
const shell = fs.readFileSync(path.join(PUB, 'index.html'), 'utf8');
if (!shell.includes('<div id="app"></div>') || !shell.includes('<title>吉他普利</title>')) {
  console.error('public/index.html 找不到 <title> 或 <div id="app"></div>，無法產生歌曲頁'); process.exit(1);
}
fs.rmSync(path.join(PUB, 'song'), { recursive: true, force: true });
for (const s of songs) {
  const url = `${SITE}/song/${s.id}/`;
  const by = s.artist ? `（${s.artist}）` : '';
  const title = `${s.title}${s.artist ? ' - ' + s.artist : ''} 吉他譜 和弦 | 吉他普利 Guitarpuli`;
  const desc = `${s.title}${by}吉他和弦譜，原調 ${s.key}${s.capo ? `，建議 Capo ${s.capo}` : ''}，${FEELS[s.feel]}，${s.bpm} BPM。可線上移調、夾 Capo、看和弦圖、開節拍器。`;
  const head = `<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="music.song">
<meta property="og:site_name" content="吉他普利 Guitarpuli">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}">
<script>window.PAGE_SONG=${JSON.stringify(s.id)};</script>`;
  const cnt = {}, total = {};
  s.order.forEach(k => total[k] = (total[k] || 0) + 1);
  const chart = s.order.map(k => {
    const sec = s.sections[k]; cnt[k] = (cnt[k] || 0) + 1; const n = cnt[k];
    const rows = sec.rows.filter(r => r.only === undefined || r.only === n || (r.only === 'last' && n === total[k]));
    return `<h2>${esc(SECTION_ZH[sec.name] || sec.name)}${total[k] > 1 ? `（第 ${n} 次）` : ''}</h2><pre>${rows.map(r => '| ' + r.b.map(b => b.join(' ')).join(' | ') + ' |' + (r.x ? ' ×' + r.x : '')).join('\n')}</pre>`;
  }).join('');
  const body = `<div id="app"><article class="prose"><h1>${esc(s.title)}</h1><p>${esc(s.artist)} · 原調 ${esc(s.key)}${s.capo ? ` · Capo ${s.capo}` : ''} · ${s.bpm} BPM · ${esc(s.time)} · ${FEELS[s.feel]} · ${LANGS[s.language]}</p>${s.strum ? `<p>刷法：${esc(s.strum)}</p>` : ''}${chart}</article></div>`;
  const html = shell.replace('<title>吉他普利</title>', head).replace('<div id="app"></div>', body);
  fs.mkdirSync(path.join(PUB, 'song', s.id), { recursive: true });
  fs.writeFileSync(path.join(PUB, 'song', s.id, 'index.html'), html);
}

/* 3. sitemap.xml + robots.txt */
const today = new Date().toISOString().slice(0, 10);
fs.writeFileSync(path.join(PUB, 'sitemap.xml'),
`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE}/</loc><lastmod>${today}</lastmod></url>
${songs.map(s => `  <url><loc>${SITE}/song/${s.id}/</loc>${s.added ? `<lastmod>${s.added}</lastmod>` : ''}</url>`).join('\n')}
</urlset>
`);
fs.writeFileSync(path.join(PUB, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /admin/\nSitemap: ${SITE}/sitemap.xml\n`);

console.log(`完成：${songs.length} 首 → songs.json、${songs.length} 個歌曲頁、sitemap.xml`);
