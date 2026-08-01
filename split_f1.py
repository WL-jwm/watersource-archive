"""
F1 大文件拆分脚本
将 ReportDetail.tsx, Dashboard.tsx, Home.tsx 拆分为子组件
"""
import re
import os

BASE = r"F:\Claw\20260430-17-06-02-805\20260508-14-56-40-793\watersource-archive\src"

def read_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        return f.read()

def write_file(path, content):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

def extract_lines(lines, start, end):
    """提取 1-based 行号范围的行"""
    return '\n'.join(lines[start-1:end])

# ============================================================
# 1. ReportDetail.tsx 拆分
# ============================================================
def split_report_detail():
    path = os.path.join(BASE, 'pages', 'ReportDetail.tsx')
    content = read_file(path)
    lines = content.split('\n')
    
    # 子组件目录
    out_dir = os.path.join(BASE, 'components', 'report-tabs')
    
    # 提取共享导入
    shared_imports = """import React from 'react';
import {
  formatNumber,
  formatYield,
  formatArea,
  getTotalZoneArea,
  getTotalZonePoints,
  getClassColor,
} from '@/utils/helpers';
import type { WaterSource } from '@/types';
"""
    
    # BasicInfo: 336-440
    basic = extract_lines(lines, 337, 440)
    write_file(os.path.join(out_dir, 'BasicInfo.tsx'),
        shared_imports + '\n' + basic + '\n')
    
    # WellsInfo: 441-522
    wells = extract_lines(lines, 442, 522)
    write_file(os.path.join(out_dir, 'WellsInfo.tsx'),
        shared_imports + '\n' + wells + '\n')
    
    # HydrogeologyInfo: 523-649
    hydro = extract_lines(lines, 524, 649)
    write_file(os.path.join(out_dir, 'HydrogeologyInfo.tsx'),
        shared_imports + '\n' + hydro + '\n')
    
    # WaterQualityInfo: 650-862
    wq = extract_lines(lines, 651, 862)
    write_file(os.path.join(out_dir, 'WaterQualityInfo.tsx'),
        shared_imports + '\n' + wq + '\n')
    
    # ProtectionInfo: 863-968 (uses CoordinatePreview)
    prot = extract_lines(lines, 864, 968)
    prot_imports = shared_imports.rstrip() + "\nimport CoordinatePreview from './CoordinatePreview';\n"
    write_file(os.path.join(out_dir, 'ProtectionInfo.tsx'),
        prot_imports + '\n' + prot + '\n')
    
    # PollutionInfo: 969-1063
    poll = extract_lines(lines, 970, 1063)
    write_file(os.path.join(out_dir, 'PollutionInfo.tsx'),
        shared_imports + '\n' + poll + '\n')
    
    # CoordinatePreview: 1064-1208
    coord = extract_lines(lines, 1065, 1208)
    coord_imports = "import React from 'react';\n"
    # Remove the export default at the end (it belongs to the main file)
    coord_clean = coord.replace('\nexport default ReportDetail;', '')
    write_file(os.path.join(out_dir, 'CoordinatePreview.tsx'),
        coord_imports + '\n' + coord_clean + '\n')
    
    print("ReportDetail: 7 sub-components extracted")

# ============================================================
# 2. Home.tsx 拆分
# ============================================================
def split_home():
    path = os.path.join(BASE, 'pages', 'Home.tsx')
    content = read_file(path)
    lines = content.split('\n')
    
    out_dir = os.path.join(BASE, 'components', 'home')
    
    # WaterSourceItem: 578-618
    wsi = extract_lines(lines, 578, 618)
    wsi_imports = """import React from 'react';
import type { WaterSourceInfo } from '@/types';
"""
    write_file(os.path.join(out_dir, 'WaterSourceItem.tsx'),
        wsi_imports + '\n' + wsi + '\n')
    
    # ReportCard: 620-718
    rc = extract_lines(lines, 620, 718)
    rc_imports = """import React from 'react';
import { useAppStore } from '@/stores/appStore';
import { formatYield } from '@/utils/helpers';
import type { WaterSource } from '@/types';
import SourceCard from './SourceCard';
"""
    # Fix the report type - use a simpler type
    rc_clean = rc.replace(
        "report: ReturnType<typeof useAppStore.getState>['reports'][number];",
        "report: import('@/types').WaterSourceReport;"
    )
    write_file(os.path.join(out_dir, 'ReportCard.tsx'),
        rc_imports + '\n' + rc_clean + '\n')
    
    # SourceCard: 720-852 (before export default)
    sc = extract_lines(lines, 720, 852)
    sc_imports = """import React from 'react';
import { formatYield } from '@/utils/helpers';
import type { WaterSource } from '@/types';
"""
    write_file(os.path.join(out_dir, 'SourceCard.tsx'),
        sc_imports + '\n' + sc + '\n')
    
    print("Home: 3 sub-components extracted")

# ============================================================
# Run
# ============================================================
split_report_detail()
split_home()
print("Done!")
