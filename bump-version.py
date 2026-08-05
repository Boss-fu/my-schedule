#!/usr/bin/env python3
"""
Stamps every local script/stylesheet reference across the site with one
shared, fresh version string, and adds a query string to any reference that
had none at all.

Run this before every deploy. Some files (supabase-config.js, boot-check.js,
pwa.js, vendor/supabase.js, and index.html's own auth.js tag) previously had
no version string whatsoever, so a browser or CDN was free to cache them
indefinitely on whatever Cache-Control the host happens to send. Editing the
file's contents does nothing to force a refetch if its URL never changes —
that mismatch is exactly what caused fixed bugs to keep reappearing for
anyone whose browser still held the old copy.
"""
import re
import sys
import time

LOCAL_JS_CSS = re.compile(
    r'((?:src|href)=")((?!https?:|//)[\w./-]+\.(?:js|css))(\?[^"]*)?(")'
)

PAGES = ['index.html', 'teacher.html', 'parent.html', 'parent-preview.html']

def main():
    version = time.strftime('%Y%m%d%H%M%S')
    if len(sys.argv) > 1:
        version = sys.argv[1]

    total = 0
    for name in PAGES:
        try:
            with open(name, encoding='utf-8') as f:
                content = f.read()
        except FileNotFoundError:
            continue

        def repl(m):
            nonlocal total
            total += 1
            return f'{m.group(1)}{m.group(2)}?v={version}{m.group(4)}'

        new_content = LOCAL_JS_CSS.sub(repl, content)
        if new_content != content:
            with open(name, 'w', encoding='utf-8') as f:
                f.write(new_content)

    print(f'Stamped {total} local asset references with v={version}')

if __name__ == '__main__':
    main()
