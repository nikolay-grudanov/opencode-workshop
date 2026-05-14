/**
 * Cheap "is anything listening on this TCP port?" probe.
 *
 * Tries to bind a fresh server to :port exactly like the Workshop server
 * does. If the bind succeeds the port is free (we close it immediately).
 * Any listen error — EADDRINUSE or otherwise — means the port is taken.
 *
 * Intentionally does not pass a host: binding to 127.0.0.1 misses IPv6
 * wildcard listeners (`*:5899`), and the real `server.listen(port)` would
 * then still fail with EADDRINUSE.
 */
import net from "net";

const MAX_PORT = 65535;

export function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    let settled = false;
    const settle = (free: boolean) => {
      if (settled) return;
      settled = true;
      resolve(free);
    };
    server.once("error", () => settle(false));
    server.once("listening", () => {
      server.close(() => settle(true));
    });
    try {
      server.listen(port);
    } catch {
      settle(false);
    }
  });
}

export async function findFreePort(startPort: number): Promise<number> {
  if (!Number.isInteger(startPort) || startPort < 1 || startPort > MAX_PORT) {
    throw new Error(`invalid port: ${startPort}`);
  }

  for (let port = startPort; port <= MAX_PORT; port++) {
    if (await isPortFree(port)) return port;
  }

  throw new Error(`no free port available at or above :${startPort}`);
}
