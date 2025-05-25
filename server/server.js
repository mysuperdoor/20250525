const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// 添加环境变量检查和默认值设置
const JWT_SECRET = process.env.JWT_SECRET || 'your_development_secret_key';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/suggestion-system';

// 设置环境变量
process.env.JWT_SECRET = JWT_SECRET;
process.env.MONGO_URI = MONGO_URI;

// 添加更详细的调试日志
console.log('环境变量检查:');
console.log('当前工作目录:', process.cwd());
console.log('.env 文件路径:', path.join(__dirname, '../.env'));
console.log('JWT_SECRET:', process.env.JWT_SECRET ? '已设置' : '未设置');
console.log('MONGO_URI:', process.env.MONGO_URI ? '已设置' : '未设置');

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');

// 导入路由
const authRoutes = require('./routes/auth');
const suggestionRoutes = require('./routes/suggestions');
const userRoutes = require('./routes/users');
const reportRoutes = require('./routes/reports');
const statisticsRoutes = require('./routes/statistics');
const fileDownloadRoutes = require('./routes/fileDownload');

const app = express();

// 中间件
// app.use(cors()); // 移除这行

// --- 更安全的 CORS 配置 ---
// 允许更多的客户端来源以适应远程访问场景
const allowedOrigins = [
  process.env.CLIENT_URL,
'http://localhost:3000'
 // 从 .env 文件读取客户端 URL
  // 允许使用 IP 和端口访问
  // 添加您的远程服务器 IP 和前端端口
];  

// 使用更灵活的CORS策略，允许所有来源
// 注意：这仅在开发环境或者测试环境建议使用，生产环境应当设置更严格的策略
/*
if (process.env.NODE_ENV !== 'production') {
  console.log('开发模式：CORS允许所有来源');
  app.use(cors());
}
*/

// 检查 CLIENT_URL 是否已在 .env 文件中设置
if (!process.env.CLIENT_URL) {
  console.warn('警告: CLIENT_URL 未在 .env 文件中设置。CORS 可能无法按预期工作，或者会回退到更宽松的策略 (如果后续逻辑允许)。');
  // 在这种情况下，您可以选择一个回退策略，例如只允许开发环境中的特定源，或者在生产中强制报错。
  // 为了安全，如果 CLIENT_URL 未定义，并且 NODE_ENV 是 'production'，最好是不允许任何跨域请求或只允许非常受限的集合。
}

const corsOptions = {
  origin: function (origin, callback) {
    // 允许 REST 工具和服务器到服务器的请求 (当 origin 未定义时)
    if (!origin) return callback(null, true);
    
    // 在生产环境中检查允许的源
    if (process.env.NODE_ENV === 'production') {
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.error(`CORS Error: Origin ${origin} not allowed.`);
        callback(new Error('Not allowed by CORS'));
      }
    } else {
      // 在开发环境中允许所有源
      // 当 NODE_ENV 不是 production 时，这个分支会被执行
      // 配合 credentials: true, 'Access-Control-Allow-Origin' 会被设为请求的 Origin
      console.log(`开发模式：CORS 允许 origin: ${origin}`);
      callback(null, true);
    }
  },
  credentials: true, // 如果您的前端需要发送/接收 cookies 或使用 Authorization 标头
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
// --- CORS 配置结束 ---

// 配置请求体解析 - 只使用bodyParser
// 注意：不要同时使用express.json()和bodyParser.json()
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// 添加请求日志中间件
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  
  // 简化请求头日志，只记录关键信息
  const { 'content-type': contentType, 'content-length': contentLength, authorization } = req.headers;
  console.log('请求头(关键信息):', { 
    contentType, 
    contentLength,
    hasAuth: authorization ? '是' : '否'
  });
  
  // 记录请求体内容 (JSON和表单数据)
  if (req.method === 'POST' || req.method === 'PUT') {
    // 对于multipart/form-data类型请求，只记录非文件字段
    if (contentType && contentType.includes('multipart/form-data')) {
      console.log('请求体类型: multipart/form-data (文件上传)');
      const bodyFields = { ...req.body };
      // 不输出文件内容，文件上传由multer处理
      console.log('表单字段:', bodyFields);
    } 
    // 对于普通JSON请求，记录请求体
    else if (contentType && contentType.includes('application/json')) {
      // 可能包含敏感信息，如密码，需要过滤
      const safeBody = { ...req.body };
      if (safeBody.password) safeBody.password = '[已隐藏]';
      console.log('请求体 (JSON):', safeBody);
    }
    // 对于普通表单请求
    else if (contentType && contentType.includes('application/x-www-form-urlencoded')) {
      const safeBody = { ...req.body };
      if (safeBody.password) safeBody.password = '[已隐藏]';
      console.log('请求体 (表单):', safeBody);
    }
  }
  
  next();
});

// 确保上传目录存在
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log('创建上传目录:', uploadDir);
}

// 静态文件配置 - 必须在API路由之前
// 注意：使用绝对路径而非相对路径
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 添加文件下载路由 - 必须在API路由之前
app.use('/download', fileDownloadRoutes);

// 数据库连接
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/suggestion-system', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => {
  console.log('数据库连接成功');
  console.log('连接的数据库URI:', process.env.MONGO_URI || 'mongodb://localhost:27017/suggestion-system');
})
.catch(err => {
  console.error('数据库连接失败:', err);
  console.error('尝试连接的数据库URI:', process.env.MONGO_URI || 'mongodb://localhost:27017/suggestion-system');
  process.exit(1); // 如果数据库连接失败，终止程序
});

// 监听数据库连接事件
mongoose.connection.on('error', err => {
  console.error('MongoDB 连接错误:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB 连接断开');
});

// 测试 JWT 签名和验证
const testToken = jwt.sign(
  { user: { id: 'test', role: '部门经理', team: '无班组' } },
  process.env.JWT_SECRET
);
console.log('测试token生成:', testToken);

try {
  const decoded = jwt.verify(testToken, process.env.JWT_SECRET);
  console.log('测试token验证成功:', decoded);
} catch (error) {
  console.error('测试token验证失败:', error);
}

// 健康检查路由
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', time: new Date().toISOString() });
});

// API路由
app.use('/api/auth', authRoutes);
app.use('/api/suggestions', suggestionRoutes);
app.use('/api/users', userRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/statistics', statisticsRoutes);

// 全局错误处理中间件
app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  
  // 针对常见错误类型提供更友好的错误信息
  if (err.type === 'stream.not.readable') {
    return res.status(400).json({
      message: '无法解析请求数据，请检查请求格式',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
  
  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      message: '请求数据过大，请减小请求体积',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
  
  res.status(500).json({
    message: '服务器错误',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 处理生产环境
if (process.env.NODE_ENV === 'production') {
  // 首先提供静态文件
  app.use(express.static(path.join(__dirname, '../client/build')));

  // 仅对前端路由这些路径使用通配符匹配
  // 重要：排除对 /api 和 /download 路径的匹配
  app.get(/^(?!\/(api|download)).*/, (req, res) => {
    console.log('前端通配符路由:', req.url);
    res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
  });
}

const PORT = process.env.PORT || 5000;

// 绑定到所有网络接口，确保服务器可以从远程访问
app.listen(PORT, '0.0.0.0', () => {
  console.log(`服务器运行在端口 ${PORT}`);
}); 