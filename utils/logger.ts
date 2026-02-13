import winston from 'winston';
import path from 'path';

// Configure log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define log colors
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
};

winston.addColors(colors);

// Create a custom format with timestamp and colorization
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`
  )
);

// Define transports (console and file)
const transports = [
  new winston.transports.Console(),
  new winston.transports.File({
    filename: path.join(process.cwd(), 'logs', 'error.log'),
    level: 'error',
  }),
  new winston.transports.File({
    filename: path.join(process.cwd(), 'logs', 'combined.log'),
  }),
];

// Create the logger
const Logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels,
  format,
  transports,
});

// Extend logger with custom methods
interface ExtendedLogger extends winston.Logger {
  audit: (action: string, metadata?: Record<string, any>) => void;
  security: (action: string, metadata?: Record<string, any>) => void;
}

const extendedLogger = Logger as ExtendedLogger;

// Audit logging for significant events
extendedLogger.audit = (action: string, metadata?: Record<string, any>) => {
  Logger.info(`AUDIT: ${action}`, {
    ...metadata,
    type: 'audit'
  });
};

// Security-specific logging
extendedLogger.security = (action: string, metadata?: Record<string, any>) => {
  Logger.warn(`SECURITY: ${action}`, {
    ...metadata,
    type: 'security'
  });
};

export default extendedLogger;