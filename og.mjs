// 產生圖片：每首歌的分享預覽圖 public/og/<id>.png、全站預覽圖 public/og/site.png、
// 手機主畫面圖示 public/apple-touch-icon.png、public/icon-192.png、public/icon-512.png。
// 字型在建置時從 GitHub 下載（Noto Serif TC Black、Noto Sans TC Bold）；
// 下載或產生失敗時不會中斷建置，只是少了預覽圖（回傳 false）。
import fs from 'node:fs';
import path from 'node:path';

const FONT_DIR = path.join('node_modules', '.cache', 'guitarpuli-fonts');
const FONTS = [
  ['NotoSerifTC-Black.otf', 'notofonts/noto-cjk/Serif2.003/Serif/SubsetOTF/TC/NotoSerifTC-Black.otf'],
  ['NotoSansTC-Bold.otf', 'notofonts/noto-cjk/Sans2.004/Sans/SubsetOTF/TC/NotoSansTC-Bold.otf'],
];
const MIRRORS = p => [`https://raw.githubusercontent.com/${p}`, `https://cdn.jsdelivr.net/gh/${p.replace(/^([^/]+\/[^/]+)\/([^/]+)/, '$1@$2')}`];

// 跟網站 CSS 一樣的顏色
const C = { bg: '#F2F3EF', surface: '#FFFFFF', ink: '#1B2220', muted: '#5D6762', line: '#D8DCD5', brass: '#9C6A12', chord: '#0D6A64' };
const GENRE_COLOR = { ballad: '#715887', upbeat: '#2E7383', folk: '#52703C', rock: '#97392C', jazz: '#A6731A', blues: '#24476F', rnb: '#8C4466', rap: '#5E6A1F', ost: '#2F6B60' };
export const PICK = 'M32 4c14.5 0 26 5.6 26 14.5 0 14.6-15 32.5-26 41.5C21 51 6 33.1 6 18.5 6 9.6 17.5 4 32 4z';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

async function getFonts() {
  fs.mkdirSync(FONT_DIR, { recursive: true });
  const files = [];
  for (const [name, p] of FONTS) {
    const f = path.join(FONT_DIR, name);
    if (!fs.existsSync(f) || fs.statSync(f).size < 1e6) {
      let ok = false;
      for (const url of MIRRORS(p)) {
        try { const r = await fetch(url); if (!r.ok) throw new Error(r.status); fs.writeFileSync(f, Buffer.from(await r.arrayBuffer())); ok = true; break; }
        catch (e) { console.warn(`字型下載失敗 ${url}：${e.message}`); }
      }
      if (!ok) return null;
    }
    files.push(f);
  }
  return files;
}

