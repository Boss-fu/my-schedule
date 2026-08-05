#!/usr/bin/env python3
"""
Stamps every local script/stylesheet/iframe reference across the site with
one shared, fresh version string, and adds one to any reference that had
none at all.

Run this before every deploy. Some files (supabase-config.js, boot-check.js,
pwa.js, vendor/supabase.js, index.html's own auth.js tag, and the
parent-preview.html / index.html iframe src attributes) previously had no
version string, or kept a stale one, so a browser or CDN was free to cache
them well past whatever the host's Cache-Control says. Editing a file's
contents does nothing to force a refetch if the URL requesting it never
changes — that mismatch is exactly what let fixed bugs keep reappearing for
anyone whose browser still held an old copy.
"""
import re
import sys
import time

# src="foo.js"  src="foo.js?old"  href="foo.css?old"
LOCAL_JS_CSS = re.compile(
    r'((?:src|href)=")((?!https?:|//)[\w./-]+\.(?:js|css))(\?[^"]*)?(")'
)

# src="foo.html"  src="foo.html?a=b"  src="foo.html?a=b&v=old"
LOCAL_HTML = re.compile(
    r'(src="(?!https?:|//)[\w./-]+\.html)(\?[^"]*)?(")'
)

PAGES = ['index.html', 'teacher.html', 'parent.html', 'parent-preview.html']

def bump_html_query(m, version):
    prefix, query, quote = m.group(1), m.group(2) or '', m.group(3)
    if query:
        query = re.sub(r'\bv=[^&]*', '', query).rstrip('&')
        query = query.rstrip('?')
        sep = '&' if query.startswith('?') and len(query) > 1 else ('?' if not query else '&')
        if query in ('', '?'):
            new_query = '?v=' + version
        else:
            new_query = query + '&v=' + version
    else:
        new_query = '?v=' + version
    return prefix + new_query + quote

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

        def repl_js_css(m):
            nonlocal total
            total += 1
            return f'{m.group(1)}{m.group(2)}?v={version}{m.group(4)}'

        def repl_html(m):
            nonlocal total
            total += 1
            return bump_html_query(m, version)

        new_content = LOCAL_JS_CSS.sub(repl_js_css, content)
        new_content = LOCAL_HTML.sub(repl_html, new_content)
        if new_content != content:
            with open(name, 'w', encoding='utf-8') as f:
                f.write(new_content)

    print(f'Stamped {total} local asset references with v={version}')

if __name__ == '__main__':
    main()
