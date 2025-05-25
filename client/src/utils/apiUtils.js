/**
 * API工具函数
 * 提供与API相关的通用功能
 */

/**
 * 获取API基础URL
 * 根据当前环境和访问方式自动判断使用的基础URL
 * @returns {string} API基础URL
 */
export const getApiBaseUrl = () => {
  // 首先检查是否有环境变量指定的API URL
  if (process.env.REACT_APP_API_URL) {
    // 从环境变量中提取基础URL，去掉末尾的 /api
    const baseUrl = process.env.REACT_APP_API_URL.replace(/\/api$/, '');
    console.log('从环境变量获取API基础URL:', baseUrl);
    return baseUrl;
  }
  
  // 生产环境下的处理
  if (process.env.NODE_ENV === 'production') {
    // 1. 检查是否通过正式域名访问（通常是Nginx代理）
    if (window.location.hostname === 'diaodu.eu.org' || 
        window.location.hostname.includes('yourdomain.com') ||
        // 添加其他可能的正式域名
        !window.location.hostname.match(/^\d+\.\d+\.\d+\.\d+$/)) {
        // 如果是通过域名访问（而非IP），假定是通过Nginx配置了反向代理
        console.log('使用Nginx代理模式 (域名访问)');
        return '';
    } else {
        // 2. 如果是通过IP直接访问（通常是PM2启动的静态服务）
        // 使用完整URL，包含服务器IP和后端端口
        const serverPort = '5000'; // 服务器端口
        const baseUrl = `http://${window.location.hostname}:${serverPort}`;
        console.log('使用PM2模式 (IP直接访问):', baseUrl);
        return baseUrl;
    }
  } else {
    // 开发环境默认使用代理
    console.log('开发环境，使用代理');
    return '';
  }
};

/**
 * 获取完整的API URL
 * @param {string} path - API路径
 * @returns {string} 完整的API URL
 */
export const getFullApiUrl = (path) => {
  const baseUrl = getApiBaseUrl();
  // 确保路径以斜杠开头
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${normalizedPath}`;
};

/**
 * 获取完整的文件URL
 * @param {string} fileUrl - 文件URL或路径
 * @returns {string} 完整的文件URL
 */
export const getFullFileUrl = (fileUrl) => {
  // 如果已经是完整URL，直接返回
  if (fileUrl && fileUrl.startsWith('http')) {
    return fileUrl;
  }
  
  // 确保fileUrl以斜杠开头
  const normalizedFileUrl = fileUrl && !fileUrl.startsWith('/') ? `/${fileUrl}` : fileUrl;
  
  // 获取基础URL并拼接
  const baseUrl = getApiBaseUrl();
  return normalizedFileUrl ? `${baseUrl}${normalizedFileUrl}` : '';
};

export default {
  getApiBaseUrl,
  getFullApiUrl,
  getFullFileUrl
}; 