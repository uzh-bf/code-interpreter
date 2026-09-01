import { format, transports, createLogger } from 'winston';
import { sanitizeOperationalLogInfo } from '../../shared/operational-log';

// A runtime string no longer carries evidence that it was a source literal.
// Normalize all messages and retain only structured, code-declared metadata.
export const operationalLogFormat = format(sanitizeOperationalLogInfo);

const logger = createLogger({
  level: process.env.LOG_LEVEL ?? 'info',
  defaultMeta: { service: process.env.SERVICE_NAME ?? 'service-api' },
  format: format.combine(
    operationalLogFormat(),
    format.timestamp(),
    format.json(),
  ),
  transports: [new transports.Console()],
});

export default logger;
