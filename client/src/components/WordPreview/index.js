import React, { useState, useEffect } from 'react';
import { Spin } from 'antd';
import mammoth from 'mammoth';
import { getFullFileUrl } from '../../utils/apiUtils'; // 导入API工具函数

const WordPreview = ({ fileUrl }) => {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (fileUrl) {
      setLoading(true);
      setError(null);
      
      // 使用工具函数获取完整URL
      const fullUrl = getFullFileUrl(fileUrl);
      
      // 直接在控制台输出调试信息
      console.log("Word预览 - 原始URL:", fileUrl);
      console.log("Word预览 - 完整URL:", fullUrl);
      
      // 获取认证token
      const token = localStorage.getItem('token');
      
      fetch(fullUrl, {
        headers: token ? {
          'Authorization': `Bearer ${token}`
        } : {}
      })
        .then(response => {
          if (!response.ok) {
            console.error('Word预览 - 服务器响应错误:', response.status, response.statusText);
            throw new Error(`服务器错误: ${response.status}`);
          }
          // 查看实际的响应头
          console.log('Word预览 - 响应头:', {
            contentType: response.headers.get('content-type'),
            contentLength: response.headers.get('content-length'),
            contentDisposition: response.headers.get('content-disposition')
          });
          return response.arrayBuffer();
        })
        .then(arrayBuffer => {
          if (!arrayBuffer || arrayBuffer.byteLength === 0) {
            throw new Error('收到空的文件数据');
          }
          console.log("Word预览 - 成功获取文件数据，大小:", arrayBuffer.byteLength, "字节");
          
          console.log("Word预览 - 开始转换Word文档");
          return mammoth.convertToHtml({ arrayBuffer })
            .then(result => {
              console.log("Word预览 - 转换成功");
              if (result.messages && result.messages.length > 0) {
                console.log("Word预览 - 转换消息:", result.messages);
              }
              setContent(result.value);
              setLoading(false);
            })
            .catch(error => {
              console.error('Word文档转换失败:', error);
              setError('文档转换失败: ' + error.message);
              setLoading(false);
            });
        })
        .catch(error => {
          console.error('获取Word文档失败:', error);
          setError(`获取文档失败: ${error.message}`);
          setLoading(false);
        });
    }
  }, [fileUrl]);

  if (loading) {
    return <Spin size="large" tip="正在处理Word文档..." />;
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', color: 'red', padding: '20px' }}>
        {error}
      </div>
    );
  }

  return (
    <div 
      className="word-preview-container"
      dangerouslySetInnerHTML={{ __html: content }}
      style={{ 
        padding: '20px',
        backgroundColor: 'white',
        border: '1px solid #f0f0f0',
        maxHeight: 'calc(100vh - 260px)',
        overflowY: 'auto',
        textAlign: 'left'
      }}
    />
  );
};

export default WordPreview; 