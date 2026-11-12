/**
 * 打开一个公开网页、取回 HTML（深度研究读来源用）。只在服务端用。
 *
 * 这是「服务端替用户去打开一个外部给的链接」，链接来自搜索结果，得防着被拿来打内网（SSRF）：
 *   - 只许 http / https、默认端口，链接里不许带账号密码
 *   - 域名解析出来的每个地址都要是公网地址；连接时用自己的 lookup 再判一次（防 DNS 重绑定）
 *   - 跳转自己跟，每一跳重新判，最多 4 跳
 *   - 限时、限大小，只收网页和纯文本（PDF、图片、压缩包都不收）
 */
import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns';
import net from 'node:net';
import zlib from 'node:zlib';
import type { LookupAddress } from 'node:dns';
import { decodeText } from '@/lib/document-text';

function v4Private(ip: string): boolean {
  const p = ip.split('.').map(Number);
  if (p.length !== 4 || p.some((x) => !Number.isInteger(x) || x < 0 || x > 255)) return true;
  const [a, b] = p;
  return a === 0 || a === 10 || a === 127 || a >= 224
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || (a === 192 && b === 0 && p[2] === 0)
    || (a === 192 && b === 0 && p[2] === 2)
    || (a === 198 && b === 51 && p[2] === 100)
    || (a === 203 && b === 0 && p[2] === 113)
    || (a === 198 && (b === 18 || b === 19));
}

