import pino from 'pino';
import { config } from './config';
import {
  OPERATIONAL_LOG_MESSAGE,
  sanitizeOperationalMetadata,
} from '../../shared/operational-log';

export function createOperationalLogger(destination?: pino.DestinationStream): pino.Logger {
  const options: pino.LoggerOptions = {
    level: config.log_level.toLowerCase(),
    formatters: {
      bindings: sanitizeOperationalMetadata,
    },
    hooks: {
      logMethod(args, method) {
        const metadata = sanitizeOperationalMetadata(args[0]);
        if (Object.keys(metadata).length === 0) {
          method.apply(this, [OPERATIONAL_LOG_MESSAGE]);
          return;
        }
        method.apply(this, [metadata, OPERATIONAL_LOG_MESSAGE]);
      },
    },
  };

  return destination == null ? pino(options) : pino(options, destination);
}

export const logger = createOperationalLogger();