export async function makeImages({ songs, pub, pu, shapeName }) {
  let Resvg;
  try { ({ Resvg } = await import('@resvg/resvg-js')); } catch (e) { console.warn('沒有 @resvg/resvg-js，略過預覽圖：' + e.message); return false; }
  const fontFiles = await getFonts();
  if (!fontFiles) { console.warn('字型下載失敗，略過預覽圖'); return false; }
  const font = { fontFiles, loadSystemFonts: false, defaultFontFamily: 'Noto Sans TC' };
  const render = (svg, w) => new Resvg(svg, { font, fitTo: { mode: 'width', value: w } }).render().asPng();
  const width = (text, size, fam) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="4000" height="400"><text x="0" y="300" font-family="${fam}" font-weight="900" font-size="${size}">${esc(text)}</text></svg>`;
    const b = new Resvg(svg, { font }).getBBox(); return b ? b.width : 0;
  };
  const SERIF = 'Noto Serif TC', SANS = 'Noto Sans TC';
  const puMark = (x, y, size) => `<g transform="translate(${x} ${y}) scale(${size / 64})"><path fill="${C.brass}" d="${PICK}"/>${pu}</g>`;

  // 標題：一行放不下就縮小，再放不下就拆兩行
  function fitTitle(t, maxW) {
    for (let s = 92; s >= 64; s -= 4) if (width(t, s, SERIF) <= maxW) return { size: s, lines: [t] };
    const words = /\s/.test(t) ? t.split(/(?<=\s)/) : [...t];
    for (let s = 76; s >= 40; s -= 4) {
      let best = null;
      for (let i = 1; i < words.length; i++) {
        const a = words.slice(0, i).join('').trim(), b = words.slice(i).join('').trim();
        const w = Math.max(width(a, s, SERIF), width(b, s, SERIF));
        if (w <= maxW && (!best || Math.abs(a.length - b.length) < best.d)) best = { lines: [a, b], d: Math.abs(a.length - b.length) };
      }
      if (best) return { size: s, lines: best.lines };
    }
    return { size: 40, lines: [t] };
  }
  const fitText = (t, size, maxW, fam) => { while (size > 20 && width(t, size, fam) > maxW) size -= 2; return size; };

  const out = path.join(pub, 'og');
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });

  const brand = `${puMark(72, 58, 60)}
<text x="146" y="100" font-family="${SERIF}" font-weight="900" font-size="38" fill="${C.ink}">吉他普利</text>
<text x="310" y="99" font-family="${SANS}" font-weight="700" font-size="20" letter-spacing="5" fill="${C.muted}">GUITARPULI</text>`;

  for (const s of songs) {
    const color = GENRE_COLOR[s.genre] || C.chord;
    // 和弦：照網站預設顯示（夾 Capo 時是按法），依出現順序取前 6 個
    const seen = [];
    for (const k of s.order) { const sec = s.sections[k]; for (const r of sec.rows) for (const b of r.b) for (const c of b) {
      if (!/^[A-G]/.test(c)) continue; const cap = s.capoUse === 'finger' ? 0 : (r.capo ?? sec.capo ?? s.capo);
      const n = shapeName(c, cap, s.key); if (!seen.includes(n)) seen.push(n); } }
    const chords = seen.slice(0, 6);
    const tt = fitTitle(s.title, 670);
    const lh = tt.size * 1.18, top = tt.lines.length > 1 ? 232 : 290;
    const titleSvg = tt.lines.map((l, i) => `<text x="72" y="${top + i * lh}" font-family="${SERIF}" font-weight="900" font-size="${tt.size}" fill="${C.ink}">${esc(l)}</text>`).join('');
    const ay = top + (tt.lines.length - 1) * lh + 74;
    const asz = fitText(s.artist || '', 40, 700, SANS);
    const chips = [`原調 ${s.key}`, s.capoUse === 'finger' ? `Capo ${s.capo}（實音）` : s.capo ? `Capo ${s.capo}` : '不夾 Capo', `${s.bpm} BPM`];
    let cx = 72; const chipSvg = chips.map(t => { const w = width(t, 28, SANS) + 40; const g = `<rect x="${cx}" y="500" width="${w}" height="56" rx="28" fill="${C.surface}" stroke="${C.line}" stroke-width="2"/><text x="${cx + 20}" y="538" font-family="${SANS}" font-weight="700" font-size="28" fill="${C.ink}">${esc(t)}</text>`; cx += w + 14; return g; }).join('');
    // 兩欄放得下就兩欄；和弦名太長就改一欄
    let csz = Math.min(...chords.map(c => fitText(c, 56, 140, SANS)), 56), cols = 2;
    if (csz < 44) { cols = 1; csz = Math.min(...chords.map(c => fitText(c, 48, 300, SANS)), 48); }
    const step = cols === 2 ? 118 : 70, y0 = cols === 2 ? 232 : 206;
    const chordSvg = chords.map((c, i) => `<text x="${852 + (i % cols) * 170}" y="${y0 + Math.floor(i / cols) * step}" font-family="${SANS}" font-weight="700" font-size="${csz}" fill="#FFFFFF">${esc(c)}</text>`).join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<rect width="1200" height="630" fill="${C.bg}"/>
<rect x="800" width="400" height="630" fill="${color}"/>
<text x="852" y="118" font-family="${SANS}" font-weight="700" font-size="24" letter-spacing="4" fill="#FFFFFF" fill-opacity=".72">和弦</text>
${chordSvg}
${brand}
${titleSvg}
<text x="72" y="${ay}" font-family="${SANS}" font-weight="700" font-size="${asz}" fill="${C.muted}">${esc(s.artist || '')}</text>
${chipSvg}
</svg>`;
    fs.writeFileSync(path.join(out, s.id + '.png'), render(svg, 1200));
  }

  // 全站預覽圖
  const site = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<rect width="1200" height="630" fill="${C.bg}"/>
${puMark(500, 90, 200)}
<text x="600" y="420" text-anchor="middle" font-family="${SERIF}" font-weight="900" font-size="96" fill="${C.ink}">吉他普利</text>
<text x="600" y="482" text-anchor="middle" font-family="${SANS}" font-weight="700" font-size="28" letter-spacing="10" fill="${C.muted}">GUITARPULI</text>
<text x="600" y="548" text-anchor="middle" font-family="${SANS}" font-weight="700" font-size="30" fill="${C.chord}">可移調、可夾 Capo 的吉他和弦譜</text>
</svg>`;
  fs.writeFileSync(path.join(out, 'site.png'), render(site, 1200));

  // 手機主畫面圖示：方形底色＋彈片
  const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="${C.bg}"/><g transform="translate(8 8) scale(.75)"><path fill="${C.brass}" d="${PICK}"/>${pu}</g></svg>`;
  fs.writeFileSync(path.join(pub, 'apple-touch-icon.png'), render(icon, 180));
  fs.writeFileSync(path.join(pub, 'icon-192.png'), render(icon, 192));
  fs.writeFileSync(path.join(pub, 'icon-512.png'), render(icon, 512));
  return true;
}
