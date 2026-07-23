/* ===== 行政区划选择器组件 ===== */
import React, { useState, useMemo } from 'react';
import { hebeiDivisions } from '@/data/hebeiDivisions';
import { useDivisionStore } from '@/stores/divisionStore';
import type { DivisionSelection } from '@/types/division';

// 县区类型标签颜色
function districtTypeBadge(type: string): string {
  switch (type) {
    case '市辖区':
      return 'badge-info';
    case '县级市':
      return 'badge-warning';
    case '自治县':
      return 'badge-success';
    default:
      return 'badge-neutral';
  }
}

// 乡镇类型标签颜色
function townshipTypeBadge(name: string): string {
  if (name.includes('街道')) return 'bg-blue-100 text-blue-700';
  if (name.includes('镇')) return 'bg-amber-100 text-amber-700';
  if (name.includes('民族')) return 'bg-green-100 text-green-700';
  return 'bg-gray-100 text-gray-700';
}

const DivisionSelector: React.FC = () => {
  const {
    selection,
    customDivisions,
    panelOpen,
    selectCity,
    selectDistrict,
    selectTownship,
    clearSelection,
    setPanelOpen,
    togglePanel,
  } = useDivisionStore();

  // P2-1: 懒加载乡镇数据（370KB）
  const [townshipData, setTownshipData] = useState<
    Record<
      string,
      Array<{
        name: string;
        code: string;
        type?: string;
        level?: string;
        parentCode?: string;
        cityCode?: string;
        districtCode?: string;
      }>
    >
  >({});
  React.useEffect(() => {
    import('@/data/hebeiTownships').then((m) => setTownshipData(m.townshipData));
  }, []);

  const [searchCity, setSearchCity] = useState('');
  const [searchDistrict, setSearchDistrict] = useState('');
  const [searchTownship, setSearchTownship] = useState('');
  const [activeTab, setActiveTab] = useState<'selector' | 'custom'>('selector');

  // 当前市对应的区县
  const currentDistricts = useMemo(() => {
    if (!selection.cityCode) return [];
    const city = hebeiDivisions.cities.find((c) => c.code === selection.cityCode);
    return city?.districts || [];
  }, [selection.cityCode]);

  // 当前区县对应的乡镇
  const currentTownships = useMemo(() => {
    if (!selection.districtName) return [];
    return townshipData[selection.districtName] || [];
  }, [selection.districtName]);

  // 过滤后的市列表
  const filteredCities = useMemo(() => {
    if (!searchCity.trim()) return hebeiDivisions.cities;
    const q = searchCity.toLowerCase();
    return hebeiDivisions.cities.filter(
      (c) => c.name.toLowerCase().includes(q) || c.code.includes(q),
    );
  }, [searchCity]);

  // 过滤后的区县列表
  const filteredDistricts = useMemo(() => {
    if (!searchDistrict.trim()) return currentDistricts;
    const q = searchDistrict.toLowerCase();
    return currentDistricts.filter((d) => d.name.toLowerCase().includes(q) || d.code.includes(q));
  }, [currentDistricts, searchDistrict]);

  // 过滤后的乡镇列表
  const filteredTownships = useMemo(() => {
    if (!searchTownship.trim()) return currentTownships;
    const q = searchTownship.toLowerCase();
    return currentTownships.filter((t) => t.name.toLowerCase().includes(q) || t.code.includes(q));
  }, [currentTownships, searchTownship]);

  // 统计信息
  const stats = useMemo(() => {
    const totalDistricts = hebeiDivisions.cities.reduce((sum, c) => sum + c.districts.length, 0);
    const totalTownships = Object.values(townshipData).reduce((sum, list) => sum + list.length, 0);
    return {
      cities: hebeiDivisions.cities.length,
      districts: totalDistricts,
      townships: totalTownships,
    };
  }, []);

  // 全路径
  const fullPath = useMemo(() => {
    return [selection.cityName, selection.districtName, selection.townshipName]
      .filter(Boolean)
      .join(' / ');
  }, [selection.cityName, selection.districtName, selection.townshipName]);

  if (!panelOpen) {
    return (
      <button
        onClick={togglePanel}
        className="fixed right-4 bottom-4 z-50 w-12 h-12 rounded-full bg-accent-500 text-white shadow-lg hover:bg-accent-600 transition-colors flex items-center justify-center"
        title="行政区划选择"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      </button>
    );
  }

  return (
    <div className="fixed right-4 bottom-4 z-50 w-[420px] max-h-[80vh] bg-surface rounded-xl shadow-2xl border border-surface-border flex flex-col overflow-hidden">
      {/* 面板头部 */}
      <div className="px-4 py-3 bg-accent-500 text-white flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
            />
          </svg>
          <span className="font-semibold text-sm">河北省行政区划</span>
        </div>
        <button
          onClick={() => setPanelOpen(false)}
          className="hover:bg-white/20 rounded p-1 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* Tab 切换 */}
      <div className="flex border-b border-surface-border shrink-0">
        <button
          onClick={() => setActiveTab('selector')}
          className={`flex-1 py-2.5 text-sm font-medium text-center transition-colors ${
            activeTab === 'selector'
              ? 'text-accent-500 border-b-2 border-accent-500 bg-accent-50/50'
              : 'text-text-secondary hover:text-text-primary hover:bg-surface-tertiary'
          }`}
        >
          区划选择
        </button>
        <button
          onClick={() => setActiveTab('custom')}
          className={`flex-1 py-2.5 text-sm font-medium text-center transition-colors ${
            activeTab === 'custom'
              ? 'text-accent-500 border-b-2 border-accent-500 bg-accent-50/50'
              : 'text-text-secondary hover:text-text-primary hover:bg-surface-tertiary'
          }`}
        >
          自定义补充
          {customDivisions.length > 0 && (
            <span className="ml-1.5 px-1.5 py-0.5 bg-accent-100 text-accent-600 text-[10px] rounded-full font-bold">
              {customDivisions.length}
            </span>
          )}
        </button>
      </div>

      {/* 统计条 */}
      <div className="px-4 py-2 bg-surface-tertiary/50 border-b border-surface-border shrink-0">
        <div className="flex items-center gap-4 text-xs text-text-secondary">
          <span>
            <strong className="text-text-primary">{stats.cities}</strong> 个设区市
          </span>
          <span>
            <strong className="text-text-primary">{stats.districts}</strong> 个县区
          </span>
          <span>
            <strong className="text-text-primary">{stats.townships}</strong> 个乡镇
          </span>
        </div>
        {fullPath && (
          <div className="mt-1.5 flex items-center gap-2">
            <span className="text-xs text-text-tertiary">当前选择:</span>
            <span className="text-xs font-medium text-accent-600 bg-accent-50 px-2 py-0.5 rounded">
              {fullPath}
            </span>
            <button
              onClick={clearSelection}
              className="text-xs text-text-tertiary hover:text-danger transition-colors ml-auto"
            >
              清除
            </button>
          </div>
        )}
      </div>

      {activeTab === 'selector' ? (
        /* ===== 区划选择 Tab ===== */
        <div className="flex-1 overflow-y-auto">
          {/* 一级：地级市 */}
          <div className="border-b border-surface-border">
            <div className="px-3 py-2 bg-surface-secondary/80 sticky top-0 z-10">
              <div className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider mb-1.5">
                地级市
              </div>
              <input
                type="text"
                value={searchCity}
                onChange={(e) => setSearchCity(e.target.value)}
                placeholder="搜索市..."
                className="input w-full text-xs py-1.5"
              />
            </div>
            <div className="px-3 pb-2 max-h-40 overflow-y-auto">
              <div className="grid grid-cols-2 gap-1">
                {filteredCities.map((city) => (
                  <button
                    key={city.code}
                    onClick={() => selectCity(city.code, city.name)}
                    className={`px-2 py-1.5 rounded-md text-xs text-left transition-colors ${
                      selection.cityCode === city.code
                        ? 'bg-accent-500 text-white font-semibold'
                        : 'hover:bg-surface-tertiary text-text-primary'
                    }`}
                  >
                    {city.name}
                    <span
                      className={`ml-1 text-[10px] ${selection.cityCode === city.code ? 'text-white/70' : 'text-text-tertiary'}`}
                    >
                      {city.districts.length}区
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 二级：县区 */}
          {selection.cityCode && (
            <div className="border-b border-surface-border">
              <div className="px-3 py-2 bg-surface-secondary/80 sticky top-0 z-10">
                <div className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider mb-1.5">
                  县级行政区划 -- {selection.cityName}
                </div>
                <input
                  type="text"
                  value={searchDistrict}
                  onChange={(e) => setSearchDistrict(e.target.value)}
                  placeholder="搜索区/县..."
                  className="input w-full text-xs py-1.5"
                />
              </div>
              <div className="px-3 pb-2 max-h-48 overflow-y-auto">
                <div className="space-y-1">
                  {filteredDistricts.map((district) => (
                    <button
                      key={district.code}
                      onClick={() => selectDistrict(district.code, district.name)}
                      className={`w-full px-2.5 py-2 rounded-md text-xs text-left transition-colors flex items-center justify-between ${
                        selection.districtCode === district.code
                          ? 'bg-accent-500 text-white'
                          : 'hover:bg-surface-tertiary text-text-primary'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span className="font-medium">{district.name}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded ${
                            selection.districtCode === district.code
                              ? 'bg-white/20'
                              : districtTypeBadge(district.type)
                          }`}
                        >
                          {district.type}
                        </span>
                      </span>
                      <span
                        className={`text-[10px] ${selection.districtCode === district.code ? 'text-white/70' : 'text-text-tertiary'}`}
                      >
                        {district.code}
                      </span>
                    </button>
                  ))}
                  {filteredDistricts.length === 0 && (
                    <div className="text-center py-3 text-xs text-text-tertiary">
                      未找到匹配的区县
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 三级：乡镇 */}
          {selection.districtCode && (
            <div>
              <div className="px-3 py-2 bg-surface-secondary/80 sticky top-0 z-10">
                <div className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider mb-1.5">
                  乡级行政区划 -- {selection.districtName}
                  <span className="ml-2 text-accent-500 font-bold">{currentTownships.length}</span>
                </div>
                <input
                  type="text"
                  value={searchTownship}
                  onChange={(e) => setSearchTownship(e.target.value)}
                  placeholder="搜索乡镇/街道..."
                  className="input w-full text-xs py-1.5"
                />
              </div>
              <div className="px-3 pb-3 max-h-52 overflow-y-auto">
                <div className="space-y-0.5">
                  {filteredTownships.map((t) => (
                    <button
                      key={t.code}
                      onClick={() => selectTownship(t.code, t.name)}
                      className={`w-full px-2.5 py-1.5 rounded-md text-xs text-left transition-colors flex items-center justify-between ${
                        selection.townshipCode === t.code
                          ? 'bg-accent-500 text-white'
                          : 'hover:bg-surface-tertiary text-text-primary'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span>{t.name}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded ${
                            selection.townshipCode === t.code
                              ? 'bg-white/20'
                              : townshipTypeBadge(t.name)
                          }`}
                        >
                          {t.type}
                        </span>
                      </span>
                      <span
                        className={`text-[10px] ${selection.townshipCode === t.code ? 'text-white/70' : 'text-text-tertiary'}`}
                      >
                        {t.code.slice(-3)}
                      </span>
                    </button>
                  ))}
                  {filteredTownships.length === 0 && (
                    <div className="text-center py-3 text-xs text-text-tertiary">
                      未找到匹配的乡镇
                      {searchTownship.trim() && (
                        <button
                          onClick={() => {
                            setActiveTab('custom');
                          }}
                          className="ml-2 text-accent-500 hover:underline"
                        >
                          去补充
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {!selection.cityCode && (
            <div className="px-4 py-8 text-center text-sm text-text-tertiary">
              <svg
                className="w-12 h-12 mx-auto mb-3 text-text-quaternary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
              </svg>
              请先选择地级市
            </div>
          )}
        </div>
      ) : (
        /* ===== 自定义补充 Tab ===== */
        <CustomDivisionPanel />
      )}
    </div>
  );
};

/* ===== 自定义补充面板 ===== */
const CustomDivisionPanel: React.FC = () => {
  const { customDivisions, addCustomDivision, deleteCustomDivision, exportCustom, importCustom } =
    useDivisionStore();
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formLevel, setFormLevel] = useState<'city' | 'district' | 'township'>('township');
  const [formParentCode, setFormParentCode] = useState('');
  const [formRemark, setFormRemark] = useState('');
  const [importError, setImportError] = useState('');

  const handleAdd = () => {
    if (!formName.trim()) return;
    addCustomDivision({
      code: formCode.trim(),
      name: formName.trim(),
      level: formLevel,
      parentCode: formParentCode.trim(),
      type: formLevel === 'township' ? '镇' : formLevel === 'district' ? '县' : '市',
      remark: formRemark.trim(),
    });
    setFormName('');
    setFormCode('');
    setFormRemark('');
    setShowForm(false);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        importCustom(reader.result as string);
        setImportError('');
      } catch {
        setImportError('导入失败：文件格式不正确');
      }
    };
    reader.readAsText(file);
  };

  const handleExport = () => {
    const data = exportCustom();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'custom-divisions.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  // 按层级分组
  const grouped = useMemo(() => {
    const groups: Record<string, typeof customDivisions> = {};
    for (const item of customDivisions) {
      const levelLabel =
        (
          { city: '市级', district: '县级', township: '乡镇级', province: '省级' } as Record<
            string,
            string
          >
        )[item.level] || item.level;
      if (!groups[levelLabel]) groups[levelLabel] = [];
      groups[levelLabel].push(item);
    }
    return groups;
  }, [customDivisions]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-4 py-3 space-y-3">
        {/* 操作按钮 */}
        <div className="flex gap-2">
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex-1 py-2 bg-accent-500 text-white text-xs font-medium rounded-lg hover:bg-accent-600 transition-colors"
          >
            {showForm ? '取消' : '+ 添加自定义区划'}
          </button>
          <button
            onClick={handleExport}
            className="px-3 py-2 bg-surface-tertiary text-text-secondary text-xs rounded-lg hover:bg-surface-border transition-colors"
            title="导出"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
          </button>
          <label
            className="px-3 py-2 bg-surface-tertiary text-text-secondary text-xs rounded-lg hover:bg-surface-border transition-colors cursor-pointer"
            title="导入"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
              />
            </svg>
            <input type="file" accept=".json" className="hidden" onChange={handleImport} />
          </label>
        </div>

        {importError && (
          <div className="text-xs text-danger bg-danger-50 px-3 py-2 rounded-lg">{importError}</div>
        )}

        {/* 添加表单 */}
        {showForm && (
          <div className="bg-surface-secondary rounded-lg p-3 space-y-2 border border-surface-border">
            <div className="text-xs font-semibold text-text-primary">新增行政区划</div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-text-tertiary">名称 *</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="如：某某乡"
                  className="input w-full text-xs mt-0.5"
                />
              </div>
              <div>
                <label className="text-[10px] text-text-tertiary">区划代码</label>
                <input
                  type="text"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value)}
                  placeholder="如：130435201"
                  className="input w-full text-xs mt-0.5"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-text-tertiary">层级</label>
                <select
                  value={formLevel}
                  onChange={(e) => setFormLevel(e.target.value as typeof formLevel)}
                  className="input w-full text-xs mt-0.5"
                >
                  <option value="township">乡镇级</option>
                  <option value="district">县级</option>
                  <option value="city">市级</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-text-tertiary">上级区划代码</label>
                <input
                  type="text"
                  value={formParentCode}
                  onChange={(e) => setFormParentCode(e.target.value)}
                  placeholder="如：130435"
                  className="input w-full text-xs mt-0.5"
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] text-text-tertiary">备注</label>
              <input
                type="text"
                value={formRemark}
                onChange={(e) => setFormRemark(e.target.value)}
                placeholder="选填，说明补充原因"
                className="input w-full text-xs mt-0.5"
              />
            </div>
            <button
              onClick={handleAdd}
              disabled={!formName.trim()}
              className="w-full py-2 bg-accent-500 text-white text-xs font-medium rounded-lg hover:bg-accent-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              确认添加
            </button>
          </div>
        )}

        {/* 已有自定义区划 */}
        {customDivisions.length === 0 ? (
          <div className="text-center py-6 text-xs text-text-tertiary">
            <svg
              className="w-10 h-10 mx-auto mb-2 text-text-quaternary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
            暂无自定义区划
            <br />
            <span className="text-[10px]">当预设数据不足时可在此补充</span>
          </div>
        ) : (
          <div className="space-y-3">
            {Object.entries(grouped).map(([levelLabel, items]) => (
              <div key={levelLabel}>
                <div className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider mb-1">
                  {levelLabel} ({items.length})
                </div>
                <div className="space-y-1">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between px-2.5 py-2 bg-surface-secondary rounded-lg"
                    >
                      <div>
                        <div className="text-xs font-medium text-text-primary">{item.name}</div>
                        <div className="text-[10px] text-text-tertiary">
                          {item.code && <span>代码: {item.code}</span>}
                          {item.parentCode && <span> / 上级: {item.parentCode}</span>}
                          {item.remark && <span className="text-accent-500"> / {item.remark}</span>}
                        </div>
                      </div>
                      <button
                        onClick={() => deleteCustomDivision(item.id)}
                        className="text-text-tertiary hover:text-danger transition-colors p-1"
                        title="删除"
                      >
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DivisionSelector;
