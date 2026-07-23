/* ===== 水源地保护区档案管理平台 - 类型定义 ===== */

// ===== 技术报告 =====
export interface WaterSourceReport {
  id: string;
  reportName: string;
  reportVersion: string;
  reportDate: string;
  approvalDoc: string;
  approvalDate: string;
  entrustUnit: string;
  compileUnit: string;
  region: string;
  regionCode: string;
  overview: string;
  waterSources: WaterSource[];
  createdAt: string;
  updatedAt: string;
}

// ===== 水源地 =====
export interface WaterSource {
  id: string;
  name: string;
  code: string;
  type: string;
  subType: string;
  rechargeType: string;
  location: string;
  servicePopulation: number;
  dailyYield: number;
  annualYield: number;
  exploitationStatus: string;
  wells: Well[];
  hydrogeology: Hydrogeology;
  waterQuality: WaterQuality;
  protectionZones: ProtectionZone[];
  pollutionSources: PollutionSource[];
  standardizationRequirements: string[];
}

// ===== 水井 =====
export interface Well {
  id: string;
  wellNumber: string;
  wellCode: string;
  longitude: number;
  latitude: number;
  wellDepth: number;
  casingMaterial: string;
  screenMaterial: string;
  wellDiameter: number;
  screenInterval: string;
  yieldAtDrawdown: string;
  staticWaterLevel: number;
  completionDate: string;
  expectedLife: string;
  status: string;
  remarks: string;
}

// ===== 水文地质条件 =====
export interface Hydrogeology {
  aquiferType: string;
  lithology: string;
  aquiferThickness: number;
  aquiferDepth: string;
  permeabilityCoeff: string;
  transmissivity: string;
  hydraulicGradient: string;
  rechargeConditions: string;
  runoffConditions: string;
  dischargeConditions: string;
  groundwaterFlowDirection: string;
  aquiferStructure: string;
  confiningBed: string;
}

// ===== 水质监测 =====
export interface WaterQualityItem {
  paramName: string;
  unit: string;
  standardValue: number;
  monitoringValue: string;
  standardIndex: number;
  isQualified: boolean;
  qualifiedClass: string; // III类/IV类/V类等
}

export interface WaterQuality {
  monitoringDate: string;
  monitoringPoints: string[];
  totalItems: number;
  qualifiedItems: number;
  qualifiedRate: number;
  evaluation: string;
  items: WaterQualityItem[];
}

// ===== 保护区 =====
export interface ProtectionZone {
  id: string;
  level: string;
  area: number;
  boundaryDescription: string;
  boundaryType: string;
  boundaryPoints: BoundaryPoint[];
}

export interface BoundaryPoint {
  pointNumber: number;
  longitude: number;
  latitude: number;
  description: string;
}

// ===== 污染源 =====
export interface PollutionSource {
  id: string;
  category: string;
  description: string;
  impact: string;
  riskLevel: string;
  mitigationMeasures: string;
}

// ===== 应用状态 =====
export type TabId =
  'basic' | 'wells' | 'hydrogeology' | 'waterquality' | 'protection' | 'pollution';

export interface AppState {
  reports: WaterSourceReport[];
  selectedReportId: string | null;
  selectedSourceId: string | null;
  activeTab: TabId;
  searchQuery: string;
  sidebarCollapsed: boolean;

  // Actions
  addReport: (report: WaterSourceReport) => void;
  updateReport: (id: string, report: Partial<WaterSourceReport>) => void;
  deleteReport: (id: string) => void;
  setSelectedReportId: (id: string | null) => void;
  setSelectedSourceId: (id: string | null) => void;
  setActiveTab: (tab: TabId) => void;
  setSearchQuery: (query: string) => void;
  toggleSidebar: () => void;
  exportData: () => string;
  importData: (json: string) => void;
}

// ===== 水源地名录信息（简化版，用于省级数据库展示） =====
export interface WaterSourceInfo {
  /** 水源地名称 */
  name: string;
  /** 水源类型：地表水/地下水 */
  type: '地表水' | '地下水';
  /** 细分类型：湖库型/孔隙水/岩溶水/南水北调等 */
  subType?: string;
  /** 所在县区 */
  county: string;
  /** 使用状态 */
  status:
    '在用' | '备用' | '取消' | '规划' | '热备用' | '在建' | '应急' | '停用' | '已取消' | '已撤销';
  /** 备注 */
  remark?: string;
}
