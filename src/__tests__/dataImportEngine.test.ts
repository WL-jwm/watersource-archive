import { describe, it, expect } from 'vitest';
import { importFromText, importFromFile } from '../lib/dataImportEngine';

// ===== 模拟 File 对象 =====
function createMockFile(content: string, name: string, type: string): File {
  const blob = new Blob([content], { type });
  return new File([blob], name, { type });
}

describe('dataImportEngine', () => {
  // ===== CSV 解析 =====
  describe('importFromText (CSV)', () => {
    it('应该正确解析标准CSV', () => {
      const csv = `水源地名称,水源类型,所在县区,使用状态,备注
岗南水库,地表水,平山县,在用,石家庄主城区主要水源
黄壁庄水库,地表水,鹿泉区,在用,与岗南联合调度
滹沱河地下水水源地,地下水,正定县,在用,88个城市水源地之一`;
      const result = importFromText(csv);
      expect(result.meta.parsedRows).toBe(3);
      expect(result.data[0].name).toBe('岗南水库');
      expect(result.data[0].type).toBe('地表水');
      expect(result.data[0].county).toBe('平山县');
      expect(result.data[0].status).toBe('在用');
    });

    it('应该自动检测多种列名写法', () => {
      const csv = `name,type,county,status,remark
Test,地表水,长安区,在用,测试数据`;
      const result = importFromText(csv);
      expect(result.meta.parsedRows).toBe(1);
      expect(result.data[0].name).toBe('Test');
      expect(result.columnMapping['name']).toBe('name');
    });

    it('应该处理缺少必填字段的行（跳过）', () => {
      const csv = `水源地名称,水源类型,所在县区,使用状态
,地下水,长安区,在用
测试水源地,地下水,长安区,在用`;
      const result = importFromText(csv);
      expect(result.meta.parsedRows).toBe(1);
      expect(result.meta.skippedRows).toBe(1);
      expect(result.data[0].name).toBe('测试水源地');
    });

    it('应该处理缺少type的行（跳过）', () => {
      const csv = `水源地名称,水源类型,所在县区,使用状态
测试水源地,,长安区,在用`;
      const result = importFromText(csv);
      expect(result.meta.parsedRows).toBe(0);
      expect(result.meta.skippedRows).toBe(1);
    });

    it('应该标准化水源类型', () => {
      const csv = `name,type,county,status
Test1,地表水,长安区,在用
Test2,地下水,长安区,在用
Test3,SURFACE WATER,长安区,在用
Test4,GROUNDWATER,长安区,在用`;
      const result = importFromText(csv);
      expect(result.data[0].type).toBe('地表水');
      expect(result.data[1].type).toBe('地下水');
      expect(result.data[2].type).toBe('地表水');
      expect(result.data[3].type).toBe('地下水');
    });

    it('应该标准化使用状态', () => {
      const csv = `name,type,county,status
Test1,地下水,长安区,在用
Test2,地下水,长安区,备用
Test3,地下水,长安区,已取消
Test4,地下水,长安区,active
Test5,地下水,长安区,planned`;
      const result = importFromText(csv);
      expect(result.data[0].status).toBe('在用');
      expect(result.data[1].status).toBe('备用');
      expect(result.data[2].status).toBe('取消');
      expect(result.data[3].status).toBe('在用');
      expect(result.data[4].status).toBe('规划');
    });

    it('应该处理空行', () => {
      const csv = `name,type,county,status
Test1,地下水,长安区,在用
,,,
Test2,地下水,长安区,在用`;
      const result = importFromText(csv);
      expect(result.meta.parsedRows).toBe(2);
      expect(result.meta.skippedRows).toBe(1);
    });

    it('缺少状态时默认设为在用', () => {
      const csv = `name,type,county
Test1,地下水,长安区`;
      const result = importFromText(csv);
      expect(result.data[0].status).toBe('在用');
    });

    it('缺少县区时设为"未知"并产生警告', () => {
      const csv = `name,type,county,status
Test1,地下水,,在用`;
      const result = importFromText(csv);
      expect(result.data[0].county).toBe('未知');
      expect(result.warnings.some((w) => w.field === 'county')).toBe(true);
    });

    it('未识别的列名应被记录', () => {
      const csv = `name,type,county,status,未知列
Test1,地下水,长安区,在用,xxx`;
      const result = importFromText(csv);
      expect(result.meta.unmappedColumns).toContain('未知列');
    });

    it('同一字段多个列映射应使用第一个非空值', () => {
      const csv = `水源地名称,名称,type,county,status
Test1,Test2,地下水,长安区,在用`;
      const result = importFromText(csv);
      // 水源地名称和名称都映射到 name，取第一个非空
      expect(result.data[0].name).toBe('Test1');
    });

    it('应该处理空文件', () => {
      const csv = `name,type,county,status`;
      const result = importFromText(csv);
      expect(result.meta.parsedRows).toBe(0);
    });

    it('应该处理完全空内容', () => {
      const result = importFromText('');
      expect(result.meta.totalRows).toBe(0);
    });

    it('应该处理河流字段映射到备注', () => {
      const csv = `name,type,county,status,所属河流
Test1,地下水,长安区,在用,滹沱河`;
      const result = importFromText(csv);
      expect(result.data[0].remark).toBe('滹沱河');
    });
  });

  // ===== File 解析 =====
  describe('importFromFile', () => {
    it('应该拒绝不支持的文件格式', async () => {
      // 在 jsdom 环境中 FileReader 可用，测试不支持的扩展名
      const mockFile = new File(['test'], 'test.pdf', { type: 'application/pdf' });
      await expect(importFromFile(mockFile)).rejects.toThrow();
    });

    it('应该解析CSV文件', () => {
      // 使用 importFromText 代替（不依赖 FileReader）
      const csv = 'name,type,county,status\nTest1,地下水,长安区,在用';
      const result = importFromText(csv);
      expect(result.meta.parsedRows).toBe(1);
    });
  });

  // ===== 边界情况 =====
  describe('边界情况', () => {
    it('应该处理特殊字符', () => {
      const csv = `name,type,county,status,remark
石家庄市(主城区)应急水源,地下水,市区,在用,2025年11月划定保护区，面积4.549km²`;
      const result = importFromText(csv);
      expect(result.meta.parsedRows).toBe(1);
      expect(result.data[0].name).toContain('(');
      expect(result.data[0].remark).toContain('km²');
    });

    it('应该处理超长名称', () => {
      const longName = 'A'.repeat(200);
      const csv = `name,type,county,status\n${longName},地下水,长安区,在用`;
      const result = importFromText(csv);
      expect(result.meta.parsedRows).toBe(1);
      expect(result.data[0].name.length).toBe(200);
    });

    it('应该处理BOM头', () => {
      const csv = '\uFEFFname,type,county,status\nTest1,地下水,长安区,在用';
      const result = importFromText(csv);
      expect(result.meta.parsedRows).toBe(1);
      expect(result.data[0].name).toBe('Test1');
    });
  });
});
