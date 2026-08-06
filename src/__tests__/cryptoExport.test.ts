/**
 * cryptoExport 加密导出模块测试
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock crypto.subtle if not available (jsdom doesn't have it)
const mockSubtle = {
  importKey: vi.fn(),
  deriveKey: vi.fn(),
  encrypt: vi.fn(),
  decrypt: vi.fn(),
};

if (!globalThis.crypto) {
  (globalThis as any).crypto = { subtle: mockSubtle, getRandomValues: vi.fn((arr: Uint8Array) => arr) };
} else if (!globalThis.crypto.subtle) {
  (globalThis.crypto as any).subtle = mockSubtle;
}

import {
  encryptData,
  decryptData,
  checkPasswordStrength,
  isEncryptedFile,
  hasEncryptionHeader,
  encryptAndDownload,
  readAndDecrypt,
} from '@/lib/cryptoExport';

describe('cryptoExport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ===== 密码强度检测 =====
  describe('checkPasswordStrength', () => {
    it('空密码应返回极弱', () => {
      const result = checkPasswordStrength('');
      expect(result.score).toBe(0);
      expect(result.label).toBe('极弱');
    });

    it('短密码应返回较弱', () => {
      const result = checkPasswordStrength('abc');
      expect(result.score).toBeLessThanOrEqual(1);
    });

    it('包含大小写+数字+特殊字符的长密码应返回很强', () => {
      const result = checkPasswordStrength('Abcdef123!@#xyz');
      expect(result.score).toBe(4);
      expect(result.label).toBe('很强');
    });

    it('应给出改进建议', () => {
      const result = checkPasswordStrength('abc');
      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    it('仅数字密码应提示混合大小写', () => {
      const result = checkPasswordStrength('123456789012');
      expect(result.suggestions.some((s) => s.includes('大小写'))).toBe(true);
    });

    it('无特殊字符应提示包含特殊字符', () => {
      const result = checkPasswordStrength('Abcdef123456');
      expect(result.suggestions.some((s) => s.includes('特殊字符'))).toBe(true);
    });
  });

  // ===== 文件格式检测 =====
  describe('isEncryptedFile', () => {
    it('wsec扩展名应返回true', () => {
      const file = new File([''], 'test.wsec', { type: 'application/octet-stream' });
      expect(isEncryptedFile(file)).toBe(true);
    });

    it('json扩展名应返回false', () => {
      const file = new File([''], 'test.json', { type: 'application/json' });
      expect(isEncryptedFile(file)).toBe(false);
    });
  });

  describe('hasEncryptionHeader', () => {
    it('WSEC1开头应返回true', () => {
      const buffer = new TextEncoder().encode('WSEC1' + 'extra data').buffer;
      expect(hasEncryptionHeader(buffer)).toBe(true);
    });

    it('非WSEC1开头应返回false', () => {
      const buffer = new TextEncoder().encode('{"data":"test"}').buffer;
      expect(hasEncryptionHeader(buffer)).toBe(false);
    });

    it('空buffer应返回false', () => {
      expect(hasEncryptionHeader(new ArrayBuffer(0))).toBe(false);
    });

    it('过短buffer应返回false', () => {
      expect(hasEncryptionHeader(new ArrayBuffer(3))).toBe(false);
    });
  });

  // ===== 加解密（使用真实 Web Crypto API） =====
  describe('encryptData / decryptData (real crypto)', () => {
    // 这些测试需要真实的 crypto.subtle，jsdom 可能不支持
    const hasRealCrypto = typeof crypto !== 'undefined' && !!crypto.subtle;

    (hasRealCrypto ? it : it.skip)('应正确加解密字符串', async () => {
      const plaintext = '{"test": "你好世界", "data": [1, 2, 3]}';
      const password = 'TestPass123!';

      const encrypted = await encryptData(plaintext, password);
      expect(encrypted.byteLength).toBeGreaterThan(0);

      const decrypted = await decryptData(encrypted, password);
      expect(decrypted).toBe(plaintext);
    });

    (hasRealCrypto ? it : it.skip)('错误密码应解密失败', async () => {
      const plaintext = '{"test": "data"}';
      const password = 'CorrectPass123!';

      const encrypted = await encryptData(plaintext, password);

      await expect(decryptData(encrypted, 'WrongPass123!')).rejects.toThrow();
    });

    (hasRealCrypto ? it : it.skip)('加密后数据应包含WSEC1头', async () => {
      const encrypted = await encryptData('test data', 'pass123!');
      const header = new TextDecoder().decode(new Uint8Array(encrypted).slice(0, 5));
      expect(header).toBe('WSEC1');
    });

    (hasRealCrypto ? it : it.skip)('加密后数据应大于原始数据', async () => {
      const plaintext = 'short data';
      const encrypted = await encryptData(plaintext, 'pass123!');
      // magic(5) + salt(16) + iv(12) + ciphertext(plaintext + GCM tag 16) = 49 + len
      expect(encrypted.byteLength).toBeGreaterThan(plaintext.length);
    });

    (hasRealCrypto ? it : it.skip)('应支持中文内容加解密', async () => {
      const plaintext = JSON.stringify({
        名称: '黄壁庄水库水源地',
        城市: '石家庄市',
        备注: '千吨万人级集中式饮用水水源地',
      });
      const encrypted = await encryptData(plaintext, '中文密码123!');
      const decrypted = await decryptData(encrypted, '中文密码123!');
      expect(decrypted).toBe(plaintext);
    });

    (hasRealCrypto ? it : it.skip)('不同加密应产生不同密文', async () => {
      const plaintext = 'same data';
      const enc1 = await encryptData(plaintext, 'pass1');
      const enc2 = await encryptData(plaintext, 'pass1');
      // 由于随机 salt 和 IV，密文应不同
      expect(new Uint8Array(enc1)).not.toEqual(new Uint8Array(enc2));
    });
  });

  // ===== 文件下载/读取 =====
  describe('encryptAndDownload', () => {
    const hasRealCrypto = typeof crypto !== 'undefined' && !!crypto.subtle;

    (hasRealCrypto ? it : it.skip)('应生成.wsec文件下载', async () => {
      const appendSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((n) => n);
      const removeSpy = vi.spyOn(document.body, 'removeChild').mockImplementation((n) => n);
      const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

      const result = await encryptAndDownload('test data', 'pass123!', 'backup_test');

      expect(result.success).toBe(true);
      expect(result.fileName).toBe('backup_test.wsec');
      expect(result.encryptedSize).toBeGreaterThan(0);

      appendSpy.mockRestore();
      removeSpy.mockRestore();
      revokeSpy.mockRestore();
    });

    (hasRealCrypto ? it : it.skip)('不应重复添加.wsec扩展名', async () => {
      const appendSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((n) => n);
      const removeSpy = vi.spyOn(document.body, 'removeChild').mockImplementation((n) => n);
      const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

      const result = await encryptAndDownload('test', 'pass', 'file.wsec');
      expect(result.fileName).toBe('file.wsec');

      appendSpy.mockRestore();
      removeSpy.mockRestore();
      revokeSpy.mockRestore();
    });
  });

  describe('readAndDecrypt', () => {
    const hasRealCrypto = typeof crypto !== 'undefined' && !!crypto.subtle;

    (hasRealCrypto ? it : it.skip)('应正确读取并解密文件', async () => {
      const plaintext = '{"test": "data"}';
      const password = 'TestPass123!';

      const encrypted = await encryptData(plaintext, password);
      const file = new File([encrypted], 'test.wsec', { type: 'application/octet-stream' });

      const result = await readAndDecrypt(file, password);
      expect(result.success).toBe(true);
      expect(result.data).toBe(plaintext);
    });

    (hasRealCrypto ? it : it.skip)('错误密码应返回失败结果', async () => {
      const plaintext = '{"test": "data"}';
      const encrypted = await encryptData(plaintext, 'CorrectPass!');
      const file = new File([encrypted], 'test.wsec', { type: 'application/octet-stream' });

      const result = await readAndDecrypt(file, 'WrongPass!');
      expect(result.success).toBe(false);
      expect(result.message).toContain('密码错误');
    });

    (hasRealCrypto ? it : it.skip)('非加密文件应返回格式错误', async () => {
      const file = new File(['plain text data'], 'test.wsec', { type: 'application/octet-stream' });
      const result = await readAndDecrypt(file, 'pass');
      expect(result.success).toBe(false);
      expect(result.message).toContain('格式错误');
    });
  });
});
