// 把 songs/ 裡的每個 .md 樂譜檔轉成：
//   public/songs.json          網站讀取的樂譜資料
//   public/song/<網址代稱>/     每首歌自己的網頁（給 Google 搜尋用）
//   public/sitemap.xml、robots.txt
//   public/changelog.json      更新紀錄（從 changelog.md 轉）
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

const SRC = 'songs', PUB = 'public';
const SITE = (process.env.SITE_URL || 'https://guitarpuli.pages.dev').replace(/\/$/, '');
const SECTION = {
  '前奏':'intro','主歌':'verse','導歌':'prechorus','副歌':'chorus','橋段':'bridge','間奏':'solo','尾奏':'outro',
  '主歌（12 小節）':'verse12','間奏（12 小節）':'solo12',
  intro:'intro',verse:'verse','pre-chorus':'prechorus',prechorus:'prechorus',chorus:'chorus',bridge:'bridge',solo:'solo',outro:'outro'
};
const SECTION_ZH = {intro:'前奏',verse:'主歌',prechorus:'導歌',chorus:'副歌',bridge:'橋段',solo:'間奏',outro:'尾奏',verse12:'主歌（12 小節）',solo12:'間奏（12 小節）'};
const FEELS = {straight8:'平均八分',swing:'搖擺八分',shuffle:'三連音拖曳',straight16:'平均十六分',triplet:'12/8 三連音'};
// 曲風標籤：筆記寫中文（可 1～3 個），網站用英文代號；第一個決定卡片顏色
const GENRE_ZH = {'抒情':'ballad','輕快':'upbeat','民謠':'folk','搖滾':'rock','爵士':'jazz','藍調':'blues','R&B':'rnb','RnB':'rnb','饒舌':'rap','影視歌曲':'ost','影視':'ost'};
const GENRES = ['ballad','upbeat','folk','rock','jazz','blues','rnb','rap','ost'];
const toGenre = g => GENRE_ZH[String(g).trim()] || (GENRES.includes(String(g).trim().toLowerCase()) ? String(g).trim().toLowerCase() : null);
const LANGS = {zh:'華語',tw:'台語',yue:'粵語',en:'英文',ja:'日文',ko:'韓文',inst:'演奏曲',other:'其他'};
const CHORD = /^[A-G][#b]?[^\s/|]*(\/[A-G][#b]?)?$/;
const METER = /^(2|3|4|5|6|7|9|12)\/(4|8)$/;            // 小節開頭的拍號，例如 | 2/4 A |
// 指法：6 碼，x／數字；搥弦、勾弦寫成 (2h3)、(3p2)，(2-3) 當成搥弦
const FRET = /x|\d{1,2}|\(\d{1,2}[hp-]\d{1,2}\)/g;
const parseFrets = f => { const s = f.replace(/\s+/g, '').replace(/[Ｘ×]/g, 'x').replace(/（/g, '(').replace(/）/g, ')');
  const toks = s.match(FRET) || []; if (toks.join('') !== s) return null;
  // 單一數字一碼：連續數字要拆開（x02122 → x 0 2 1 2 2），兩位數格數用括號外的空格寫法不支援
  const out = []; for (const t of toks) { if (/^\d{2}$/.test(t)) out.push(t[0], t[1]); else out.push(t.replace('-', 'h')); }
  return out.length === 6 ? out.join('') : null; };
const ORDER_NAMES = ['順序', 'order', 'Order', 'ORDER'];
// Obsidian 習慣寫法 → 網站寫法：♯→#、♭→b、△7→maj7、單獨的 △（大三和弦）拿掉、—→-
const normChord = c => c.replace(/♯/g, '#').replace(/♭/g, 'b').replace(/△7/g, 'maj7').replace(/△/g, '').replace(/^[—–]$/, '-');
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
  const gRaw = d.genre == null || d.genre === '' ? [] : Array.isArray(d.genre) ? d.genre : String(d.genre).split(/[,，、]/);
  const genres = [];
  gRaw.map(x => String(x).trim()).filter(Boolean).forEach(x => { const g = toGenre(x); if (!g) errors.push(`${where}：看不懂的曲風「${x}」（可用：${Object.keys(GENRE_ZH).filter(k => !['RnB','影視'].includes(k)).join('、')}）`); else if (!genres.includes(g)) genres.push(g); });
  if (genres.length > 3) errors.push(`${where}：曲風最多 3 個`);
  if (d.language && !LANGS[d.language]) errors.push(`${where}：language 必須是 ${Object.keys(LANGS).join(' / ')}`);
  const added = d.added instanceof Date ? d.added.toISOString().slice(0, 10) : String(d.added || '');
  if (added && !/^\d{4}-\d{2}-\d{2}$/.test(added)) errors.push(`${where}：added 要寫成 2026-10-29 這種格式`);

  const sections = [], shapes = [];
  let cur = null, orderLines = null, inShapes = false;
  content.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    const h = line.match(/^##\s+(.+)$/);
    if (h) {
      const name = h[1].trim();
      inShapes = name === '指法';
      if (inShapes) { orderLines = null; cur = null; return; }
      if (ORDER_NAMES.includes(name)) { orderLines = []; cur = null; return; }
      orderLines = null;
      cur = { name: SECTION[name] || SECTION[name.toLowerCase()] || name, raw: name, rows: [] }; sections.push(cur); return;
    }
    if (inShapes) {
      if (!line) return;
      const m = line.replace(/^[-*]\s*/, '').match(/^(.+?)\s*(?:[（(]\s*capo\s*(\d+)\s*[)）])?\s*[＝=]\s*(.+)$/i);
      if (!m) { errors.push(`${where} 第 ${i + 1} 行：指法要寫成「F7/A（Capo 3）＝2x453x」`); return; }
      const c = normChord(m[1].trim()), capo = Number(m[2]) || 0;
      if (!CHORD.test(c)) { errors.push(`${where} 第 ${i + 1} 行：指法的和弦名稱看不懂「${m[1]}」`); return; }
      const f = m[3].split(/[、,，]/).map(x => x.trim()).filter(Boolean).map(x => ({ x, p: parseFrets(x) }));
      const bad = f.filter(x => !x.p);
      if (bad.length || !f.length) { errors.push(`${where} 第 ${i + 1} 行：指法要 6 碼（第 6 弦到第 1 弦），看不懂「${bad.map(x => x.x).join('、') || m[3]}」`); return; }
      shapes.push({ c, capo, f: f.map(x => x.p) });
      return;
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
    bars.forEach(b => b.forEach((c, j) => {
      if (j === 0 && METER.test(c)) { if (b.length < 2) errors.push(`${where} 第 ${i + 1} 行：拍號「${c}」後面要接和弦或 -`); return; }
      if (!CHORD.test(c) && c !== '%' && c !== '-') errors.push(`${where} 第 ${i + 1} 行：看不懂的和弦「${c}」`);
    }));
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
    diff: Number(d.level) || 1, genres, genre: genres[0] || '', shapes, language: d.language || 'other', added, sections, order
  };
}).filter(Boolean);

