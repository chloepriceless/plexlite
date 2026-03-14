import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';

import { createModbusProxy } from '../modules/gateway/modbus-proxy.js';

function makeConfig(overrides = {}) {
  return {
    modbusListenHost: '127.0.0.1',
    modbusListenPort: 0, // OS-assigned port
    modbusAllowList: [],
    ...overrides
  };
}

function noopLog() {
  return {
    info: () => {},
    warn: () => {},
    error: () => {}
  };
}

function connectTo(port, host = '127.0.0.1') {
  return new Promise((resolve, reject) => {
    const sock = net.connect(port, host);
    sock.once('connect', () => resolve(sock));
    sock.once('error', reject);
  });
}

function waitForClose(socket) {
  return new Promise((resolve) => {
    socket.on('close', resolve);
    // safety timeout
    setTimeout(() => resolve(), 2000);
  });
}

// Build a minimal Modbus TCP frame (MBAP header + PDU)
function buildModbusTcpFrame(tid, unitId, fc, data) {
  const pdu = Buffer.alloc(1 + data.length);
  pdu.writeUInt8(fc, 0);
  data.copy(pdu, 1);

  const mbap = Buffer.alloc(7);
  mbap.writeUInt16BE(tid, 0);       // Transaction ID
  mbap.writeUInt16BE(0, 2);         // Protocol ID
  mbap.writeUInt16BE(1 + pdu.length, 4); // Length (unitId + PDU)
  mbap.writeUInt8(unitId, 6);       // Unit ID

  return Buffer.concat([mbap, pdu]);
}

test('proxy binds to 127.0.0.1 by default', async () => {
  const proxy = createModbusProxy({
    config: makeConfig(),
    log: noopLog()
  });

  const cfg = proxy.getConfig();
  assert.equal(cfg.host, '127.0.0.1');
  await proxy.stop().catch(() => {}); // cleanup if started
});

test('proxy start() returns a promise and stop() closes the server', async () => {
  const proxy = createModbusProxy({
    config: makeConfig(),
    log: noopLog()
  });

  await proxy.start();
  const cfg = proxy.getConfig();
  assert.ok(cfg.port >= 0, 'should have a port assigned');

  // Should be able to connect
  const sock = await connectTo(cfg.port);
  sock.destroy();

  await proxy.stop();
});

test('connection from IP in allowlist is accepted', async () => {
  const proxy = createModbusProxy({
    config: makeConfig({ modbusAllowList: ['127.0.0.1'] }),
    log: noopLog()
  });

  await proxy.start();
  const cfg = proxy.getConfig();

  const sock = await connectTo(cfg.port);
  // If we get here, connection was accepted
  assert.ok(sock.writable, 'socket should be writable');
  sock.destroy();
  await proxy.stop();
});

test('connection from IP NOT in allowlist is destroyed immediately', async () => {
  // Allowlist only has 10.0.0.1, but we connect from 127.0.0.1
  const proxy = createModbusProxy({
    config: makeConfig({ modbusAllowList: ['10.0.0.1'] }),
    log: noopLog()
  });

  await proxy.start();
  const cfg = proxy.getConfig();

  const sock = await connectTo(cfg.port);
  const closed = waitForClose(sock);
  await closed;
  assert.ok(sock.destroyed || sock.readableEnded, 'socket should be destroyed');

  await proxy.stop();
});

test('empty allowlist allows all connections (backward compatibility)', async () => {
  const proxy = createModbusProxy({
    config: makeConfig({ modbusAllowList: [] }),
    log: noopLog()
  });

  await proxy.start();
  const cfg = proxy.getConfig();

  const sock = await connectTo(cfg.port);
  assert.ok(sock.writable, 'connection should be accepted with empty allowlist');
  sock.destroy();
  await proxy.stop();
});

test('sending data exceeding 1024 bytes destroys the connection', async () => {
  const proxy = createModbusProxy({
    config: makeConfig(),
    log: noopLog()
  });

  await proxy.start();
  const cfg = proxy.getConfig();

  const sock = await connectTo(cfg.port);
  const closed = waitForClose(sock);

  // Send a chunk larger than 1024 bytes
  const bigData = Buffer.alloc(1025, 0x41);
  sock.write(bigData);

  await closed;
  assert.ok(sock.destroyed || sock.readableEnded, 'socket should be destroyed after oversized data');

  await proxy.stop();
});

test('sending a valid Modbus TCP frame within 1024 bytes is processed', async () => {
  let frameReceived = null;

  const proxy = createModbusProxy({
    config: makeConfig(),
    log: noopLog()
  });

  proxy.setFrameHandler((frame, socket) => {
    frameReceived = frame;
    // Echo back a simple response
    const resp = Buffer.alloc(9);
    frame.copy(resp, 0, 0, 7);
    resp.writeUInt16BE(3, 4); // length = 3
    resp.writeUInt8(frame.readUInt8(7), 7); // FC
    resp.writeUInt8(0, 8); // byte count
    socket.write(resp);
  });

  await proxy.start();
  const cfg = proxy.getConfig();

  const sock = await connectTo(cfg.port);

  // Build a FC4 read request for 1 register at address 843
  const data = Buffer.alloc(4);
  data.writeUInt16BE(843, 0);  // start address
  data.writeUInt16BE(1, 2);    // quantity
  const frame = buildModbusTcpFrame(1, 100, 4, data);
  sock.write(frame);

  // Wait a bit for processing
  await new Promise(r => setTimeout(r, 100));

  assert.ok(frameReceived !== null, 'frame handler should have been called');
  assert.ok(frameReceived.length >= 8, 'frame should have MBAP header + PDU');

  sock.destroy();
  await proxy.stop();
});

test('buffer accumulation resets after processing a frame', async () => {
  let callCount = 0;

  const proxy = createModbusProxy({
    config: makeConfig(),
    log: noopLog()
  });

  proxy.setFrameHandler((frame, socket) => {
    callCount++;
  });

  await proxy.start();
  const cfg = proxy.getConfig();

  const sock = await connectTo(cfg.port);

  // Send two separate frames
  const data = Buffer.alloc(4);
  data.writeUInt16BE(843, 0);
  data.writeUInt16BE(1, 2);

  const frame1 = buildModbusTcpFrame(1, 100, 4, data);
  const frame2 = buildModbusTcpFrame(2, 100, 4, data);

  sock.write(frame1);
  await new Promise(r => setTimeout(r, 50));

  sock.write(frame2);
  await new Promise(r => setTimeout(r, 50));

  assert.equal(callCount, 2, 'handler should have been called twice for two frames');

  sock.destroy();
  await proxy.stop();
});
