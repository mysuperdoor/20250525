import { REVIEW_STATUS } from '../constants/suggestions';

/**
 * 获取建议的当前状态
 * @param {Object} suggestion 建议对象
 * @returns {string} 建议的当前状态
 */
export const getCurrentStatus = (suggestion) => {
  if (!suggestion) return '';
  
  const statusKey = suggestion.reviewStatus || suggestion.status;
  
  // 如果状态是中文，尝试将其映射回英文键
  if (typeof statusKey === 'string' && /[\u4e00-\u9fa5]/.test(statusKey)) {
    const statusEntry = Object.entries(REVIEW_STATUS).find(([_, value]) => value === statusKey);
    return statusEntry ? statusEntry[0] : statusKey;
  }
  
  return statusKey;
}; 