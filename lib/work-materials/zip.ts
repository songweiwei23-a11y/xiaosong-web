import zlib from 'node:zlib';

/**
 * 读 zip 包。docx、xlsx、pptx 都是 zip 包，里面是 XML，所以不需要额外的解析库。
 * 只读需要的条目；解压后的总大小有上限，防止压缩炸弹把服务器内存撑爆。
 */
export const MAX_UNZIPPED_BYTES = 30 * 1024 * 1024;

const EOCD_SIG = 0x06054b50;
const CENTRAL_SIG = 0x02014b50;
const LOCAL_SIG = 0x04034b50;

function findEndOfCentralDirectory(buf: Buffer): number {
  const floor = Math.max(0, buf.length - 22 - 0xffff);
  for (let i = buf.length - 22; i >= floor; i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) return i;
  }
  return -1;
}

export function readZipEntries(bytes: Uint8Array, want: (name: string) => boolean = () => true): Map<string, Buffer> {
  const buf = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = findEndOfCentralDirectory(buf);
  if (eocd < 0) throw new Error('不是有效的压缩包');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const out = new Map<string, Buffer>();
  let total = 0;
  for (let i = 0; i < count; i++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== CENTRAL_SIG) throw new Error('压缩包目录损坏');
    const method = buf.readUInt16LE(p + 10);
    const compressedSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOffset = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    p += 46 + nameLen + extraLen + commentLen;
    if (name.endsWith('/') || !want(name)) continue;
    if (compressedSize === 0xffffffff || localOffset === 0xffffffff) throw new Error('不支持超大的压缩包条目');
    if (buf.readUInt32LE(localOffset) !== LOCAL_SIG) throw new Error('压缩包条目损坏');
    const start = localOffset + 30 + buf.readUInt16LE(localOffset + 26) + buf.readUInt16LE(localOffset + 28);
    const raw = buf.subarray(start, start + compressedSize);
    let data: Buffer;
    if (method === 0) data = raw;
    else if (method === 8) data = zlib.inflateRawSync(raw, { maxOutputLength: MAX_UNZIPPED_BYTES });
    else continue;
    total += data.length;
    if (total > MAX_UNZIPPED_BYTES) throw new Error('压缩包解开后太大');
    out.set(name, data);
  }
  return out;
}
