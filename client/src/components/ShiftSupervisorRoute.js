import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { message, Spin } from 'antd';
import { authService } from '../services/authService';

/**
 * 值班主任路由组件
 * 仅允许值班主任访问
 */
const ShiftSupervisorRoute = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const checkAccess = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // 仅检查是否为值班主任
        const hasShiftSupervisorAccess = await authService.isShiftSupervisor();
        
        // 只允许值班主任访问
        const hasPermission = hasShiftSupervisorAccess;
        setHasAccess(hasPermission);
        
        if (!hasPermission) {
          setError('仅限值班主任访问');
        }
      } catch (error) {
        console.error('检查值班主任权限失败:', error);
        setHasAccess(false);
        setError(error.message || '检查权限失败');
      } finally {
        setLoading(false);
      }
    };

    checkAccess();
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" tip="验证权限中..." />
      </div>
    );
  }

  if (error || !hasAccess) {
    console.log('ShiftSupervisorRoute - 权限不足，重定向到首页');
    message.error('此页面仅限值班主任访问');
    return <Navigate to="/" replace />;
  }

  console.log('ShiftSupervisorRoute - 值班主任权限验证通过');
  return children;
};

export default ShiftSupervisorRoute; 