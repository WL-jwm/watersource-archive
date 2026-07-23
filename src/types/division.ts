/* ===== 行政区划类型定义 ===== */

// 行政区划层级
export type DivisionLevel = 'province' | 'city' | 'district' | 'township';

// 乡镇类型
export type TownshipType = '街道' | '镇' | '乡' | '民族乡' | '苏木' | '民族苏木';

// 基础行政区划单元
export interface DivisionItem {
  code: string; // 6位或9位/12位行政区划代码
  name: string; // 名称
  level: DivisionLevel;
  parentCode: string; // 上级区划代码
}

// 市级行政区划
export interface CityDivision extends DivisionItem {
  level: 'city';
  districts: DistrictDivision[];
}

// 县级行政区划
export interface DistrictDivision extends DivisionItem {
  level: 'district';
  type: '市辖区' | '县级市' | '县' | '自治县';
  cityCode: string; // 所属市代码
  townships: TownshipDivision[];
}

// 乡镇级行政区划
export interface TownshipDivision extends DivisionItem {
  level: 'township';
  type: TownshipType;
  cityCode: string; // 所属市代码
  districtCode: string; // 所属县区代码
}

// 省级框架
export interface ProvinceDivision {
  code: string;
  name: string;
  level: 'province';
  cities: CityDivision[];
}

// 用户自定义行政区划（补充入口）
export interface CustomDivision {
  id: string;
  code: string;
  name: string;
  level: DivisionLevel;
  parentCode: string;
  type?: string;
  createdAt: string;
  updatedAt: string;
  remark: string;
}

// 行政区划选择状态
export interface DivisionSelection {
  cityCode: string | null;
  cityName: string | null;
  districtCode: string | null;
  districtName: string | null;
  townshipCode: string | null;
  townshipName: string | null;
}

// 行政区划统计
export interface DivisionStats {
  totalCities: number;
  totalDistricts: number;
  totalTownships: number;
  districtsByCity: Record<string, number>;
  townshipsByCity: Record<string, number>;
  townshipsByDistrict: Record<string, number>;
}
