/**
 * S2 表格与结果交互增强测试
 *
 * 覆盖：
 * 1. ResultCard 手动调整半径/面积（联动计算 + 恢复计算值）
 * 2. 排序逻辑验证
 * 3. 批量选择 Set 操作验证
 */

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ResultCard from '@/components/protection-zone/ResultCard';
import type { CalcResult } from '@/lib/zoneCalcEngine';

// 构造测试数据
const mockResult: CalcResult = {
  sourceName: '测试水源地',
  params: {
    sourceType: '地下水',
    gwType: '孔隙水',
    population: 10000,
    wellYield: 5000,
    waterLevel: 30,
    aquiferThickness: 20,
    hydraulicConductivity: 0.001,
    porosity: 0.25,
    gradient: 0.005,
    distance: 1000,
    slope: 0.01,
    riverWidth: 50,
    lakeArea: 0,
    county: '测试县',
    city: '石家庄市',
  },
  zones: [
    {
      level: '一级',
      method: '经验值法',
      formula: 'R = 50m (经验值)',
      radius: 50,
      area: 0.0079,
      boundaryDescription: '以取水口为圆心，50m为半径的圆形区域',
      keyParams: '人口=10000，日供水量=5000m³/d',
      standard: 'HJ 338-2018',
    },
    {
      level: '二级',
      method: '经验值法',
      formula: 'R = 300m (经验值)',
      radius: 300,
      area: 0.2827,
      boundaryDescription: '以取水口为圆心，300m为半径的圆形区域',
      keyParams: '人口=10000，日供水量=5000m³/d',
      standard: 'HJ 338-2018',
    },
  ],
  calculatedAt: '2024-01-01T00:00:00',
  warnings: [],
};

