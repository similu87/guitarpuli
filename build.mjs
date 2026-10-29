// 把 songs/ 裡的每個 .md 樂譜檔轉成 public/songs.json，網站會讀這個檔案。
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

const SRC = 'songs', OUT = 'public/songs.json';
const SECTION = {
  '前奏':'intro','主歌':'verse','導歌':'prechorus','副歌':'chorus','橋段':'bridge','間奏':'solo','尾奏':'outro',
  '主歌（12 小節）':'verse12','間奏（12 小節）':'solo12',
  intro:'intro',verse:'verse','pre-chorus':'prechorus',prechorus:'prechorus',chorus:'chorus',bridge:'bridge',solo:'solo',outro:'outro'
};
const FEELS = ['straight8','swing','shuffle','straight16','triplet'];
const GENRES = ['pop','folk','blues','rock','ballad','oldies'];
const CHORD = /^[A-G][#b]?[^\s/|]*(\/[A-G][#b]?)?$/;

const errors = [];
const songs = fs.readdirSync(SRC).filter(f => f.endsWith('.md') && !f.startsWith('_')).map(file => {
  const id = path.basename(file, '.md');
  const where = `${SRC}/${file}`;
  if (!/^[a-z0-9-]+$/.test(id)) errors.push(`${where}：檔名只能用小寫英文、數字和 -`);
  const { data: d, content } = matter(fs.readFileSync(path.join(SRC, file), 'utf8'));
  for (const k of ['title', 'key']) if (!d[k]) errors.push(`${where}：缺少 ${k}`);
  if (d.feel && !FEELS.includes(d.feel)) errors.push(`${where}：feel 必須是 ${FEELS.join(' / ')}`);
  if (d.genre && !GENRES.includes(d.genre)) errors.push(`${where}：genre 必須是 ${GENRES.join(' / ')}`);

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

  const added = d.added instanceof Date ? d.added.toISOString().slice(0, 10) : String(d.added || '');
  return {
    id, title: String(d.title || id), artist: String(d.artist || ''), key: String(d.key || 'C'),
    capo: Number(d.capo) || 0, bpm: Number(d.bpm) || 90, time: String(d.time || '4/4'),
    feel: d.feel || 'straight8', strum: String(d.strum || ''), strumNote: String(d.strum_note || ''), strumNoteEn: String(d.strum_note_en || ''),
    diff: Number(d.level) || 1, genre: d.genre || 'pop', added, sections
  };
});

if (errors.length) { console.error('樂譜檔有問題：\n- ' + errors.join('\n- ')); process.exit(1); }
fs.writeFileSync(OUT, JSON.stringify(songs));
console.log(`完成：${songs.length} 首 → ${OUT}`);
