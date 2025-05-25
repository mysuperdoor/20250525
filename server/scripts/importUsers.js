const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { User, ROLES, TEAMS, DEPARTMENTS } = require('../models/User');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// 默认部门
const DEFAULT_DEPARTMENT = DEPARTMENTS.PRODUCTION; // 生产调度部

// 默认密码 (123456)
const DEFAULT_PASSWORD = '123456';

/**
 * 批量导入用户
 * 文件格式：每行一个用户，格式为：用户名,姓名,角色,班组
 * 例如：zhangsan,张三,班组人员,甲班
 */
const importUsers = async (filePath, overwriteExisting = false) => {
  try {
    // 检查文件是否存在
    if (!fs.existsSync(filePath)) {
      console.error(`文件不存在: ${filePath}`);
      process.exit(1);
    }

    console.log(`覆盖模式: ${overwriteExisting ? '开启' : '关闭'}`);

    // 连接数据库
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/suggestion-system', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('数据库连接成功');
    console.log(`正在从文件 ${filePath} 导入用户...`);

    // 创建读取流
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    let totalUsers = 0;
    let skippedUsers = 0;
    let addedUsers = 0;
    let updatedUsers = 0;
    let errorUsers = 0;

    // 逐行读取文件
    for await (const line of rl) {
      // 跳过空行或注释行
      if (!line || line.trim() === '' || line.startsWith('#')) {
        continue;
      }

      totalUsers++;
      
      try {
        // 解析用户数据
        const [username, name, role, team] = line.split(',').map(item => item.trim());
        
        // 检查必填字段
        if (!username || !name) {
          console.error(`行 ${totalUsers}: 用户名和姓名是必填项`);
          errorUsers++;
          continue;
        }

        // 检查用户是否已存在
        const userExists = await User.findOne({ username });
        
        // 验证角色和班组 - 支持直接使用中文名称或枚举键
        let userRole = role;
        if (!Object.values(ROLES).includes(role)) {
          // 如果提供的是枚举键或者无效值，尝试转换或使用默认值
          userRole = ROLES[role] || ROLES.TEAM_MEMBER;
        }

        let userTeam = team;
        if (!Object.values(TEAMS).includes(team)) {
          // 如果提供的是枚举键或者无效值，尝试转换或使用默认值
          userTeam = TEAMS[team] || TEAMS.NONE;
        }

        // 用户存在的处理逻辑
        if (userExists) {
          if (overwriteExisting) {
            // 覆盖已有用户
            userExists.name = name;
            userExists.role = userRole;
            userExists.team = userTeam;
            userExists.updatedAt = Date.now();
            
            // 如果需要重置密码
            userExists.password = DEFAULT_PASSWORD;
            
            await userExists.save();
            console.log(`已更新用户: ${username} (${name}), 角色: ${userRole}, 班组: ${userTeam}`);
            updatedUsers++;
          } else {
            // 跳过已有用户
            console.log(`用户 ${username} 已存在，跳过`);
            skippedUsers++;
          }
          continue;
        }

        // 创建新用户 - 使用User模型的创建方法，让模型的pre('save')中间件处理密码哈希
        const newUser = new User({
          username,
          password: DEFAULT_PASSWORD,  // 直接使用明文密码，让模型的中间件处理哈希
          name,
          role: userRole,
          team: userTeam,
          department: DEFAULT_DEPARTMENT,
          active: true
        });

        await newUser.save();
        console.log(`成功添加用户: ${username} (${name}), 角色: ${userRole}, 班组: ${userTeam}`);
        addedUsers++;
      } catch (error) {
        console.error(`处理用户时出错: ${line}`, error);
        errorUsers++;
      }
    }

    console.log('\n导入完成:');
    console.log(`- 总用户数: ${totalUsers}`);
    console.log(`- 已添加: ${addedUsers}`);
    if (overwriteExisting) {
      console.log(`- 已更新: ${updatedUsers}`);
    }
    console.log(`- 已跳过: ${skippedUsers}`);
    console.log(`- 出错: ${errorUsers}`);

  } catch (error) {
    console.error('导入用户失败:', error);
    process.exit(1);
  } finally {
    // 关闭数据库连接
    await mongoose.connection.close();
    console.log('数据库连接已关闭');
    process.exit(0);
  }
};

// 检查命令行参数
const processArgs = () => {
  const args = process.argv.slice(2);
  let filePath = null;
  let overwrite = false;
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--overwrite' || arg === '-o') {
      overwrite = true;
    } else if (!filePath) {
      // 第一个非选项参数被认为是文件路径
      filePath = arg;
    }
  }
  
  if (!filePath) {
    console.log('使用方法: node importUsers.js <文件路径> [--overwrite|-o]');
    console.log('  --overwrite, -o  覆盖已存在的用户');
    process.exit(1);
  }
  
  return { filePath, overwrite };
};

// 处理命令行参数并运行导入
const { filePath, overwrite } = processArgs();
importUsers(filePath, overwrite);