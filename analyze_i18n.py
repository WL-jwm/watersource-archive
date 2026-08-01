#!/usr/bin/env python3
"""Classify Chinese hardcoded lines into categories"""
import re, glob

categories = {'comment': 0, 'data': 0, 'jsx_text': 0, 'string_literal': 0, 'other': 0}
jsx_examples = []
str_examples = []

patterns = [
    'src/pages/*.tsx',
    'src/components/*.tsx',
    'src/components/protection-zone/*.tsx',
    'src/components/map/*.tsx',
    'src/components/dashboard/*.tsx',
    'src/components/home/*.tsx',
]

for pat in patterns:
    for f in glob.glob(pat):
        with open(f, 'r', encoding='utf-8') as fh:
            for line in fh:
                stripped = line.strip()
                if not re.search(r'[\u4e00-\u9fff]', stripped):
                    continue
                if stripped.startswith('//') or stripped.startswith('/*') or stripped.startswith('*'):
                    categories['comment'] += 1
                elif re.search(r"[市县区镇].*[市县区镇]", stripped) and ('<' not in stripped):
                    categories['data'] += 1
                elif '>' in stripped and '<' in stripped:
                    categories['jsx_text'] += 1
                    if len(jsx_examples) < 10:
                        jsx_examples.append(f"{f}: {stripped[:80]}")
                elif stripped.startswith("'") or stripped.startswith('"') or stripped.startswith('`'):
                    categories['string_literal'] += 1
                    if len(str_examples) < 10:
                        str_examples.append(f"{f}: {stripped[:80]}")
                else:
                    categories['other'] += 1

total = sum(categories.values())
print(f"Total Chinese lines: {total}")
for k, v in sorted(categories.items(), key=lambda x: -x[1]):
    pct = v / total * 100 if total else 0
    print(f"  {k:20s}: {v:4d} ({pct:.1f}%)")

print("\n--- JSX text examples ---")
for s in jsx_examples:
    print(s)

print("\n--- String literal examples ---")
for s in str_examples:
    print(s)
