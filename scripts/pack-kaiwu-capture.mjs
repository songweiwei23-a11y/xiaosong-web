#!/usr/bin/env node
/**
 * 把「开物 · 截屏带入」打成网站能下载的插件包。
 *
 * 源目录 browser-extension/kaiwu-capture，产物 public/kaiwu-capture.zip（清单在 zip 根上，Chrome / Edge 才能加载）。
 * *.zip 被 git 忽略，所以不把二进制提交进仓库。npm run build 的 prebuild、以及同步到服务器之前，都会跑这一步。
 *
 * Windows 和 Linux 都只用 Node 标准库，不调用 PowerShell 的 Compress-Archive
 * （它会把反斜杠写进 zip 路径，扩展加载会失败）。
 *
 * 用法：
 *   node scripts/pack-kaiwu-capture.mjs
 *   node scripts/pack-kaiwu-capture.mjs --source browser-extension/kaiwu-capture --out public/kaiwu-capture.zip
 *
 * 服务器上如果只有打好的包、没有源码目录（旧的同步方式），沿用已有的包并退出 0，避免构建被卡住。
 * 源码和包都没有，退出 1。
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

/** 插件运行需要的文件。多出来的（系统垃圾、另一个 zip）不打进去 */
const FILES = ['manifest.json', 'background.js', 'bridge.js', 'collector.js', 'popup.html', 'popup.js'];

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function dosDateTime(d) {
  return {
    time: ((d.getHours() & 31) << 11) | ((d.getMinutes() & 63) << 5) | ((Math.floor(d.getSeconds() / 2)) & 31),
    date: (((d.getFullYear() - 1980) & 127) << 9) | (((d.getMonth() + 1) & 15) << 5) | (d.getDate() & 31),
  };
}

/** 打一个 zip。条目名只用正斜杠，放在根上（不要再套一层目录） */
export function zipFiles(files) {
  const now = dosDateTime(new Date());
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const file of files) {
    // 只允许根上的文件名。套一层目录的话，Chrome 会说清单找不到
    if (typeof file.name !== 'string' || !file.name || /[\\/\0]|\.\./.test(file.name)) {
      throw new Error(`插件包路径不合法: ${file.name}`);
    }
    const name = Buffer.from(file.name, 'utf8');
    const data = file.data;
    const crc = crc32(data);
    const compressed = zlib.deflateRawSync(data);
    const method = compressed.length < data.length ? 8 : 0;
    const payload = method === 8 ? compressed : data;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // 文件名是 UTF-8
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(now.time, 10);
    local.writeUInt16LE(now.date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(payload.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    const localBuf = Buffer.concat([local, name, payload]);
    locals.push(localBuf);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(now.time, 12);
    central.writeUInt16LE(now.date, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(payload.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centrals.push(Buffer.concat([central, name]));
    offset += localBuf.length;
  }
  const centralBuf = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...locals, centralBuf, end]);
}

/** 读回 zip，核对 CRC。给打包自检和测试用，不依赖系统里的 unzip */
export function readZip(buf) {
  let eocd = -1;
  const start = Math.max(0, buf.length - 22 - 65535);
  for (let i = buf.length - 22; i >= start; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('不是 zip');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const out = [];
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('中央目录损坏');
    const method = buf.readUInt16LE(p + 10);
    const crc = buf.readUInt32LE(p + 16);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOff = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString('utf8');
    const localNameLen = buf.readUInt16LE(localOff + 26);
    const localExtraLen = buf.readUInt16LE(localOff + 28);
    const dataOff = localOff + 30 + localNameLen + localExtraLen;
    const payload = buf.subarray(dataOff, dataOff + compSize);
    const data = method === 0 ? Buffer.from(payload) : zlib.inflateRawSync(payload);
    if (crc32(data) !== crc) throw new Error(`校验失败: ${name}`);
    out.push({ name, data });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

function arg(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : '';
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

const sourceDir = path.resolve(arg('--source') || 'browser-extension/kaiwu-capture');
const outFile = path.resolve(arg('--out') || 'public/kaiwu-capture.zip');
const manifestPath = path.join(sourceDir, 'manifest.json');

if (!fs.existsSync(manifestPath)) {
  if (fs.existsSync(outFile)) {
    console.log(`沿用已有插件包 ${outFile}（源码目录不在这台机器上）`);
    process.exit(0);
  }
  fail(`找不到 ${manifestPath}，也没有现成的 ${outFile}。一键采集的插件包打不出来。`);
}

const files = FILES.map((name) => {
  const full = path.join(sourceDir, name);
  if (!fs.existsSync(full)) fail(`插件源码缺 ${name}`);
  return { name, data: fs.readFileSync(full) };
});
const manifest = JSON.parse(files[0].data.toString('utf8'));
if (typeof manifest.version !== 'string' || !manifest.version) fail('manifest.json 没有版本号');

const zipped = zipFiles(files);
const back = readZip(zipped);
if (back.map((e) => e.name).join('\n') !== FILES.join('\n')) fail('打出来的包文件清单不对');
const packedManifest = JSON.parse(back[0].data.toString('utf8'));
if (packedManifest.version !== manifest.version) fail('包里的版本和源码不一致');

fs.mkdirSync(path.dirname(outFile), { recursive: true });
const tmp = `${outFile}.tmp`;
fs.writeFileSync(tmp, zipped);
fs.copyFileSync(tmp, outFile);
fs.rmSync(tmp, { force: true });
console.log(`已打包 ${outFile}（开物 · 截屏带入 ${manifest.version}，${files.length} 个文件）`);
