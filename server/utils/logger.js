const winston = require('winston');
const path = require('path');

// 日志级别定义
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
  verbose: 4
};

// 获取当前环境的日志配置
const isDevelopment = process.env.NODE_ENV === 'development';
const logLevel = isDevelopment ? process.env.LOG_LEVEL : process.env.PROD_LOG_LEVEL;
const isLogEnabled = isDevelopment ? process.env.DEV_LOG_ENABLED === 'true' : process.env.PROD_LOG_ENABLED === 'true';

// 创建日志格式
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// 创建 Winston logger 实例
const logger = winston.createLogger({
  level: logLevel || 'info',
  levels,
  format: logFormat,
  transports: [
    // 错误日志文件
    new winston.transports.File({ 
      filename: path.join(__dirname, '../logs/error.log'),
      level: 'error'
    }),
    // 所有日志文件
    new winston.transports.File({ 
      filename: path.join(__dirname, '../logs/combined.log') 
    })
  ]
});

// 在开发环境下添加控制台输出
if (isDevelopment) {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

// 创建日志工具类
class Logger {
  constructor(module) {
    this.module = module;
  }

  _log(level, message, meta = {}) {
    if (!isLogEnabled) return;

    const logData = {
      module: this.module,
      message,
      ...meta
    };

    logger.log(level, logData);
  }

  error(message, meta = {}) {
    this._log('error', message, meta);
  }

  warn(message, meta = {}) {
    this._log('warn', message, meta);
  }

  info(message, meta = {}) {
    this._log('info', message, meta);
  }

  debug(message, meta = {}) {
    this._log('debug', message, meta);
  }

  verbose(message, meta = {}) {
    this._log('verbose', message, meta);
  }

  // 请求日志
  logRequest(req, meta = {}) {
    if (!isLogEnabled || !process.env.DEV_LOG_REQUESTS === 'true') return;

    this.debug('HTTP Request', {
      method: req.method,
      url: req.url,
      body: req.body,
      params: req.params,
      query: req.query,
      ...meta
    });
  }

  // 数据库查询日志
  logDbQuery(operation, query, meta = {}) {
    if (!isLogEnabled || !process.env.DEV_LOG_DB_QUERIES === 'true') return;

    this.debug('Database Query', {
      operation,
      query,
      ...meta
    });
  }

  // 认证日志
  logAuth(action, userId, meta = {}) {
    if (!isLogEnabled || !process.env.DEV_LOG_AUTH === 'true') return;

    this.info('Authentication', {
      action,
      userId,
      ...meta
    });
  }
}

module.exports = Logger; 