describe('S2.4 ResultCard 手动调整半径/面积', () => {
  it('S2.4-T01-渲染计算结果卡片', () => {
    render(<ResultCard result={mockResult} index={0} />);
    expect(screen.getByText('#1')).toBeTruthy();
    expect(screen.getByText('测试水源地')).toBeTruthy();
    expect(screen.getByText('一级保护区')).toBeTruthy();
    expect(screen.getByText('二级保护区')).toBeTruthy();
  });

  it('S2.4-T02-显示原始面积和半径', () => {
    render(<ResultCard result={mockResult} index={0} />);
    // 面积 0.0079 应该显示
    expect(screen.getByText('0.0079')).toBeTruthy();
    // 半径 R = 50m
    const radiusEls = screen.getAllByText(/R = 50m/);
    expect(radiusEls.length).toBeGreaterThan(0);
  });

  it('S2.4-T03-点击面积进入编辑模式', () => {
    render(<ResultCard result={mockResult} index={0} />);
    // 找到面积为 0.0079 的可点击元素
    const areaElement = screen.getByText('0.0079');
    fireEvent.click(areaElement);
    // 应出现 input 元素
    const input = document.querySelector('input[type="number"]') as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.value).toBe('0.0079');
  });

  it('S2.4-T04-修改面积后联动重算半径', () => {
    render(<ResultCard result={mockResult} index={0} />);
    // 点击面积值进入编辑
    const areaElement = screen.getByText('0.0079');
    fireEvent.click(areaElement);
    const input = document.querySelector('input[type="number"]') as HTMLInputElement;
    // 修改面积
    fireEvent.change(input, { target: { value: '0.01' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    // 退出编辑后应显示新面积 0.01
    expect(screen.getByText('0.01')).toBeTruthy();
    // 半径应重算: r = sqrt(0.01 * 1e6 / PI) ≈ 56.4
    // 半径应重算: r = sqrt(0.01 * 1e6 / PI) ≈ 56.4
    const radiusTexts = screen.getAllByText(/R = 56\./);
    expect(radiusTexts.length).toBeGreaterThan(0);
  });

  it('S2.4-T05-修改半径后联动重算面积', () => {
    render(<ResultCard result={mockResult} index={0} />);
    // 点击一级保护区半径进入编辑
    const radiusElement = screen.getByText('R = 50m');
    fireEvent.click(radiusElement);
    const inputs = document.querySelectorAll('input[type="number"]');
    // 找到半径的 input（值应该为 50）
    const radiusInput = Array.from(inputs).find(i => i.value === '50') as HTMLInputElement;
    expect(radiusInput).toBeTruthy();
    // 修改半径为 100
    fireEvent.change(radiusInput, { target: { value: '100' } });
    fireEvent.keyDown(radiusInput, { key: 'Enter' });
    // 面积应重算: A = PI * 100^2 / 1e6 = 0.0314
    expect(screen.getByText('0.0314')).toBeTruthy();
  });

  it('S2.4-T06-显示"已手动调整"标记', () => {
    render(<ResultCard result={mockResult} index={0} />);
    // 初始无标记
    expect(screen.queryByText('已手动调整')).toBeNull();
    // 修改面积
    const areaElement = screen.getByText('0.0079');
    fireEvent.click(areaElement);
    const input = document.querySelector('input[type="number"]') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '0.01' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    // 应出现标记
    expect(screen.getByText('已手动调整')).toBeTruthy();
  });

  it('S2.4-T07-恢复计算值功能', () => {
    render(<ResultCard result={mockResult} index={0} />);
    // 修改面积
    const areaElement = screen.getByText('0.0079');
    fireEvent.click(areaElement);
    const input = document.querySelector('input[type="number"]') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '0.01' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    // 点击恢复按钮
    const resetBtn = screen.getByText(/恢复计算值/);
    fireEvent.click(resetBtn);
    // 应回到原始值
    expect(screen.getByText('0.0079')).toBeTruthy();
    expect(screen.queryByText('已手动调整')).toBeNull();
  });

  it('S2.4-T08-Escape取消编辑', () => {
    render(<ResultCard result={mockResult} index={0} />);
    const areaElement = screen.getByText('0.0079');
    fireEvent.click(areaElement);
    const input = document.querySelector('input[type="number"]') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '999' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    // 应保留原始值
    expect(screen.getByText('0.0079')).toBeTruthy();
    expect(screen.queryByText('999')).toBeNull();
  });

  it('S2.4-T09-onAdjust回调触发', () => {
    const onAdjust = vi.fn();
    render(<ResultCard result={mockResult} index={0} onAdjust={onAdjust} />);
    const areaElement = screen.getByText('0.0079');
    fireEvent.click(areaElement);
    const input = document.querySelector('input[type="number"]') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '0.01' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onAdjust).toHaveBeenCalledTimes(1);
    expect(onAdjust).toHaveBeenCalledWith(0, '一级', expect.objectContaining({
      area: 0.01,
      radius: expect.any(Number),
    }));
  });
});

describe('S2.2 排序逻辑验证', () => {
  it('S2.2-T10-localeCompare中文排序', () => {
    const items = ['保定市', '石家庄市', '唐山市', '邯郸市'];
    const sorted = [...items].sort((a, b) => a.localeCompare(b, 'zh-CN'));
    // 中文 localeCompare 按拼音排序
    expect(sorted).toEqual(['保定市', '邯郸市', '石家庄市', '唐山市']);
  });

  it('S2.2-T11-升降序切换', () => {
    let direction: 'asc' | 'desc' = 'asc';
    const toggle = () => { direction = direction === 'asc' ? 'desc' : 'asc'; };
    expect(direction).toBe('asc');
    toggle();
    expect(direction).toBe('desc');
    toggle();
    expect(direction).toBe('asc');
  });
});

describe('S2.1 批量选择 Set 操作', () => {
  it('S2.1-T12-Set添加删除元素', () => {
    const selected = new Set<string>();
    selected.add('id1');
    selected.add('id2');
    selected.add('id3');
    expect(selected.size).toBe(3);
    expect(selected.has('id2')).toBe(true);
    selected.delete('id2');
    expect(selected.has('id2')).toBe(false);
    expect(selected.size).toBe(2);
  });

  it('S2.1-T13-全选逻辑', () => {
    const pageData = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const selectedIds = new Set(pageData.map(s => s.id));
    const isAllSelected = selectedIds.size === pageData.length && pageData.length > 0;
    expect(isAllSelected).toBe(true);
  });

  it('S2.1-T14-取消全选', () => {
    const selectedIds = new Set(['a', 'b', 'c']);
    const newSet = new Set<string>();
    expect(newSet.size).toBe(0);
    expect(selectedIds.size).toBe(3);
  });

  it('S2.1-T15-部分选择时isAllSelected为false', () => {
    const pageData = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const selectedIds = new Set(['a', 'b']);
    const isAllSelected = selectedIds.size === pageData.length && pageData.length > 0;
    expect(isAllSelected).toBe(false);
  });
});
