import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');

describe('UI import map and vendored bundle', () => {
  it('vendored preact-htm-signals.js exists and is > 10KB', () => {
    const filePath = join(publicDir, 'vendor', 'preact-htm-signals.js');
    const stat = statSync(filePath);
    assert.ok(stat.size > 10000, `Expected > 10KB, got ${stat.size} bytes`);
  });

  it('index.html contains importmap script block', () => {
    const html = readFileSync(join(publicDir, 'index.html'), 'utf-8');
    assert.ok(html.includes('type="importmap"'), 'Missing type="importmap"');
  });

  it('import map has entries for preact, preact/hooks, @preact/signals, htm/preact', () => {
    const html = readFileSync(join(publicDir, 'index.html'), 'utf-8');
    const mapMatch = html.match(/<script type="importmap">([\s\S]*?)<\/script>/);
    assert.ok(mapMatch, 'No importmap script block found');
    const map = JSON.parse(mapMatch[1]);
    assert.ok(map.imports['preact'], 'Missing "preact" entry');
    assert.ok(map.imports['preact/hooks'], 'Missing "preact/hooks" entry');
    assert.ok(map.imports['@preact/signals'], 'Missing "@preact/signals" entry');
    assert.ok(map.imports['htm/preact'], 'Missing "htm/preact" entry');
  });

  it('index.html has <div id="app"></div>', () => {
    const html = readFileSync(join(publicDir, 'index.html'), 'utf-8');
    assert.ok(html.includes('<div id="app"></div>'), 'Missing app mount point');
  });

  it('index.html has module script pointing to app-shell.js', () => {
    const html = readFileSync(join(publicDir, 'index.html'), 'utf-8');
    assert.ok(
      html.includes('<script type="module" src="/components/app-shell.js">'),
      'Missing app-shell.js module script'
    );
  });

  it('index.html has noscript fallback', () => {
    const html = readFileSync(join(publicDir, 'index.html'), 'utf-8');
    assert.ok(html.includes('<noscript>'), 'Missing noscript fallback');
  });
});
