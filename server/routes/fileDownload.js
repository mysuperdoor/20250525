const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const auth = require('../middleware/auth');
const mime = require('mime-types');

// 验证文件名是否安全（防止目录遍历攻击）
function isValidFilename(filename) {
  // 检查是否包含路径分隔符或特殊字符
  if (!filename || 
      filename.includes('../') || 
      filename.includes('..\\') || 
      filename.includes('/') || 
      filename.includes('\\') || 
      filename.match(/[<>:"|?*]/)) {
    return false;
  }
  return true;
}

// 安全获取文件路径
function getSafeFilePath(filename) {
  // 先验证文件名是否安全
  if (!isValidFilename(filename)) {
    return null;
  }
  
  // 使用绝对路径构建文件路径
  const uploadsDir = path.resolve(__dirname, '../uploads');
  const filePath = path.join(uploadsDir, filename);
  
  // 确保路径仍然在uploads目录内（额外安全检查）
  if (!filePath.startsWith(uploadsDir)) {
    return null;
  }
  
  return { uploadsDir, filePath };
}

// 处理文件下载
router.get('/:filename', auth, (req, res) => {
  try {
    const { filename } = req.params;
    const { originalname } = req.query;
    
    console.log('文件下载请求:', {
      文件名: filename,
      原始文件名: originalname,
      解码后的原始文件名: decodeURIComponent(originalname || '')
    });

    // 使用安全路径获取函数
    const pathInfo = getSafeFilePath(filename);
    
    if (!pathInfo) {
      console.error('无效的文件名:', filename);
      return res.status(400).json({ message: '无效的文件名' });
    }
    
    const { uploadsDir, filePath } = pathInfo;
    
    console.log('文件路径:', {
      上传目录: uploadsDir,
      完整路径: filePath
    });

    // 检查文件是否存在
    if (!fs.existsSync(filePath)) {
      console.error('文件不存在:', filePath);
      return res.status(404).json({ message: '文件不存在' });
    }

    // 获取文件状态信息
    const stat = fs.statSync(filePath);
    
    // 设置正确的Content-Disposition头，处理中文文件名
    let decodedOriginalname;
    try {
      // 先尝试解码，以防传入的文件名已经是URL编码后的
      decodedOriginalname = decodeURIComponent(originalname || filename);
    } catch (e) {
      // 如果解码失败，直接使用原始文件名
      decodedOriginalname = originalname || filename;
    }
    
    // 确保文件名编码正确
    const encodedFilename = encodeURIComponent(decodedOriginalname)
      .replace(/'/g, '%27')
      .replace(/\(/g, '%28')
      .replace(/\)/g, '%29')
      .replace(/\*/g, '%2A');
    
    // 设置响应头
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    
    // 同时设置UTF-8编码格式和传统格式的header，增加兼容性
    res.setHeader('Content-Disposition', 
      `attachment; filename="${encodedFilename}"; filename*=UTF-8''${encodedFilename}`);
    
    // 记录下载成功信息
    console.log('文件下载成功:', {
      文件名: filename,
      解码后的原始文件名: decodedOriginalname,
      编码后的文件名: encodedFilename,
      文件大小: stat.size
    });

    // 使用流式传输文件
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);

    // 处理流错误
    fileStream.on('error', (error) => {
      console.error('文件流传输错误:', error);
      if (!res.headersSent) {
        res.status(500).json({ message: '文件传输失败', error: error.message });
      } else {
        // 如果已经发送了响应头，尝试结束响应
        try {
          res.end();
        } catch (endError) {
          console.error('结束响应失败:', endError);
        }
      }
    });
  } catch (error) {
    console.error('文件下载失败:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: '文件下载失败', error: error.message });
    }
  }
});

// 文件预览路由
router.get('/preview/:filename', (req, res) => {
    const { filename } = req.params;
    
    console.log('文件预览请求:', filename);
    console.log('请求URL:', req.url);
    console.log('请求头:', req.headers);
    
    // 使用安全路径获取函数
    const pathInfo = getSafeFilePath(filename);
    
    if (!pathInfo) {
      console.error('无效的文件名:', filename);
      return res.status(400).json({ message: '无效的文件名' });
    }
    
    const { filePath } = pathInfo;

    // 检查文件是否存在
    if (!fs.existsSync(filePath)) {
        console.error('文件不存在:', filePath);
        return res.status(404).json({ message: '文件不存在' });
    }

    const mimeType = mime.lookup(filePath) || 'application/octet-stream';
    const fileType = mimeType ? mimeType.split('/')[0] : null;
    
    console.log('文件预览请求详情:', {
        文件名: filename,
        完整路径: filePath,
        MIME类型: mimeType,
        文件类型: fileType
    });

    // 对于图片文件，直接显示
    if (fileType === 'image') {
        res.setHeader('Content-Type', mimeType);
        return fs.createReadStream(filePath).pipe(res);
    }

    // 对于PDF文件，设置正确的响应头
    if (mimeType === 'application/pdf') {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(filename)}"`);
        return fs.createReadStream(filePath).pipe(res);
    }

    // 对于Word文档，直接返回文件
    if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
        mimeType === 'application/msword') {
        console.log('Word文档预览', { filename, mimeType });
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(filename)}"`);
        return fs.createReadStream(filePath).pipe(res);
    }

    // 对于文本文件，返回文本内容
    if (fileType === 'text' || mimeType === 'application/json') {
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        return fs.createReadStream(filePath).pipe(res);
    }

    // 对于其他类型文件，返回文件信息
    const stat = fs.statSync(filePath);
    res.json({
        filename,
        size: stat.size,
        mimeType,
        message: '此文件类型暂不支持直接预览'
    });
});

module.exports = router; 