#!/bin/bash
# ============================================================
# watersource-archive 一键构建部署脚本
# 用法: bash scripts/build-deploy.sh [target]
#   target:
#     build    - 仅构建 (默认)
#     preview  - 构建并启动本地预览服务器
#     deploy   - 构建并打包为部署zip
# ============================================================

set -e

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DIST_DIR="$PROJECT_DIR/dist"
DEPLOY_ZIP="$PROJECT_DIR/deploy/watersource-archive.zip"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "========================================="
echo "  水源地保护区档案管理平台 - 构建部署"
echo "========================================="
echo ""

TARGET="${1:-build}"

# 1. 清理旧产物
echo "[1/4] 清理旧构建产物..."
rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR"

# 2. 构建
echo "[2/4] Vite 构建..."
cd "$PROJECT_DIR"
node node_modules/vite/bin/vite.js build

# 3. 后处理：移除 crossorigin (file://协议兼容)
echo "[3/4] 后处理：移除 crossorigin..."
if [ -f "$DIST_DIR/index.html" ]; then
  sed -i 's/ crossorigin//g' "$DIST_DIR/index.html"
  echo "  crossorigin 已移除"
fi

# 4. 生成版本信息
echo "[4/4] 生成版本信息..."
cat > "$DIST_DIR/version.json" << EOF
{
  "name": "watersource-archive",
  "version": "1.0.0",
  "buildTime": "$(date -Iseconds)",
  "chunks": $(ls -la "$DIST_DIR/assets/" | wc -l)
}
EOF

echo ""
echo "========================================="
echo "  构建完成！"
echo "  输出目录: $DIST_DIR"
echo "  文件列表:"
ls -lh "$DIST_DIR/assets/" 2>/dev/null || echo "  (无assets目录)"
echo ""

# 根据目标执行后续操作
case "$TARGET" in
  preview)
    echo "启动本地预览服务器 (端口50880)..."
    echo "访问: http://localhost:50880/"
    cd "$DIST_DIR"
    python -m http.server 50880
    ;;
  deploy)
    echo "打包部署文件..."
    mkdir -p "$PROJECT_DIR/deploy"
    cd "$PROJECT_DIR"
    rm -f "$DEPLOY_ZIP"
    python -c "
import zipfile, os
zipf = zipfile.ZipFile('$DEPLOY_ZIP', 'w', zipfile.ZIP_DEFLATED)
for root, dirs, files in os.walk('dist'):
    for f in files:
        fp = os.path.join(root, f)
        arcname = os.path.relpath(fp, 'dist')
        zipf.write(fp, arcname)
zipf.close()
"
    echo ""
    echo "部署包: $DEPLOY_ZIP"
    echo "大小: $(ls -lh "$DEPLOY_ZIP" | awk '{print $5}')"
    echo ""
    echo "部署方式:"
    echo "  1. 上传 dist/ 目录到Web服务器根目录"
    echo "  2. 配置 Nginx/Apache 指向 dist/ 目录"
    echo "  3. 或解压 deploy/watersource-archive.zip"
    ;;
  build)
    echo "构建完成。运行以下命令预览:"
    echo "  cd $DIST_DIR && python -m http.server 50880"
    echo ""
    echo "或执行: npm run preview"
    ;;
esac
