require('dotenv').config();

module.exports = {
  // 服务器配置
  port: process.env.PORT || 5000,
  environment: process.env.NODE_ENV || 'development',
  
  // 数据库配置
  db: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/suggestion-system',
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    }
  },
  
  // JWT配置
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '1d'
  },
  
  // 文件上传配置
  upload: {
    path: process.env.UPLOAD_PATH || 'uploads/',
    maxSize: parseInt(process.env.UPLOAD_MAX_SIZE || '5000000', 10) // 5MB
  }
}; 