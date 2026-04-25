import cors, { type CorsOptions } from 'cors';
import { type RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { env } from '../config/env';

const FIFTEEN_MINUTES_MS = 900_000;
const RATE_WINDOW_MS = FIFTEEN_MINUTES_MS;
const RATE_MAX_REQUESTS = 300; // generous: ~20 req/min per IP

function parseAllowedOrigins(): readonly string[] | null {
  // Empty string → no allowlist configured → permissive (dev/local).
  // Comma-separated list → strict allowlist (prod).
  const raw = env.WEB_ORIGIN.trim();
  if (raw === '') return null;
  return raw
    .split(',')
    .map((o) => o.trim())
    .filter((o) => o.length > 0);
}

export function buildCors(): RequestHandler {
  const allowed = parseAllowedOrigins();
  const options: CorsOptions = {
    credentials: false,
    // We don't ship cookies; all auth is bearer-token via the
    // Authorization header. Keeping `credentials: false` lets us use
    // origin: '*' safely in dev.
    origin:
      allowed === null
        ? true // reflect request origin — dev/local
        : (origin, cb) => {
            // Same-origin / curl requests have no Origin header.
            if (origin === undefined) {
              cb(null, true);
              return;
            }
            cb(null, allowed.includes(origin));
          },
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id'],
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  };
  return cors(options);
}

export function buildHelmet(): RequestHandler {
  // Defaults are sensible for a JSON API: HSTS, X-Content-Type-Options,
  // Referrer-Policy, etc. We disable CSP because this server only ever
  // serves JSON — there's no HTML to attack with injected scripts, and
  // the default CSP would just add response bytes for no win.
  return helmet({ contentSecurityPolicy: false });
}

export const apiRateLimit: RequestHandler = rateLimit({
  windowMs: RATE_WINDOW_MS,
  max: RATE_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  // Skip the deep health probe so a misbehaving uptime monitor can't
  // lock itself out.
  skip: (req) => req.path === '/health' || req.path === '/health/deep',
});
