import { format, transports, createLogger } from 'winston';
import { sanitizeOperationalLogInfo } from '../../shared/operational-log';

const logger = createLogger({
  level: process.env.LOG_LEVEL ?? 'info',
  defaultMeta: { service: 'file-server' },
  format: format.combine(
    format(sanitizeOperationalLogInfo)(),
    format.timestamp(),
    format.json(),
  ),
  transports: [new transports.Console()],
});

export default logger;
