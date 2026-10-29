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
  let cur = null;
  content.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    const h = line.match(/^##\s+(.+)$/);
    if (h) { const name = h[1].trim(); cur = { name: SECTION[name] || SECTION[name.toLowerCase()] || name, rows: [] }; sections.push(cur); return; }
    if (!line.startsWith('|')) return;
    if (!cur) { cur = { name: '', rows: [] }; sections.push(cur); }
    const bars = line.split('|').map(b => b.trim()).filter(Boolean).map(b => b.split(/\s+/));
    bars.flat().forEach(c => { if (!CHORD.test(c) && c !== '%' && c !== '-') errors.push(`${where} 第 ${i + 1} 行：看不懂的和弦「${c}」`); });
    cur.rows.push(bars);
  });
  if (!sections.length) errors.push(`${where}：沒有任何和弦列（每列要用 | 開頭）`);

  return {
    id, title: String(d.title || id), artist: String(d.artist || ''), key: String(d.key || 'C'),
    capo: Number(d.capo) || 0, bpm: Number(d.bpm) || 90, time: String(d.time || '4/4'),
    feel: d.feel || 'straight8', strum: String(d.strum || ''), strumNote: String(d.strum_note || ''), strumNoteEn: String(d.strum_note_en || ''),
    diff: Number(d.level) || 1, genre: d.genre || 'pop', language: d.language || 'other', added, sections
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
  const chart = s.sections.map(sec => `<h2>${esc(SECTION_ZH[sec.name] || sec.name)}</h2><pre>${sec.rows.map(r => '| ' + r.map(b => b.join(' ')).join(' | ') + ' |').join('\n')}</pre>`).join('');
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