if (errors.length) { console.error('樂譜檔有問題：\n- ' + errors.join('\n- ')); process.exit(1); }

/* 更新紀錄：changelog.md → public/changelog.json */
const changelog = [];
if (fs.existsSync('changelog.md')) {
  let ver = null, part = null;
  fs.readFileSync('changelog.md', 'utf8').split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim(), where = `changelog.md 第 ${i + 1} 行`;
    let m;
    if ((m = line.match(/^##\s+(v\d+\.\d+\.\d+)\s*[·・\-–—]\s*(\d{4}-\d{2}-\d{2})\s*$/))) { ver = { v: m[1], date: m[2], site: [], songs: [] }; changelog.push(ver); part = null; return; }
    if (/^##\s/.test(line) && !/^###/.test(line)) { errors.push(`${where}：版本要寫成「## v1.2.3 · 2026-11-01」`); return; }
    if ((m = line.match(/^###\s+(.+)$/))) { part = /歌/.test(m[1]) ? 'songs' : 'site'; return; }
    if (!(m = line.match(/^[-*]\s+(.+)$/))) return;
    if (!ver || !part) { errors.push(`${where}：項目要寫在某個版本的「### 網站」或「### 新增歌曲」底下`); return; }
    if (part === 'songs') {
      const id = m[1].trim(), s = songs.find(x => x.id === id);
      if (!s) errors.push(`${where}：找不到歌曲「${id}」（要寫 songs/ 裡的檔名）`); else ver.songs.push({ id, title: s.title, artist: s.artist });
    } else ver.site.push(m[1].trim());
  });
  if (errors.length) { console.error('更新紀錄有問題：\n- ' + errors.join('\n- ')); process.exit(1); }
}
fs.writeFileSync(path.join(PUB, 'changelog.json'), JSON.stringify(changelog));

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

console.log(`完成：${songs.length} 首 → songs.json、${songs.length} 個歌曲頁、sitemap.xml；更新紀錄 ${changelog.length} 版（最新 ${changelog[0]?.v || '—'}）`);
