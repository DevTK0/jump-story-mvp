export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

export interface LoggerConfig {
  level: LogLevel;
  enabledModules?: string[];
  disabledModules?: string[];
  timestampFormat?: boolean;
  colorize?: boolean;
}

export class Logger {
  private static instance: Logger;
  private config: LoggerConfig = {
    level: LogLevel.INFO,
    timestampFormat: true,
    colorize: true,
  };

  private colors = {
    debug: '\x1b[36m', // Cyan
    info: '\x1b[37m', // White
    warn: '\x1b[33m', // Yellow
    error: '\x1b[31m', // Red
    reset: '\x1b[0m',
  };

  private constructor() {}

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  public configure(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  public createModule(moduleName: string): ModuleLogger {
    return new ModuleLogger(moduleName, this);
  }

  public shouldLog(level: LogLevel, moduleName?: string): boolean {
    if (level < this.config.level) return false;

    if (moduleName) {
      if (this.config.disabledModules?.includes(moduleName)) return false;
      if (this.config.enabledModules && !this.config.enabledModules.includes(moduleName))
        return false;
    }

    return true;
  }

  public log(level: LogLevel, message: string, moduleName?: string, ...args: any[]): void {
    if (!this.shouldLog(level, moduleName)) return;

    const timestamp = this.config.timestampFormat ? `[${new Date().toISOString()}] ` : '';
    const modulePrefix = moduleName ? `[${moduleName}] ` : '';
    const levelName = LogLevel[level];
    const color = this.config.colorize ? this.getColor(level) : '';
    const reset = this.config.colorize ? this.colors.reset : '';

    const formattedMessage = `${timestamp}${color}[${levelName}]${reset} ${modulePrefix}${message}`;

    switch (level) {
      case LogLevel.ERROR:
        console.error(formattedMessage, ...args);
        break;
      case LogLevel.WARN:
        console.warn(formattedMessage, ...args);
        break;
      default:
        console.log(formattedMessage, ...args);
    }
  }

  private getColor(level: LogLevel): string {
    switch (level) {
      case LogLevel.DEBUG:
        return this.colors.debug;
      case LogLevel.INFO:
        return this.colors.info;
      case LogLevel.WARN:
        return this.colors.warn;
      case LogLevel.ERROR:
        return this.colors.error;
      default:
        return '';
    }
  }
}

export class ModuleLogger {
  constructor(
    private moduleName: string,
    private logger: Logger
  ) {}

  public debug(message: string, ...args: any[]): void {
    this.logger.log(LogLevel.DEBUG, message, this.moduleName, ...args);
  }

  public info(message: string, ...args: any[]): void {
    this.logger.log(LogLevel.INFO, message, this.moduleName, ...args);
  }

  public warn(message: string, ...args: any[]): void {
    this.logger.log(LogLevel.WARN, message, this.moduleName, ...args);
  }

  public error(message: string, ...args: any[]): void {
    this.logger.log(LogLevel.ERROR, message, this.moduleName, ...args);
  }
}

// Export singleton instance helpers
export const logger = Logger.getInstance();
export const createLogger = (moduleName: string) => logger.createModule(moduleName);

// Development environment configuration
if (process.env.NODE_ENV === 'development') {
  logger.configure({
    level: LogLevel.DEBUG,
    colorize: true,
    timestampFormat: true,
  });
} else {
  logger.configure({
    level: LogLevel.INFO,
    colorize: false,
    timestampFormat: true,
  });
}
