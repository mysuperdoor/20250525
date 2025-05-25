const mongoose = require('mongoose');
// 尝试灵活导入 Suggestion 模型
let Suggestion;
try {
  // 假设模型在 module.exports.Suggestion 中 (例如: module.exports = { Suggestion, ... })
  Suggestion = require('../models/Suggestion').Suggestion;
  if (!Suggestion) throw new Error('Suggestion model not found with .Suggestion access');
} catch (e) {
  // 如果上述方式失败，尝试直接导入 (例如: module.exports = mongoose.model(...))
  console.log('Failed to import Suggestion with .Suggestion, trying direct import...');
  Suggestion = require('../models/Suggestion');
}

if (!Suggestion) {
  console.error('致命错误: 无法加载 Suggestion 模型。请检查 ../models/Suggestion.js 中的导出。 ');
  process.exit(1);
}

// 从 .env 文件加载环境变量 (假设 .env 在项目根目录)
// require('dotenv').config({ path: '../../.env' }); // 相对于 server/scripts 目录
// 更稳妥的方式是确保脚本从项目根目录运行，或者在运行时指定 .env 路径
// 为了简单起见，这里假设 .env 能够被 Node.js 自动找到，或者 MONGODB_URI 直接设置在环境中
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
}

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('错误：未找到 MONGODB_URI。请确保您的环境变量已正确设置，或者 .env 文件在项目根目录并包含 MONGODB_URI。');
  process.exit(1);
}

async function migrateAttachmentsPath() {
  let mongooseConnection;
  try {
    mongooseConnection = await mongoose.connect(MONGODB_URI);
    console.log('成功连接到 MongoDB 进行迁移。');

    const suggestionsToMigrate = await Suggestion.find({
      "attachments.0": { "$exists": true },
      "attachments.path": { "$exists": true }
    });

    if (suggestionsToMigrate.length === 0) {
      console.log('没有找到需要迁移附件路径的建议。数据库可能已经是最新的了。');
      return;
    }

    console.log(`找到 ${suggestionsToMigrate.length} 条建议需要迁移附件路径...`);

    let updatedCount = 0;
    for (const suggestion of suggestionsToMigrate) {
      // 创建新的附件数组，只包含我们需要的字段 (根据 Schema)
      const newAttachments = suggestion.attachments.map(att => ({
        filename: att.filename,
        originalname: att.originalname,
        mimetype: att.mimetype,
        size: att.size,
        uploadedAt: att.uploadedAt,
        _id: att._id
        // 不包含 path
      }));
      suggestion.attachments = newAttachments;

      await suggestion.save();
      updatedCount++;
      console.log(`已更新建议 ID: ${suggestion._id}`);
    }

    console.log(`迁移完成。总共更新了 ${updatedCount} 条建议。`);
  } catch (error) {
    console.error('迁移过程中发生错误:', error);
  } finally {
    if (mongooseConnection) {
      await mongoose.disconnect();
      console.log('已从 MongoDB 断开连接。');
    }
  }
}

migrateAttachmentsPath(); 