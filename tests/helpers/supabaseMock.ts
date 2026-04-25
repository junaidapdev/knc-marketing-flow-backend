import { vi, type Mock } from 'vitest';

export interface QueryResult {
  data: unknown;
  error: unknown;
  count?: number | null;
}

interface BuilderCall {
  method: string;
  args: unknown[];
}

interface BuilderRecord {
  table: string;
  calls: BuilderCall[];
}

interface MockState {
  queue: QueryResult[];
  defaultResult: QueryResult;
  rpcResult: QueryResult;
  builders: BuilderRecord[];
  rpcCalls: Array<{ fn: string; args: unknown }>;
}

const CHAINABLE_METHODS = [
  'select',
  'insert',
  'update',
  'upsert',
  'delete',
  'eq',
  'neq',
  'gt',
  'gte',
  'lt',
  'lte',
  'in',
  'is',
  'order',
  'limit',
  'range',
  'match',
] as const;

const TERMINAL_METHODS = ['single', 'maybeSingle'] as const;

const hoisted = vi.hoisted(() => {
  const state: MockState = {
    queue: [],
    defaultResult: { data: [], error: null },
    rpcResult: { data: null, error: null },
    builders: [],
    rpcCalls: [],
  };

  const nextResult = (): QueryResult => state.queue.shift() ?? state.defaultResult;

  const makeBuilder = (table: string): Record<string, unknown> => {
    const record: BuilderRecord = { table, calls: [] };
    state.builders.push(record);
    const self: Record<string, unknown> = {};

    for (const method of CHAINABLE_METHODS) {
      self[method] = (...args: unknown[]): unknown => {
        record.calls.push({ method, args });
        return self;
      };
    }
    for (const method of TERMINAL_METHODS) {
      self[method] = async (): Promise<QueryResult> => {
        record.calls.push({ method, args: [] });
        return nextResult();
      };
    }
    self.then = (onResolve: (value: QueryResult) => unknown): Promise<unknown> =>
      Promise.resolve(onResolve(nextResult()));
    return self;
  };

  const fromMock = vi.fn((table: string) => makeBuilder(table));
  const authGetUserMock = vi.fn();
  const rpcMock = vi.fn(async (fn: string, args: unknown): Promise<QueryResult> => {
    state.rpcCalls.push({ fn, args });
    return state.rpcResult;
  });
  const createSignedUploadUrlMock = vi.fn(async (path: string) => ({
    data: { signedUrl: `https://storage.test/upload/${path}`, path, token: 'tok' },
    error: null,
  }));
  const createSignedUrlMock = vi.fn(async (path: string) => ({
    data: { signedUrl: `https://storage.test/read/${path}` },
    error: null,
  }));
  const storageFromMock = vi.fn(() => ({
    createSignedUploadUrl: createSignedUploadUrlMock,
    createSignedUrl: createSignedUrlMock,
  }));

  return {
    state,
    fromMock,
    authGetUserMock,
    rpcMock,
    storageFromMock,
    createSignedUploadUrlMock,
    createSignedUrlMock,
  };
});

vi.mock('../../src/lib/supabase', () => ({
  db: {
    from: hoisted.fromMock,
    auth: { getUser: hoisted.authGetUserMock },
    rpc: hoisted.rpcMock,
    storage: { from: hoisted.storageFromMock },
  },
}));

export const fromMock: Mock = hoisted.fromMock;
export const authGetUserMock: Mock = hoisted.authGetUserMock;
export const rpcMock: Mock = hoisted.rpcMock;
export const storageFromMock: Mock = hoisted.storageFromMock;
export const createSignedUploadUrlMock: Mock = hoisted.createSignedUploadUrlMock;
export const createSignedUrlMock: Mock = hoisted.createSignedUrlMock;

/** Queue one or more results for the next query(ies) in order. */
export function queueResults(...results: QueryResult[]): void {
  hoisted.state.queue.push(...results);
}

export function setDefaultResult(result: QueryResult): void {
  hoisted.state.defaultResult = result;
}

/** Backward-compat alias — sets the default result for any un-queued query. */
export function setQueryResult(result: QueryResult): void {
  setDefaultResult(result);
}

export function setRpcResult(result: QueryResult): void {
  hoisted.state.rpcResult = result;
}

export function resetSupabaseMocks(): void {
  hoisted.state.queue = [];
  hoisted.state.defaultResult = { data: [], error: null };
  hoisted.state.rpcResult = { data: null, error: null };
  hoisted.state.builders = [];
  hoisted.state.rpcCalls = [];
  fromMock.mockClear();
  authGetUserMock.mockReset();
  rpcMock.mockClear();
  storageFromMock.mockClear();
  createSignedUploadUrlMock.mockClear();
  createSignedUrlMock.mockClear();
}

export function builders(): BuilderRecord[] {
  return hoisted.state.builders;
}

export function rpcCalls(): Array<{ fn: string; args: unknown }> {
  return hoisted.state.rpcCalls;
}

export function eqCalls(): unknown[][] {
  return hoisted.state.builders
    .flatMap((b) => b.calls)
    .filter((c) => c.method === 'eq')
    .map((c) => c.args);
}

export function orderCalls(): unknown[][] {
  return hoisted.state.builders
    .flatMap((b) => b.calls)
    .filter((c) => c.method === 'order')
    .map((c) => c.args);
}

export function callsOn(table: string): Array<{ method: string; args: unknown[] }> {
  return hoisted.state.builders.filter((b) => b.table === table).flatMap((b) => b.calls);
}
