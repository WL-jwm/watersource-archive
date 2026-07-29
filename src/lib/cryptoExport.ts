/**
 * N5: 数据加密导出模块
 *
 * 使用 Web Crypto API (SubtleCrypto) 实现 AES-GCM 加解密
 * 适用于水源地数据 JSON 导出和全量备份的加密保护
 *
 * 加密格式：
 * [16B IV][N bytes ciphertext]
 * 文件头标识：WSEC (WaterSource Encrypted Container)
 *
 * 完整文件格式：
 * "WSEC1" (5B magic) + [16B IV] + [ciphertext]
 * 解密后为原始 JSON 字符串
 */

// ===== 常量 =====

const MAGIC = 'WSEC1';
const MAGIC_BYTES = new TextEncoder().encode(MAGIC);
const IV_LENGTH = 12; // AES-GCM 推荐 12 字节 IV
const ENCODER = new TextEncoder();
const DECODER = new TextDecoder();

// ===== 类型定义 =====

export interface EncryptionResult {
  success: boolean;
  data: ArrayBuffer; // 加密后的二进制数据
  fileName: string;
  originalSize: number;
  encryptedSize: number;
}

export interface DecryptionResult {
  success: boolean;
  data: string; // 解密后的 JSON 字符串
  message: string;
}

export type PasswordOrKey = string; // 用户密码，将通过 PBKDF2 派生为 AES 密钥

// ===== 密钥派生 =====

/**
 * 使用 PBKDF2 从用户密码派生 AES-GCM 密钥
 */
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    ENCODER.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: toBuffer(salt),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/**
 * 生成随机盐值
 */
function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(16));
}

/** 将 Uint8Array 转为 ArrayBuffer（解决 TS BufferSource 类型问题） */
function toBuffer(arr: Uint8Array): ArrayBuffer {
  return arr.buffer.slice(arr.byteOffset, arr.byteOffset + arr.byteLength) as ArrayBuffer;
}

/**
 * 生成随机 IV
 */
function generateIV(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(IV_LENGTH));
}

// ===== 加密 =====

/**
 * 加密字符串数据
 * @param plaintext 原始 JSON 字符串
 * @param password 用户密码
 * @returns 加密后的 ArrayBuffer（含 magic header + salt + IV + ciphertext）
 */
export async function encryptData(
  plaintext: string,
  password: string,
): Promise<ArrayBuffer> {
  // 1. 派生密钥
  const salt = generateSalt();
  const key = await deriveKey(password, salt);

  // 2. 生成 IV
  const iv = generateIV();

  // 3. 加密
  const plaintextBytes = ENCODER.encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: toBuffer(iv) },
    key,
    plaintextBytes,
  );

  // 4. 组装: magic(5) + salt(16) + iv(12) + ciphertext
  const magicLen = MAGIC_BYTES.length;
  const totalLen = magicLen + salt.length + iv.length + ciphertext.byteLength;
  const result = new Uint8Array(totalLen);

  let offset = 0;
  result.set(MAGIC_BYTES, offset); offset += magicLen;
  result.set(salt, offset); offset += salt.length;
  result.set(iv, offset); offset += iv.length;
  result.set(new Uint8Array(ciphertext), offset);

  return result.buffer;
}

/**
 * 解密数据
 * @param encryptedData 加密的 ArrayBuffer
 * @param password 用户密码
 * @returns 解密后的原始 JSON 字符串
 */
export async function decryptData(
  encryptedData: ArrayBuffer,
  password: string,
): Promise<string> {
  const bytes = new Uint8Array(encryptedData);
  const magicLen = MAGIC_BYTES.length;

  // 1. 校验 magic header
  const magic = DECODER.decode(bytes.slice(0, magicLen));
  if (magic !== MAGIC) {
    throw new Error('文件格式错误：不是有效的加密数据文件');
  }

  // 2. 提取 salt 和 IV
  const salt = bytes.slice(magicLen, magicLen + 16);
  const iv = bytes.slice(magicLen + 16, magicLen + 16 + IV_LENGTH);
  const ciphertext = bytes.slice(magicLen + 16 + IV_LENGTH);

  // 3. 派生密钥
  const key = await deriveKey(password, salt);

  // 4. 解密
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: toBuffer(iv) },
    key,
    toBuffer(ciphertext),
  );

  return DECODER.decode(plaintext);
}

// ===== 文件下载/读取辅助 =====

/**
 * 加密并下载文件
 */
export async function encryptAndDownload(
  plaintext: string,
  password: string,
  baseFileName: string,
): Promise<EncryptionResult> {
  const encrypted = await encryptData(plaintext, password);
  const blob = new Blob([encrypted], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);

  const fileName = baseFileName.endsWith('.wsec')
    ? baseFileName
    : `${baseFileName}.wsec`;

  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return {
    success: true,
    data: encrypted,
    fileName,
    originalSize: plaintext.length,
    encryptedSize: encrypted.byteLength,
  };
}

/**
 * 从文件读取并解密
 */
export async function readAndDecrypt(
  file: File,
  password: string,
): Promise<DecryptionResult> {
  try {
    const buffer = await file.arrayBuffer();
    const plaintext = await decryptData(buffer, password);
    return {
      success: true,
      data: plaintext,
      message: '解密成功',
    };
  } catch (err) {
    return {
      success: false,
      data: '',
      message: err instanceof Error
        ? (err.message.includes('decrypt') || err.message.includes('operation')
          ? '密码错误或文件已损坏'
          : err.message)
        : '解密失败',
    };
  }
}

// ===== 密码强度检测 =====

export interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  color: string;
  suggestions: string[];
}

export function checkPasswordStrength(password: string): PasswordStrength {
  const suggestions: string[] = [];
  let score = 0;

  if (password.length >= 8) score++;
  else suggestions.push('建议至少 8 位字符');

  if (password.length >= 12) score++;

  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  else suggestions.push('建议混合大小写字母');

  if (/\d/.test(password)) score++;
  else suggestions.push('建议包含数字');

  if (/[^a-zA-Z0-9]/.test(password)) score++;
  else suggestions.push('建议包含特殊字符');

  // 限制最高分 4
  score = Math.min(score, 4);

  const labels = ['极弱', '较弱', '一般', '较强', '很强'];
  const colors = ['red', 'orange', 'yellow', 'lime', 'green'];
  const colorClasses = [
    'text-red-500',
    'text-orange-500',
    'text-yellow-500',
    'text-lime-500',
    'text-green-500',
  ];

  return {
    score: score as 0 | 1 | 2 | 3 | 4,
    label: labels[score],
    color: colorClasses[score],
    suggestions,
  };
}

// ===== 格式校验 =====

/**
 * 检测文件是否为加密格式
 */
export function isEncryptedFile(file: File): boolean {
  return file.name.endsWith('.wsec') || file.type === 'application/octet-stream';
}

/**
 * 检测 ArrayBuffer 是否有加密头
 */
export function hasEncryptionHeader(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 5) return false;
  const magic = DECODER.decode(new Uint8Array(buffer).slice(0, 5));
  return magic === MAGIC;
}
