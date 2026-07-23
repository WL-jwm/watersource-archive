#!/bin/bash
# 本地 CI 验证脚本 — 模拟 GitHub Actions 的质量门禁
# 用法: bash scripts/ci.sh

set -e
cd "$(dirname "$0")/.."

echo "===== 1/5 TypeScript 类型检查 ====="
npx tsc --noEmit
echo "✓ tsc --noEmit 通过"

echo ""
echo "===== 2/5 ESLint 检查 ====="
npx eslint src --ext .ts,.tsx
echo "✓ ESLint 无 error"

echo ""
echo "===== 3/5 Prettier 格式检查 ====="
npx prettier --check "src/**/*.{ts,tsx,css,json,md}"
echo "✓ Prettier 检查通过"

echo ""
echo "===== 4/5 单元测试 ====="
npx vitest run
echo "✓ 全部测试通过"

echo ""
echo "===== 5/5 生产构建 ====="
npx vite build
echo "✓ 构建成功"

echo ""
echo "========== CI 全部通过 =========="
