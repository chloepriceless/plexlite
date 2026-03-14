import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(__dirname, '..', 'public', 'styles.css'), 'utf-8');

describe('UI responsive CSS', () => {
  it('contains @media (max-width: 1024px)', () => {
    assert.ok(css.includes('@media (max-width: 1024px)'), 'Missing 1024px breakpoint');
  });

  it('contains @media (max-width: 768px)', () => {
    assert.ok(css.includes('@media (max-width: 768px)'), 'Missing 768px breakpoint');
  });

  it('contains @media (max-width: 480px)', () => {
    assert.ok(css.includes('@media (max-width: 480px)'), 'Missing 480px breakpoint');
  });

  it('contains .dashboard-grid with display: grid', () => {
    assert.ok(css.includes('.dashboard-grid'), 'Missing .dashboard-grid class');
    assert.ok(css.includes('display: grid'), 'Missing display: grid');
  });

  it('contains .flow-animated with animation', () => {
    assert.ok(css.includes('.flow-animated'), 'Missing .flow-animated class');
    assert.ok(css.includes('animation: flowDash'), 'Missing flowDash animation');
  });

  it('contains @keyframes flowDash', () => {
    assert.ok(css.includes('@keyframes flowDash'), 'Missing flowDash keyframes');
  });

  it('contains .app-nav-toggle', () => {
    assert.ok(css.includes('.app-nav-toggle'), 'Missing .app-nav-toggle class');
  });

  it('contains .ws-indicator styles', () => {
    assert.ok(css.includes('.ws-indicator'), 'Missing .ws-indicator class');
    assert.ok(css.includes('.ws-connected'), 'Missing .ws-connected class');
    assert.ok(css.includes('.ws-disconnected'), 'Missing .ws-disconnected class');
  });
});
