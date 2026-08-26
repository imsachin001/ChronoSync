// ─────────────────────────────────────────────────────────────────────────────
// config/redis.js
//
// Exports a single ioredis connection configuration object that BullMQ
// uses for both the Queue and the Worker.  BullMQ expects a plain options
// object (host/port/password) or an ioredis instance — we use the options
// form so BullMQ can manage its own connection lifecycle.
//
// REDIS_URL format accepted by this module:
//   redis://:<password>@<host>:<port>          (with auth)
//   redis://<host>:<port>                       (no auth / local)
//   rediss://...                                (TLS — e.g. Upstash)
//
// If REDIS_URL is not set, it falls back to localhost:6379 (Docker / local).
// ─────────────────────────────────────────────────────────────────────────────

function parseRedisUrl(url) {
  if (!url) return { host: '127.0.0.1', port: 6379 };

  try {
    const parsed = new URL(url);
    const config = {
      host:     parsed.hostname || '127.0.0.1',
      port:     parseInt(parsed.port, 10) || 6379,
    };

    if (parsed.password) config.password = parsed.password;
    if (parsed.protocol === 'rediss:') config.tls = {};

    return config;
  } catch {
    // URL parse failed — fall back to localhost
    console.warn('[redis] Could not parse REDIS_URL — falling back to localhost:6379');
    return { host: '127.0.0.1', port: 6379 };
  }
}

export const redisConnection = parseRedisUrl(process.env.REDIS_URL);

export default redisConnection;
