import net from 'node:net';
import { syncBuiltinESMExports } from 'node:module';

/** Record and reject outbound connections while exercising the actual Firebase SDKs. */
export function guardNetwork() {
  const attempted = [];
  const original = net.Socket.prototype.connect;
  net.Socket.prototype.connect = function (...args) {
    const first = args[0];
    const options = Array.isArray(first) ? first[0] : first;
    const host = typeof options === 'object' ? options.host || 'localhost' : typeof args[1] === 'string' ? args[1] : 'localhost';
    attempted.push(host);
    if (!['127.0.0.1', 'localhost', '::1'].includes(host)) throw new Error(`Outbound connection blocked: ${host}`);
    return original.apply(this, args);
  };
  syncBuiltinESMExports();
  return attempted;
}
