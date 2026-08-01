"""S9.1: Patch idb.ts — upgrade DB_VERSION and add error_logs store"""

path = 'src/lib/idb.ts'

with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# 1. 升级 DB_VERSION (line 14)
for i, line in enumerate(lines):
    if 'const DB_VERSION = 2;' in line:
        lines[i] = line.replace('2', '3') + ' // S9.1: error_logs store\n'
        # Remove the original newline that's already in the string
        lines[i] = "const DB_VERSION = 3; // S9.1: error_logs store\n"
        break

# 2. Find the overlay_analyses closing brace and add error_logs store after it
# Look for line 63: '    };' which closes onupgradeneeded
# Actually we need to find the closing of the if block for overlay_analyses
# Lines 58-62 are the overlay_analyses block, line 63 is '    };' closing onupgradeneeded
# We need to insert before line 63

insert_after = None
for i, line in enumerate(lines):
    if "createIndex('analysisName', 'analysisName'" in line:
        # Find the closing } of this if block
        for j in range(i+1, min(i+5, len(lines))):
            if lines[j].strip() == '}':
                insert_after = j
                break
        break

if insert_after is not None:
    new_store_code = """
      // 错误日志表（S9.1）
      if (!db.objectStoreNames.contains('error_logs')) {
        const errorStore = db.createObjectStore('error_logs', { keyPath: 'id' });
        errorStore.createIndex('timestamp', 'timestamp', { unique: false });
        errorStore.createIndex('level', 'level', { unique: false });
        errorStore.createIndex('source', 'source', { unique: false });
      }
"""
    lines.insert(insert_after + 1, new_store_code)

with open(path, 'w', encoding='utf-8') as f:
    f.writelines(lines)

print("OK: idb.ts patched")
