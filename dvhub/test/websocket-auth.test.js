import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import websocketPlugin from '@fastify/websocket';
import WebSocket from 'ws';
import authPlugin from '../core/auth.js';
import { registerWebSocketRoutes } from '../modules/gateway/routes/websocket.js';

/**
 * Helper: create a Fastify app with auth + websocket + our routes registered.
 */
async function buildApp(opts = {}) {
  const app = Fastify();
  const apiToken = opts.apiToken ?? 'testtoken';
  const roles = opts.roles ?? null;

  await app.register(authPlugin, { apiToken, roles });
  await app.register(websocketPlugin);

  const wsApi = registerWebSocketRoutes(app, {
    config: { apiToken, roles }
  });

  await app.listen({ port: 0, host: '127.0.0.1' });
  const port = app.server.address().port;

  return { app, port, ...wsApi };
}

/**
 * Helper: connect a WebSocket client to the server.
 */
function connectWs(port, token) {
  const url = token
    ? `ws://127.0.0.1:${port}/ws?token=${token}`
    : `ws://127.0.0.1:${port}/ws`;
  return new WebSocket(url);
}

/**
 * Helper: wait for a WebSocket to open or error.
 */
function waitForOpen(ws) {
  return new Promise((resolve, reject) => {
    ws.on('open', resolve);
    ws.on('error', reject);
    ws.on('close', (code) => reject(new Error(`closed with code ${code}`)));
    setTimeout(() => reject(new Error('timeout')), 3000);
  });
}

/**
 * Helper: wait for next message on a WebSocket.
 */
function waitForMessage(ws, timeoutMs = 2000) {
  return new Promise((resolve, reject) => {
    ws.once('message', (data) => resolve(data.toString()));
    setTimeout(() => reject(new Error('message timeout')), timeoutMs);
  });
}