/** 不是公网地址就算「内网」：私有段、回环、链路本地（含云服务器的元数据地址 169.254.x）、组播、保留段 */
export function isPrivateAddress(ip: string): boolean {
  const kind = net.isIP(ip);
  if (kind === 4) return v4Private(ip);
  if (kind !== 6) return true;
  const s = new URL(`http://[${ip}]/`).hostname.slice(1, -1).toLowerCase();
  // URL 将 IPv4 映射地址规范化为十六进制，必须还原后检查。
  const hexMapped = s.match(/^::(?:ffff:)?([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hexMapped) {
    const a = parseInt(hexMapped[1], 16), b = parseInt(hexMapped[2], 16);
    return v4Private(`${a >> 8}.${a & 255}.${b >> 8}.${b & 255}`);
  }
  const mapped = s.match(/^(?:0*:)*:?ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1] || s.match(/^::(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  if (mapped) return v4Private(mapped);
  if (s === '::' || s === '::1') return true;
  if (/^f[cd]/.test(s) || /^fe[89ab]/.test(s) || /^ff/.test(s)) return true;
  if (s.startsWith('64:ff9b:') || s.startsWith('2001:db8') || s.startsWith('2001:0:') || s.startsWith('2002:')) return true;
  // 仅允许全球单播；排除 IPv4 嵌入、保留及隧道地址。
  return !/^2[0-9a-f]{3}:/.test(s);
}

/** 链接本身能不能打开（不解析域名的那部分检查） */
export function checkUrl(raw: string): URL | null {
  let u: URL;
  try { u = new URL(raw); } catch { return null; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  if (u.username || u.password) return null;
  if (u.port && !((u.protocol === 'http:' && u.port === '80') || (u.protocol === 'https:' && u.port === '443'))) return null;
  const host = u.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!host || host === 'localhost' || /\.(local|localhost|internal|lan|intranet|home|corp)$/.test(host)) return null;
  if (net.isIP(host) && isPrivateAddress(host)) return null;
  if (!net.isIP(host) && !host.includes('.')) return null;
  return u;
}

type LookupCb = (err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void;
function safeLookup(hostname: string, options: dns.LookupOptions, callback: LookupCb) {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, '');
    const list = (addresses as unknown as LookupAddress[]) || [];
    if (!list.length || list.some((a) => isPrivateAddress(a.address))) {
      const e = new Error('blocked private address') as NodeJS.ErrnoException;
      e.code = 'EBLOCKED';
      return callback(e, '');
    }
    if (options.all) callback(null, list);
    else callback(null, list[0].address, list[0].family);
  });
}

export type FetchFailure = 'blocked' | 'timeout' | 'http' | 'type' | 'network' | 'empty';
export type PageFetch = { ok: true; url: string; html: string; contentType: string } | { ok: false; reason: FetchFailure; status?: number };

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36';

function charsetOf(contentType: string, head: string): string | null {
  const fromHeader = contentType.match(/charset=["']?([\w-]+)/i)?.[1];
  if (fromHeader) return fromHeader.toLowerCase();
  return head.match(/<meta[^>]+charset=["']?([\w-]+)/i)?.[1]?.toLowerCase() ?? null;
}

export function decodeHtml(buf: Buffer, contentType: string): string {
  const cs = charsetOf(contentType, buf.subarray(0, 4096).toString('latin1'));
  if (cs && !/^utf-?8$/.test(cs)) {
    try { return new TextDecoder(cs === 'gb2312' || cs === 'gbk' ? 'gb18030' : cs).decode(buf); } catch { /* 不认识的编码按下面猜 */ }
  }
  return decodeText(buf);
}

function requestOnce(u: URL, timeoutMs: number, maxBytes: number): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: Buffer } | { error: FetchFailure }> {
  return new Promise((resolve) => {
    const mod = u.protocol === 'https:' ? https : http;
    let done = false;
    const finish = (v: { status: number; headers: http.IncomingHttpHeaders; body: Buffer } | { error: FetchFailure }) => { if (!done) { done = true; clearTimeout(timer); resolve(v); } };
    const req = mod.request(u, {
      method: 'GET',
      lookup: safeLookup as unknown as typeof dns.lookup,
      headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5', 'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.6', 'Accept-Encoding': 'gzip, deflate, br' },
    }, (res) => {
      const status = res.statusCode || 0;
      if (status >= 300 && status < 400) { res.resume(); return finish({ status, headers: res.headers, body: Buffer.alloc(0) }); }
      const enc = String(res.headers['content-encoding'] || '').toLowerCase();
      const stream = enc.includes('br') ? res.pipe(zlib.createBrotliDecompress()) : enc.includes('gzip') ? res.pipe(zlib.createGunzip()) : enc.includes('deflate') ? res.pipe(zlib.createInflate()) : res;
      const chunks: Buffer[] = [];
      let size = 0;
      stream.on('data', (c: Buffer) => {
        size += c.length;
        chunks.push(c);
        // 太大就只要前面这些（正文一般在前面），不算失败
        if (size >= maxBytes) { req.destroy(); finish({ status, headers: res.headers, body: Buffer.concat(chunks).subarray(0, maxBytes) }); }
      });
      stream.on('end', () => finish({ status, headers: res.headers, body: Buffer.concat(chunks) }));
      stream.on('error', () => finish(chunks.length ? { status, headers: res.headers, body: Buffer.concat(chunks) } : { error: 'network' }));
    });
    const timer = setTimeout(() => { req.destroy(); finish({ error: 'timeout' }); }, timeoutMs);
    req.on('error', (e: NodeJS.ErrnoException) => finish({ error: e.code === 'EBLOCKED' ? 'blocked' : 'network' }));
    req.end();
  });
}

export async function fetchPage(raw: string, opts: { timeoutMs?: number; maxBytes?: number } = {}): Promise<PageFetch> {
  const timeoutMs = opts.timeoutMs ?? 12_000;
  const maxBytes = opts.maxBytes ?? 2_000_000;
  let u = checkUrl(raw);
  if (!u) return { ok: false, reason: 'blocked' };
  for (let hop = 0; hop < 5; hop++) {
    const r = await requestOnce(u, timeoutMs, maxBytes);
    if ('error' in r) return { ok: false, reason: r.error };
    if (r.status >= 300 && r.status < 400) {
      const loc = r.headers.location;
      if (!loc || hop === 4) return { ok: false, reason: 'http', status: r.status };
      let next: URL;
      try { next = new URL(loc, u); } catch { return { ok: false, reason: 'http', status: r.status }; }
      const checked = checkUrl(next.toString());
      if (!checked) return { ok: false, reason: 'blocked' };
      u = checked;
      continue;
    }
    if (r.status < 200 || r.status >= 300) return { ok: false, reason: 'http', status: r.status };
    const contentType = String(r.headers['content-type'] || '').toLowerCase();
    if (contentType && !/text\/html|application\/xhtml|text\/plain|text\/markdown/.test(contentType)) return { ok: false, reason: 'type' };
    if (!r.body.length) return { ok: false, reason: 'empty' };
    return { ok: true, url: u.toString(), html: decodeHtml(r.body, contentType), contentType };
  }
  return { ok: false, reason: 'http' };
}
