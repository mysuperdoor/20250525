import React, { useState, useEffect } from 'react';
import { Spin, Alert, Typography, Card } from 'antd';
import { getFullFileUrl } from '../../utils/apiUtils'; // 导入API工具函数

const { Text } = Typography;

/**
 * 文本文件预览组件
 * @param {string} fileUrl - 文件URL
 */
const TextPreview = ({ fileUrl }) => {
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchTextContent = async () => {
      try {
        // 使用工具函数获取完整URL
        const fullUrl = getFullFileUrl(fileUrl);
        
        console.log('TextPreview - 原始URL:', fileUrl);
        console.log('TextPreview - 完整URL:', fullUrl);
        setLoading(true);
        
        // 获取认证token
        const token = localStorage.getItem('token');
        
        // 创建请求选项，添加认证头
        const requestOptions = {
          headers: token ? {
            'Authorization': `Bearer ${token}`
          } : {}
        };
        
        // 发送请求获取文本内容
        console.log('TextPreview - 发送请求，请求选项:', requestOptions);
        const response = await fetch(fullUrl, requestOptions);
        
        if (!response.ok) {
          console.error('TextPreview - 响应不成功:', response.status, response.statusText);
          throw new Error(`无法获取文本内容，服务器返回: ${response.status}`);
        }
        
        // 查看实际的响应头
        console.log('TextPreview - 响应头:', {
          contentType: response.headers.get('content-type'),
          contentLength: response.headers.get('content-length'),
          contentDisposition: response.headers.get('content-disposition')
        });
        
        const text = await response.text();
        console.log('TextPreview - 成功获取文本内容，长度:', text?.length || 0);
        setContent(text);
      } catch (err) {
        console.error('TextPreview - 文本文件加载失败:', err);
        setError(err.message || '加载文本内容时发生错误');
      } finally {
        setLoading(false);
      }
    };
    
    if (fileUrl) {
      fetchTextContent();
    }
  }, [fileUrl]);

  if (loading) {
    return (
      <div style={{ width: '100%', height: '300px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <Spin tip="正在加载文本内容..." />
      </div>
    );
  }

  if (error) {
    return (
      <Alert
        message="加载文本失败"
        description={error}
        type="error"
        showIcon
      />
    );
  }

  return (
    <Card 
      style={{ 
        width: '100%', 
        height: 'calc(100vh - 260px)',
        maxHeight: '70vh',
        overflowY: 'auto',
        textAlign: 'left'
      }}
      bodyStyle={{ padding: '16px', textAlign: 'left' }}
    >
      <pre style={{ 
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        fontFamily: 'monospace',
        fontSize: '14px',
        margin: 0,
        padding: 0,
        textAlign: 'left',
        display: 'block'
      }}>
        {content}
      </pre>
    </Card>
  );
};

export default TextPreview; 