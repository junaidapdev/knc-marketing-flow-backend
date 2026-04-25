# CLAUDE.md — Engineering Standards

This document is loaded into context for every Claude Code session in this
repo. It encodes non-negotiable engineering standards. Follow them in every
chunk.

## Architecture decisions (1–12)

### 1. Strict TypeScript, always

`tsconfig.json` enables `strict`, `noImplicitAny`, and
`noUncheckedIndexedAccess`. No `any` — `@typescript-eslint/no-explicit-any` is
an **error**. Unknown input is typed `unknown` and narrowed.

### 2. Single source of truth for env

`src/config/env.ts` loads `.env`, validates with Zod, and exports a frozen
typed `env` object. **Nothing else in the codebase may read `process.env`.**
If you need a new env var, add it to the schema, the `.env.example`, and the
README table.

### 3. Every response uses the envelope

`src/utils/response.ts` exports `success()` and `error()`. Every route handler
and middleware must build its JSON body with one of these. The envelope shape
is defined in `src/types/api/envelope.ts` and looks like:

```
{ success, data?, error?, meta: { timestamp, requestId } }
```

### 4. No raw HTTP status numbers

Use the named constants from `src/constants/httpStatus.ts`
(`OK`, `CREATED`, `BAD_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`,
`CONFLICT`, `UNPROCESSABLE`, `INTERNAL`, …). `no-magic-numbers` is enabled;
literals other than `0`, `1`, `-1` trigger lint warnings.

### 5. No raw error strings

Use `ERRORS.*` from `src/constants/errors.ts` for all error codes and
messages. New errors are added there, not inline. This keeps the error
catalog discoverable and consistent across chunks.

### 6. Centralised error handling

Routes throw (or forward via `next(err)`). `src/middleware/errorHandler.ts` is
the single place that converts errors into the envelope and picks the HTTP
status. Handle `ZodError`, `HttpError`, and unknown errors — never leak a
stack trace to the client.

### 7. Request IDs on everything

`src/middleware/requestId.ts` attaches `req.requestId`, sets the
`x-request-id` response header, and propagates inbound IDs when present.
Every log line and every response envelope carries this ID.

### 8. Structured logging via Pino

Import `logger` from `src/utils/logger.ts`. **Do not use `console.*`** in
source files — `no-console` is a lint warning and should stay that way. Logs
are silent in `test`, pretty in `development`, JSON in `production`. Always
include `requestId` in log context for request-scoped work.

### 9. Validate at the boundary with Zod

All inbound payloads (body, query, params) are parsed by a Zod schema at the
route layer. Downstream code sees fully typed, validated data — never raw
`req.body`.

### 10. App factory, not module-level app

`src/app.ts` exports `buildApp()` that returns a fresh `Express` instance.
`src/server.ts` is the only place that calls `.listen()`. Tests build their
own app with `buildApp()` — no shared global state.

### 11. Keep the tree flat and predictable

One concern per folder: `config/`, `constants/`, `middleware/`, `routes/`,
`types/`, `utils/`. New resources add a file per layer (route → service →
repo), not a new top-level folder.

### 12. Ad-hoc markdown is gitignored

The only tracked markdown files are `README.md`, `CLAUDE.md`, and
`PROJECT_LOG.md`. Scratch files like `NOTES.md`, `TODO.md`, `CrossFix.md`,
`DeploymentFix.md` are gitignored — do not track them.

## Process

- **Typecheck + lint + test must pass** before a chunk is considered
  complete (`npm run typecheck && npm run lint && npm test`).
- **Do not implement ahead of the chunk.** Each chunk has a scope; features
  outside that scope wait for their chunk.
- **Log chunk completion in `PROJECT_LOG.md`** with a short summary of what
  landed.
