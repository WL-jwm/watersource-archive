// 自动生成：归档提取的保护区精确边界多边形（来源 eia_gw_params.db / ws_corners 拐点闭合）
// 坐标为 WGS84，源自规划环评图件提取，标记为待核验
export interface ArchiveBoundary {
  sourceName: string;
  level: string;
  region: string;
  areaKm2: string;
  dataStatus: string;
  ring: Array<[number, number]>;
}

export const ARCHIVE_BOUNDARIES: ArchiveBoundary[] = [
  {
    "sourceName": "丽阳村水源地",
    "level": "一级保护区",
    "region": "石家庄市藁城区",
    "areaKm2": "",
    "dataStatus": "待核验(图件提取)",
    "ring": [
      [
        114.724253,
        37.956835
      ],
      [
        114.725336,
        37.956931
      ],
      [
        114.725337,
        37.955982
      ],
      [
        114.724422,
        37.955978
      ],
      [
        114.724426,
        37.956075
      ],
      [
        114.724262,
        37.956085
      ],
      [
        114.724253,
        37.956835
      ]
    ]
  },
  {
    "sourceName": "丽阳村水源地",
    "level": "准保护区",
    "region": "石家庄市藁城区",
    "areaKm2": "",
    "dataStatus": "待核验(图件提取)",
    "ring": [
      [
        114.722556,
        37.957861
      ],
      [
        114.72708,
        37.958162
      ],
      [
        114.727008,
        37.954739
      ],
      [
        114.722472,
        37.955112
      ],
      [
        114.722556,
        37.957861
      ]
    ]
  },
  {
    "sourceName": "献县水源地",
    "level": "一级保护区",
    "region": "沧州市献县",
    "areaKm2": "",
    "dataStatus": "待核验(图件提取)",
    "ring": [
      [
        116.068208,
        38.218119
      ],
      [
        116.068028,
        38.218653
      ],
      [
        116.071083,
        38.218997
      ],
      [
        116.071156,
        38.218469
      ],
      [
        116.068208,
        38.218119
      ]
    ]
  }
];
