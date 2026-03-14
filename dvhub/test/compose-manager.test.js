import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createComposeManager } from '../core/compose-manager.js';

// Helper: create a mock execFn that resolves with given stdout/stderr
function mockExecFn(stdout = '', stderr = '') {
  return mock.fn(async () => ({ stdout, stderr }));
}

// Helper: create a mock execFn that rejects
function mockExecFnReject(err) {
  return mock.fn(async () => { throw err; });
}

describe('compose-manager', () => {
  it('up() builds correct docker compose command', async () => {
    const execFn = mockExecFn('');
    const mgr = createComposeManager(
      { composePath: '/tmp/docker-compose.yaml', profile: 'hybrid' },
      { execFn }
    );
    await mgr.up();
    assert.equal(execFn.mock.callCount(), 1);
    const [bin, args] = execFn.mock.calls[0].arguments;
    assert.equal(bin, 'docker');
    assert.deepEqual(args, [
      'compose', '-f', '/tmp/docker-compose.yaml', '--profile', 'hybrid',
      'up', '-d', '--wait',
    ]);
  });

  it('down() builds correct docker compose command', async () => {
    const execFn = mockExecFn('');
    const mgr = createComposeManager(
      { composePath: '/tmp/docker-compose.yaml', profile: 'hybrid' },
      { execFn }
    );
    await mgr.down();
    const [bin, args] = execFn.mock.calls[0].arguments;
    assert.equal(bin, 'docker');
    assert.ok(args.includes('down'));
  });

  it('ps() parses JSON output into array', async () => {
    const jsonLine1 = JSON.stringify({ Name: 'eos', State: 'running', Health: 'healthy' });
    const jsonLine2 = JSON.stringify({ Name: 'emhass', State: 'running', Health: 'healthy' });
    const execFn = mockExecFn(`${jsonLine1}\n${jsonLine2}`);
    const mgr = createComposeManager(
      { composePath: '/tmp/dc.yaml' },
      { execFn }
    );
    const result = await mgr.ps();
    assert.equal(result.length, 2);
    assert.equal(result[0].Name, 'eos');
    assert.equal(result[1].Name, 'emhass');
  });

  it('ps() returns empty array for empty stdout', async () => {
    const execFn = mockExecFn('');
    const mgr = createComposeManager(
      { composePath: '/tmp/dc.yaml' },
      { execFn }
    );
    const result = await mgr.ps();
    assert.deepEqual(result, []);
  });

  it('restart(service) includes service name in args', async () => {
    const execFn = mockExecFn('');
    const mgr = createComposeManager(
      { composePath: '/tmp/dc.yaml', profile: 'hybrid' },
      { execFn }
    );
    await mgr.restart('eos');
    const [, args] = execFn.mock.calls[0].arguments;
    assert.ok(args.includes('restart'));
    assert.ok(args.includes('eos'));
  });

  it('isHealthy() returns true when container healthy', async () => {
    const jsonLine = JSON.stringify({ Name: 'eos', State: 'running', Health: 'healthy' });
    const execFn = mockExecFn(jsonLine);
    const mgr = createComposeManager(
      { composePath: '/tmp/dc.yaml' },
      { execFn }
    );
    const result = await mgr.isHealthy('eos');
    assert.equal(result, true);
  });

  it('isHealthy() returns false when not healthy', async () => {
    const jsonLine = JSON.stringify({ Name: 'eos', State: 'running', Health: 'starting' });
    const execFn = mockExecFn(jsonLine);
    const mgr = createComposeManager(
      { composePath: '/tmp/dc.yaml' },
      { execFn }
    );
    const result = await mgr.isHealthy('eos');
    assert.equal(result, false);
  });

  it('isHealthy() returns false when execFile rejects', async () => {
    const execFn = mockExecFnReject(new Error('Docker not installed'));
    const mgr = createComposeManager(
      { composePath: '/tmp/dc.yaml' },
      { execFn }
    );
    const result = await mgr.isHealthy('eos');
    assert.equal(result, false);
  });

  it('custom profile passed correctly', async () => {
    const execFn = mockExecFn('');
    const mgr = createComposeManager(
      { composePath: '/tmp/dc.yaml', profile: 'full' },
      { execFn }
    );
    await mgr.up();
    const [, args] = execFn.mock.calls[0].arguments;
    assert.ok(args.includes('--profile'));
    const profileIdx = args.indexOf('--profile');
    assert.equal(args[profileIdx + 1], 'full');
  });
});
