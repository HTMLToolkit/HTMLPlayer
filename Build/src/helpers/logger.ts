import { createSatori, type SatoriInstance } from "@nisoku/satori";

export const satori: SatoriInstance = createSatori({
  logLevel: "debug",
  rateLimiting: {
    enabled: true,
    maxEventsPerSecond: 100,
  },
});

export const logger = {
  debug: (message: string, data?: Record<string, unknown>) => {
    satori.rootLogger.debug(message, data ? { state: data } : undefined);
  },
  info: (message: string, data?: Record<string, unknown>) => {
    satori.rootLogger.info(message, data ? { state: data } : undefined);
  },
  warn: (message: string, data?: Record<string, unknown>) => {
    satori.rootLogger.warn(message, data ? { state: data } : undefined);
  },
  error: (message: string, data?: Record<string, unknown>) => {
    satori.rootLogger.error(message, data ? { state: data } : undefined);
  },
};

export const createLogger = (scope: string) => {
  const scoped = satori.createLogger(scope);
  return {
    debug: (message: string, data?: Record<string, unknown>) => {
      scoped.debug(message, data ? { state: data } : undefined);
    },
    info: (message: string, data?: Record<string, unknown>) => {
      scoped.info(message, data ? { state: data } : undefined);
    },
    warn: (message: string, data?: Record<string, unknown>) => {
      scoped.warn(message, data ? { state: data } : undefined);
    },
    error: (message: string, data?: Record<string, unknown>) => {
      scoped.error(message, data ? { state: data } : undefined);
    },
  };
};

export const throwError = (message: string, data?: Record<string, unknown>): never => {
  satori.rootLogger.error(message, { state: { ...data, fatal: true } });
  throw new Error(message);
};
