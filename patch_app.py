"""S9.1: Patch App.tsx — add PageErrorBoundary to routes + global error handlers"""

path = 'src/App.tsx'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add imports
old_imports = "import ErrorBoundary from '@/components/ErrorBoundary';"
new_imports = """import ErrorBoundary from '@/components/ErrorBoundary';
import PageErrorBoundary from '@/components/PageErrorBoundary';
import { installGlobalErrorHandlers } from '@/lib/errorReporter';"""

content = content.replace(old_imports, new_imports, 1)

# 2. Add useEffect for global error handlers installation
# Find the App component function body
old_app_start = """const App: React.FC = () => {
  return ("""
new_app_start = """const App: React.FC = () => {
  React.useEffect(() => {
    installGlobalErrorHandlers();
  }, []);

  return ("""

content = content.replace(old_app_start, new_app_start, 1)

# 3. Wrap each Route element with PageErrorBoundary
# Pattern: <Route path="..." element={<PageName />} />
import re

def wrap_route(match):
    path = match.group(1)
    page = match.group(2)
    # Map route paths to page names
    page_names = {
        '/': '首页',
        '/map': '地图视图',
        '/dashboard': '仪表盘',
        '/manage': '水源地管理',
        '/zone-calc': '保护区计算',
        '/analysis': '项目分析',
        '/versions': '版本历史',
        '/report/:id': '报告详情',
        '/divisions': '区划概览',
        '/audit': '审计日志',
        '/overlay': '叠加分析',
    }
    name = page_names.get(path, page)
    return '<Route path="' + path + '" element={<PageErrorBoundary pageName="' + name + '"><' + page + ' /></PageErrorBoundary>} />'

content = re.sub(
    r'<Route path="([^"]+)" element={<(\w+) \/\>} />',
    wrap_route,
    content,
)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("OK: App.tsx patched with PageErrorBoundary + global error handlers")
