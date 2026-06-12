// 依存パッケージなしで PWA 用アイコン PNG を生成する。
// モチーフ: 紙色の背景に墨色の円相(えんそう)。
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";

const PAPER = [245, 243, 240];
const INK = [51, 49, 46];

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function makePng(size) {
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = size * 0.32;
  const stroke = size * 0.045;
  // 円相: 右上に切れ目のあるリング
  const gapStart = -Math.PI / 3.2;
  const gapEnd = -Math.PI / 14;

  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 3);
    row[0] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx);
      const inRing = Math.abs(dist - rOuter) <= stroke;
      const inGap = angle > gapStart && angle < gapEnd;
      const [r, g, b] = inRing && !inGap ? INK : PAPER;
      const o = 1 + x * 3;
      row[o] = r;
      row[o + 1] = g;
      row[o + 2] = b;
    }
    rows.push(row);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(Buffer.concat(rows))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

mkdirSync("public", { recursive: true });
for (const size of [192, 512]) {
  writeFileSync(`public/icon-${size}.png`, makePng(size));
  console.log(`public/icon-${size}.png`);
}
writeFileSync("public/apple-touch-icon.png", makePng(180));
console.log("public/apple-touch-icon.png");
