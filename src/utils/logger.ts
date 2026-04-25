import pino, { type LoggerOptions } from 'pino';
import { env } from '../config/env';

const isTest = env.NODE_ENV === 'test';
const isDev = env.NODE_ENV === 'development';
const isProd = env.NODE_ENV === 'production';

const options: LoggerOptions = {
  level: isTest ? 'silent' : env.LOG_LEVEL,
  base: isProd ? { env: env.NODE_ENV } : undefined,
  timestamp: pino.stdTimeFunctions.isoTime,
};

if (isDev) {
  options.transport = {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    },
  };
}

export const logger = pino(options);
export type Logger = typeof logger;
