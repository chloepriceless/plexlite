import net from 'node:net';

/**
 * Secured Modbus TCP proxy server.
 * Security fixes over original server.js implementation:
 * - Binds to 127.0.0.1 by default (not 0.0.0.0)
 * - IP allowlist enforcement
 * - 1024-byte buffer size cap (standard Modbus TCP max PDU is 260 bytes)
 */
export function createModbusProxy({ config = {}, eventBus, log = {} }) {
  const MAX_BUFFER_SIZE = 1024;
  const bindHost = config.modbusListenHost || '127.0.0.1';
  const bindPort = config.modbusListenPort || 1502;
  const allowList = new Set(config.modbusAllowList || []);

  const logInfo = log.info || (() => {});
  const logWarn = log.warn || (() => {});

  let frameHandler = null;
  let server = null;
  let actualPort = bindPort;

  function handleConnection(socket) {
    const remoteIp = socket.remoteAddress?.replace('::ffff:', '') || 'unknown';

    // IP allowlist enforcement
    if (allowList.size > 0 && !allowList.has(remoteIp)) {
      logWarn({ remoteIp }, 'Modbus connection rejected: IP not in allowlist');
      socket.destroy();
      return;
    }

    logInfo({ remoteIp }, 'Modbus client connected');

    let buffer = Buffer.alloc(0);

    socket.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);

      // Buffer size cap enforcement
      if (buffer.length > MAX_BUFFER_SIZE) {
        logWarn({ remoteIp, bufferSize: buffer.length }, 'Modbus buffer size exceeded');
        socket.destroy();
        return;
      }

      // Process complete Modbus TCP frames from buffer
      // MBAP header: 2 bytes TID + 2 bytes PID + 2 bytes length + 1 byte unitId
      // bytes 4-5 (big-endian) give remaining length after the 6-byte MBAP header prefix
      while (buffer.length >= 7) {
        const len = buffer.readUInt16BE(4);
        const total = 6 + len;

        if (buffer.length < total) break; // incomplete frame, wait for more data

        const frame = Buffer.from(buffer.subarray(0, total)); // copy frame
        buffer = buffer.subarray(total); // remove processed bytes

        if (frameHandler) {
          frameHandler(frame, socket);
        }
      }
    });

    socket.on('close', () => {
      logInfo({ remoteIp }, 'Modbus client disconnected');
    });

    socket.on('error', (err) => {
      logWarn({ err, remoteIp }, 'Modbus socket error');
    });
  }

  server = net.createServer(handleConnection);

  function start() {
    return new Promise((resolve) => {
      server.listen(bindPort, bindHost, () => {
        const addr = server.address();
        if (addr) actualPort = addr.port;
        resolve();
      });
    });
  }

  function stop() {
    return new Promise((resolve, reject) => {
      if (!server) return resolve();
      server.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  function setFrameHandler(fn) {
    frameHandler = fn;
  }

  function getConfig() {
    return {
      host: bindHost,
      port: actualPort,
      allowListSize: allowList.size
    };
  }

  return {
    start,
    stop,
    setFrameHandler,
    getConfig
  };
}
