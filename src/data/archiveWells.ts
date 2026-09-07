// 自动生成：归档提取的水源井精确坐标（来源 eia_gw_params.db / ws_wells）
// 坐标源自规划环评图件提取，标记为待核验
export interface ArchiveWell {
  id: number;
  wellName: string;
  sourceName: string;
  lng: number;
  lat: number;
  coordSys: string;
  region: string;
  waterType: string;
  protectionLevel: string;
  depth?: number | null;
  yieldStr?: string;
  dataStatus: string;
}

export const ARCHIVE_WELLS: ArchiveWell[] = [
  {
    "id": 1,
    "wellName": "丽阳村取水井",
    "sourceName": "丽阳村水源地",
    "lng": 114.718805,
    "lat": 37.955771,
    "coordSys": "WGS84(待核验)",
    "region": "石家庄市藁城区",
    "waterType": "地下水(孔隙承压水)",
    "protectionLevel": "一级/准保护区",
    "depth": 500.0,
    "yieldStr": "200m³/h(日2800m³)",
    "dataStatus": "待核验"
  },
  {
    "id": 2,
    "wellName": "1#井",
    "sourceName": "献县水源地",
    "lng": 116.062386,
    "lat": 38.217635,
    "coordSys": "WGS84(待核验)",
    "region": "沧州献县",
    "waterType": "地下水",
    "protectionLevel": "一级保护区",
    "depth": null,
    "yieldStr": "",
    "dataStatus": "待核验"
  },
  {
    "id": 3,
    "wellName": "2#井",
    "sourceName": "献县水源地",
    "lng": 116.062915,
    "lat": 38.217697,
    "coordSys": "WGS84(待核验)",
    "region": "沧州献县",
    "waterType": "地下水",
    "protectionLevel": "一级保护区",
    "depth": null,
    "yieldStr": "",
    "dataStatus": "待核验"
  },
  {
    "id": 4,
    "wellName": "3#井",
    "sourceName": "献县水源地",
    "lng": 116.063439,
    "lat": 38.217749,
    "coordSys": "WGS84(待核验)",
    "region": "沧州献县",
    "waterType": "地下水",
    "protectionLevel": "一级保护区",
    "depth": null,
    "yieldStr": "",
    "dataStatus": "待核验"
  },
  {
    "id": 5,
    "wellName": "4#井",
    "sourceName": "献县水源地",
    "lng": 116.064091,
    "lat": 38.21782,
    "coordSys": "WGS84(待核验)",
    "region": "沧州献县",
    "waterType": "地下水",
    "protectionLevel": "一级保护区",
    "depth": null,
    "yieldStr": "",
    "dataStatus": "待核验"
  },
  {
    "id": 6,
    "wellName": "5#井",
    "sourceName": "献县水源地",
    "lng": 116.064676,
    "lat": 38.217889,
    "coordSys": "WGS84(待核验)",
    "region": "沧州献县",
    "waterType": "地下水",
    "protectionLevel": "一级保护区",
    "depth": null,
    "yieldStr": "",
    "dataStatus": "待核验"
  }
];