describe('WebSocket route handler', () => {
  describe('authentication', () => {
    it('rejects connection without token when apiToken configured', async () => {
      const { app, port } = await buildApp();
      after(() => app.close());

      const ws = connectWs(port, null);
      try {
        await waitForOpen(ws);
        assert.fail('Should not have opened');
      } catch (e) {
        // Connection should be rejected
        assert.ok(e.message.includes('closed') || e.message.includes('Unexpected'));
      } finally {
        ws.close();
      }
    });

    it('accepts connection with valid token', async () => {
      const { app, port } = await buildApp();
      after(() => app.close());

      const ws = connectWs(port, 'testtoken');
      await waitForOpen(ws);
      assert.equal(ws.readyState, WebSocket.OPEN);
      ws.close();
    });
  });

  describe('client tracking', () => {
    it('adds client to set on connect and getClientCount reflects it', async () => {
      const { app, port, getClientCount } = await buildApp();
      after(() => app.close());

      assert.equal(getClientCount(), 0);

      const ws = connectWs(port, 'testtoken');
      await waitForOpen(ws);
      // Small delay for server-side handler
      await new Promise(r => setTimeout(r, 50));
      assert.equal(getClientCount(), 1);
      ws.close();
    });

    it('removes client from set on disconnect', async () => {
      const { app, port, getClientCount } = await buildApp();
      after(() => app.close());

      const ws = connectWs(port, 'testtoken');
      await waitForOpen(ws);
      await new Promise(r => setTimeout(r, 50));
      assert.equal(getClientCount(), 1);

      ws.close();
      await new Promise(r => setTimeout(r, 100));
      assert.equal(getClientCount(), 0);
    });
  });

  describe('broadcast', () => {
    it('sends to all connected clients with readyState OPEN', async () => {
      const { app, port, broadcast, getClientCount } = await buildApp();
      after(() => app.close());

      const ws1 = connectWs(port, 'testtoken');
      const ws2 = connectWs(port, 'testtoken');
      await Promise.all([waitForOpen(ws1), waitForOpen(ws2)]);
      await new Promise(r => setTimeout(r, 50));
      assert.equal(getClientCount(), 2);

      const p1 = waitForMessage(ws1);
      const p2 = waitForMessage(ws2);
      broadcast({ hello: 'world' });
      const [msg1, msg2] = await Promise.all([p1, p2]);

      assert.deepEqual(JSON.parse(msg1), { hello: 'world' });
      assert.deepEqual(JSON.parse(msg2), { hello: 'world' });

      ws1.close();
      ws2.close();
    });

    it('filters by admin role -- only admin receives', async () => {
      const { app, port, broadcast } = await buildApp({
        apiToken: 'admintoken',
        roles: { readonlytoken: 'readonly', usertoken: 'user', admintoken: 'admin' }
      });
      after(() => app.close());

      const wsReadonly = connectWs(port, 'readonlytoken');
      const wsUser = connectWs(port, 'usertoken');
      const wsAdmin = connectWs(port, 'admintoken');
      await Promise.all([waitForOpen(wsReadonly), waitForOpen(wsUser), waitForOpen(wsAdmin)]);
      await new Promise(r => setTimeout(r, 50));

      const pAdmin = waitForMessage(wsAdmin);
      // readonly and user should NOT receive admin-only broadcast
      let readonlyGot = false;
      let userGot = false;
      wsReadonly.once('message', () => { readonlyGot = true; });
      wsUser.once('message', () => { userGot = true; });

      broadcast({ secret: 'admin-only' }, 'admin');
      const adminMsg = await pAdmin;
      assert.deepEqual(JSON.parse(adminMsg), { secret: 'admin-only' });

      await new Promise(r => setTimeout(r, 200));
      assert.equal(readonlyGot, false, 'readonly should not get admin broadcast');
      assert.equal(userGot, false, 'user should not get admin broadcast');

      wsReadonly.close();
      wsUser.close();
      wsAdmin.close();
    });

    it('filters by user role -- user and admin receive, readonly does not', async () => {
      const { app, port, broadcast } = await buildApp({
        apiToken: 'admintoken',
        roles: { readonlytoken: 'readonly', usertoken: 'user', admintoken: 'admin' }
      });
      after(() => app.close());

      const wsReadonly = connectWs(port, 'readonlytoken');
      const wsUser = connectWs(port, 'usertoken');
      const wsAdmin = connectWs(port, 'admintoken');
      await Promise.all([waitForOpen(wsReadonly), waitForOpen(wsUser), waitForOpen(wsAdmin)]);
      await new Promise(r => setTimeout(r, 50));

      const pUser = waitForMessage(wsUser);
      const pAdmin = waitForMessage(wsAdmin);
      let readonlyGot = false;
      wsReadonly.once('message', () => { readonlyGot = true; });

      broadcast({ data: 'for-users' }, 'user');

      const [userMsg, adminMsg] = await Promise.all([pUser, pAdmin]);
      assert.deepEqual(JSON.parse(userMsg), { data: 'for-users' });
      assert.deepEqual(JSON.parse(adminMsg), { data: 'for-users' });

      await new Promise(r => setTimeout(r, 200));
      assert.equal(readonlyGot, false, 'readonly should not get user-level broadcast');

      wsReadonly.close();
      wsUser.close();
      wsAdmin.close();
    });
  });

  describe('error handling', () => {
    it('removes client on send error without crashing', async () => {
      const { app, port, broadcast, getClientCount } = await buildApp();
      after(() => app.close());

      const ws = connectWs(port, 'testtoken');
      await waitForOpen(ws);
      await new Promise(r => setTimeout(r, 50));
      assert.equal(getClientCount(), 1);

      // Force-terminate the underlying socket (simulate dead connection)
      ws.terminate();
      await new Promise(r => setTimeout(r, 100));

      // Broadcast should not throw even if socket is dead
      assert.doesNotThrow(() => broadcast({ test: 'data' }));

      // Client should be cleaned up
      await new Promise(r => setTimeout(r, 100));
      assert.equal(getClientCount(), 0);
    });
  });
});
