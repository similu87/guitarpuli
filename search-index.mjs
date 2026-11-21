// 搜尋用的讀音資料：建置時替每首歌的歌名、歌手算好拼音和注音，寫進 songs.json 的 sx 欄位
//   py 拼音（不含聲調，ü 寫成 v）  pi 拼音首字母
//   zy 注音（不含聲調）            zi 注音首符號
// 每個欄位都是 [歌名, 歌手]。網站前端（public/index.html 的 srank）用這些欄位比對注音、拼音和同音錯字。
// 前端遇到中文關鍵字時會載入 /vendor/pinyin-pro.js（建置時從 node_modules 複製過去），把關鍵字轉成拼音再比對。
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pinyin } from 'pinyin-pro';

const INIT = { zh:'ㄓ', ch:'ㄔ', sh:'ㄕ', b:'ㄅ', p:'ㄆ', m:'ㄇ', f:'ㄈ', d:'ㄉ', t:'ㄊ', n:'ㄋ', l:'ㄌ', g:'ㄍ', k:'ㄎ', h:'ㄏ',
  j:'ㄐ', q:'ㄑ', x:'ㄒ', r:'ㄖ', z:'ㄗ', c:'ㄘ', s:'ㄙ' };
const FIN = { a:'ㄚ', o:'ㄛ', e:'ㄜ', 'ê':'ㄝ', ai:'ㄞ', ei:'ㄟ', ao:'ㄠ', ou:'ㄡ', an:'ㄢ', en:'ㄣ', ang:'ㄤ', eng:'ㄥ', ong:'ㄨㄥ', er:'ㄦ',
  i:'ㄧ', ia:'ㄧㄚ', io:'ㄧㄛ', ie:'ㄧㄝ', iao:'ㄧㄠ', iu:'ㄧㄡ', ian:'ㄧㄢ', in:'ㄧㄣ', iang:'ㄧㄤ', ing:'ㄧㄥ', iong:'ㄩㄥ',
  u:'ㄨ', ua:'ㄨㄚ', uo:'ㄨㄛ', uai:'ㄨㄞ', ui:'ㄨㄟ', uan:'ㄨㄢ', un:'ㄨㄣ', uang:'ㄨㄤ', ueng:'ㄨㄥ',
  uei:'ㄨㄟ', uen:'ㄨㄣ', iou:'ㄧㄡ',   // wei、wen、you 去掉 w/y 後的寫法
  'ü':'ㄩ', 'üe':'ㄩㄝ', 've':'ㄩㄝ', 'üan':'ㄩㄢ', 'ün':'ㄩㄣ' };
const BARE = ['zhi', 'chi', 'shi', 'ri', 'zi', 'ci', 'si'];   // 只有聲母的音節：知、吃、詩、日、資、此、思

// 一個拼音音節（不含聲調）→ 注音；看不懂的（例如嗯 ng）回傳空字串
export function toZhuyin(syl) {
  let s = String(syl).toLowerCase().replace(/v/g, 'ü');
  if (BARE.includes(s)) return INIT[s.slice(0, -1)];
  if (s[0] === 'y') s = s.startsWith('yu') ? 'ü' + s.slice(2) : s.startsWith('yi') ? 'i' + s.slice(2) : 'i' + s.slice(1);
  else if (s[0] === 'w') s = s.startsWith('wu') ? 'u' + s.slice(2) : 'u' + s.slice(1);
  const ini = ['zh', 'ch', 'sh'].includes(s.slice(0, 2)) ? s.slice(0, 2) : INIT[s[0]] ? s[0] : '';
  let fin = s.slice(ini.length);
  if (['j', 'q', 'x'].includes(ini) && fin[0] === 'u') fin = 'ü' + fin.slice(1);   // ju、que、xuan 的 u 是 ü
  if (!fin) return ini ? INIT[ini] : '';
  const f = FIN[fin];
  return f === undefined ? '' : (ini ? INIT[ini] : '') + f;
}

const norm = s => String(s).toLowerCase().replace(/[\s'’\-_.,!?()（）·・、，。！？「」]/g, '');

// 一段文字（歌名或歌手）→ { py, pi, zy, zi }；英文、數字照原樣保留
const HAN = /[㐀-鿿豈-﫿]/;
function readings(text) {
  let py = '', pi = '', zy = '', zi = '';
  // 中文一個字一個字轉；英文、數字一個單字一段，照原樣放進每個欄位（方便中英混著打，例如「獨上c樓」）
  for (const run of String(text).match(/[㐀-鿿豈-﫿]+|[^㐀-鿿豈-﫿]+/g) || []) {
    if (HAN.test(run)) {
      for (const syl of pinyin(run, { toneType: 'none', type: 'array', v: true })) {
        const p = norm(syl), z = toZhuyin(p);
        if (!p) continue;
        py += p; pi += p[0]; zy += z || p; zi += (z || p)[0];
      }
    } else {
      for (const w of run.split(/\s+/)) { const p = norm(w); if (!p) continue; py += p; pi += p[0]; zy += p; zi += p[0]; }
    }
  }
  return { py, pi, zy, zi };
}

export function searchKeys(title, artist) {
  const t = readings(title), a = readings(artist);
  return { py: [t.py, a.py], pi: [t.pi, a.pi], zy: [t.zy, a.zy], zi: [t.zi, a.zi] };
}

// 前端用的拼音轉換程式：從 node_modules 複製到 public/vendor/（產生的檔案，不提交）
export function copyPinyinLib(pub) {
  const require = createRequire(import.meta.url);
  const src = path.join(path.dirname(require.resolve('pinyin-pro/package.json')), 'dist', 'index.js');
  fs.mkdirSync(path.join(pub, 'vendor'), { recursive: true });
  fs.copyFileSync(src, path.join(pub, 'vendor', 'pinyin-pro.js'));
}
