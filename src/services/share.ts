import type { ExpireOption, SharePayload, ShareParseResult, ShareConfig, SharedIconItem } from '../types';
import type { Project, IconItem } from '../types';

const EXPIRE_MS: Record<ExpireOption, number | null> = {
  '1h': 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
  'never': null,
};

export function expireOptionToMs(option: ExpireOption): number | null {
  return EXPIRE_MS[option];
}

export function formatExpireLabel(option: ExpireOption): string {
  const map: Record<ExpireOption, string> = {
    '1h': '1 小时',
    '24h': '24 小时',
    '7d': '7 天',
    '30d': '30 天',
    'never': '永久有效',
  };
  return map[option];
}

async function simpleHash(str: string): Promise<string> {
  const data = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

function xorEncryptDecrypt(data: Uint8Array, key: Uint8Array): Uint8Array {
  const result = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    result[i] = data[i] ^ key[i % key.length];
  }
  return result;
}

async function compressBytes(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof CompressionStream === 'undefined') {
    return bytes;
  }
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  const chunks: Uint8Array[] = [];
  const reader = stream.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  const totalLen = chunks.reduce((s, c) => s + c.length, 0);
  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const c of chunks) {
    result.set(c, offset);
    offset += c.length;
  }
  return result;
}

async function decompressBytes(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') {
    return bytes;
  }
  try {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    const chunks: Uint8Array[] = [];
    const reader = stream.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
    const totalLen = chunks.reduce((s, c) => s + c.length, 0);
    const result = new Uint8Array(totalLen);
    let offset = 0;
    for (const c of chunks) {
      result.set(c, offset);
      offset += c.length;
    }
    return result;
  } catch {
    return bytes;
  }
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(str: string): Uint8Array {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function utf8ToBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

function bytesToUtf8(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

export async function createSharePayload(
  project: Project,
  icons: IconItem[],
  expireOption: ExpireOption,
  password: string | null
): Promise<SharePayload> {
  const now = Date.now();
  const duration = expireOptionToMs(expireOption);
  const expiresAt = duration ? now + duration : null;

  const sharedIcons: SharedIconItem[] = icons.map((icon) => ({
    name: icon.name,
    width: icon.width,
    height: icon.height,
    addedAt: icon.addedAt,
    dataUrl: icon.dataUrl,
  }));

  const config: ShareConfig = {
    expiresAt,
    passwordHash: password ? await simpleHash(password) : null,
    createdAt: now,
  };

  return {
    projectName: project.name,
    projectDescription: project.description,
    icons: sharedIcons,
    config,
  };
}

export async function encodeShareLink(
  payload: SharePayload,
  password: string | null
): Promise<{ url: string; charCount: number; compressed: boolean }> {
  const jsonStr = JSON.stringify(payload);
  let dataBytes = utf8ToBytes(jsonStr);

  const compressed = await compressBytes(dataBytes);
  const useCompress = compressed.length < dataBytes.length;
  if (useCompress) dataBytes = compressed;

  let finalBytes = dataBytes;
  let flagByte = 0;
  if (useCompress) flagByte |= 0x01;

  if (password) {
    const keyHash = await simpleHash(password);
    const keyBytes = utf8ToBytes(keyHash.slice(0, 32));
    finalBytes = xorEncryptDecrypt(finalBytes, keyBytes);
    flagByte |= 0x02;
  }

  const wrapped = new Uint8Array(1 + finalBytes.length);
  wrapped[0] = flagByte;
  wrapped.set(finalBytes, 1);

  const encoded = bytesToBase64Url(wrapped);
  const baseUrl = `${window.location.origin}${window.location.pathname}#/share`;
  const url = `${baseUrl}?d=${encodeURIComponent(encoded)}`;

  return { url, charCount: encoded.length, compressed: useCompress };
}

export function isShareExpired(config: ShareConfig): boolean {
  if (!config.expiresAt) return false;
  return Date.now() > config.expiresAt;
}

export async function parseShareLink(
  encoded: string,
  password: string | null = null
): Promise<ShareParseResult> {
  try {
    const wrapped = base64UrlToBytes(decodeURIComponent(encoded));
    if (wrapped.length < 2) {
      return { valid: false, expired: false, needPassword: false, error: '分享数据格式错误' };
    }

    const flagByte = wrapped[0];
    const isCompressed = (flagByte & 0x01) !== 0;
    const hasPassword = (flagByte & 0x02) !== 0;

    let dataBytes = wrapped.slice(1);

    if (hasPassword) {
      if (!password) {
        return { valid: false, expired: false, needPassword: true };
      }
      const keyHash = await simpleHash(password);
      const keyBytes = utf8ToBytes(keyHash.slice(0, 32));
      dataBytes = xorEncryptDecrypt(dataBytes, keyBytes);
    }

    if (isCompressed) {
      dataBytes = await decompressBytes(dataBytes);
    }

    const jsonStr = bytesToUtf8(dataBytes);
    let payload: SharePayload;
    try {
      payload = JSON.parse(jsonStr);
    } catch {
      if (hasPassword) {
        return { valid: false, expired: false, needPassword: true, error: '密码错误或数据损坏' };
      }
      return { valid: false, expired: false, needPassword: false, error: '分享数据损坏' };
    }

    if (!payload || !payload.projectName || !Array.isArray(payload.icons) || !payload.config) {
      return { valid: false, expired: false, needPassword: false, error: '分享数据格式无效' };
    }

    if (isShareExpired(payload.config)) {
      return { valid: false, expired: true, needPassword: false, error: '分享链接已过期' };
    }

    if (payload.config.passwordHash && password) {
      const inputHash = await simpleHash(password);
      if (inputHash !== payload.config.passwordHash) {
        return { valid: false, expired: false, needPassword: true, error: '密码错误' };
      }
    }

    return { valid: true, expired: false, needPassword: false, payload };
  } catch (e) {
    return {
      valid: false,
      expired: false,
      needPassword: false,
      error: e instanceof Error ? e.message : '解析分享链接失败',
    };
  }
}

export function getShareDataFromHash(): string | null {
  const hash = window.location.hash;
  const match = hash.match(/\?d=([^&]+)/);
  return match ? match[1] : null;
}

export function formatExpireRemaining(expiresAt: number): string {
  const remaining = expiresAt - Date.now();
  if (remaining <= 0) return '已过期';
  const days = Math.floor(remaining / (24 * 60 * 60 * 1000));
  const hours = Math.floor((remaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const mins = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
  if (days > 0) return `${days} 天 ${hours} 小时`;
  if (hours > 0) return `${hours} 小时 ${mins} 分钟`;
  return `${mins} 分钟`;
}

export const MAX_URL_CHARS = 6000;

export function estimateShareSize(icons: IconItem[]): {
  totalBytes: number;
  exceedsLimit: boolean;
  recommendOptimize: boolean;
} {
  let total = 0;
  for (const icon of icons) {
    total += icon.dataUrl.length;
    total += icon.name.length + 50;
  }
  total += 500;
  const estimatedEncoded = Math.ceil(total * 0.75 * 1.33);
  return {
    totalBytes: total,
    exceedsLimit: estimatedEncoded > MAX_URL_CHARS,
    recommendOptimize: estimatedEncoded > MAX_URL_CHARS * 0.8,
  };
}
