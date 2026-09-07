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
        114.71829,
        37.956167
      ],
      [
        114.719371,
        37.956262
      ],
      [
        114.719372,
        37.955313
      ],
      [
        114.718458,
        37.95531
      ],
      [
        114.718462,
        37.955407
      ],
      [
        114.718299,
        37.955417
      ],
      [
        114.71829,
        37.956167
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
        114.716595,
        37.957196
      ],
      [
        114.721113,
        37.957492
      ],
      [
        114.721041,
        37.954068
      ],
      [
        114.716511,
        37.954446
      ],
      [
        114.716595,
        37.957196
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
        116.062113,
        38.217298
      ],
      [
        116.061933,
        38.217833
      ],
      [
        116.064984,
        38.218172
      ],
      [
        116.065057,
        38.217644
      ],
      [
        116.062113,
        38.217298
      ]
    ]
  }
];
