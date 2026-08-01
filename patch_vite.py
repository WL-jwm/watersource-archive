"""S9.3: Add visualizer plugin to vite.config.ts"""

path = 'vite.config.ts'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Add import
content = content.replace(
    "import path from 'path';\r\n",
    "import path from 'path';\r\nimport { visualizer } from 'rollup-plugin-visualizer';\r\n",
    1,
)

# Replace plugins array
content = content.replace(
    "  plugins: [react()],\r\n",
    "  plugins: [\r\n    react(),\r\n    visualizer({\r\n      filename: 'dist/stats.html',\r\n      gzipSize: true,\r\n      brotliSize: true,\r\n      template: 'treemap',\r\n    }),\r\n  ],\r\n",
    1,
)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("OK: visualizer added to vite.config.ts")
