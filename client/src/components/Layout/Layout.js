import React, { useState, useEffect } from 'react';
import { Layout as AntLayout, Button, Drawer } from 'antd';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { MenuUnfoldOutlined, MenuFoldOutlined } from '@ant-design/icons';

const { Content, Sider, Header } = AntLayout;

const Layout = () => {
  // 从localStorage获取用户信息
  const userRole = localStorage.getItem('userRole');
  
  // 添加状态管理侧边栏折叠
  const [collapsed, setCollapsed] = useState(false);
  // 检测是否为移动设备
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  // 初始化时检查设备类型并设置侧边栏状态
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      
      // 在移动设备上，初始化时折叠侧边栏
      if (mobile) {
        setCollapsed(true);
      }
    };

    // 初始化时检查一次
    checkMobile();

    // 添加窗口大小变化监听
    window.addEventListener('resize', checkMobile);
    
    // 组件卸载时移除监听
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 切换侧边栏显示状态
  const toggleCollapsed = () => {
    console.log('切换侧边栏状态，当前:', collapsed, '将变为:', !collapsed);
    setCollapsed(!collapsed);
  };

  // 对于移动设备：使用Drawer代替Sider
  if (isMobile) {
    return (
      <AntLayout style={{ minHeight: '100vh' }}>
        <Header style={{
          padding: '0 16px',
          background: '#fff',
          boxShadow: '0 1px 4px rgba(0,21,41,.08)',
          display: 'flex',
          alignItems: 'center',
          position: 'sticky',
          top: 0,
          zIndex: 100
        }}>
          <Button 
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={toggleCollapsed}
            style={{
              fontSize: '16px',
              width: 64,
              height: 64,
            }}
            aria-label={collapsed ? "展开菜单" : "收起菜单"}
          />
          <span style={{ marginLeft: 12 }}>合理化建议系统</span>
        </Header>
        
        <Drawer
          placement="left"
          closable={false}
          onClose={() => setCollapsed(true)}
          open={!collapsed}
          width={200}
          bodyStyle={{ padding: 0 }}
        >
          <Sidebar role={userRole} collapsed={false} />
        </Drawer>
        
        <Content style={{ 
          margin: '12px 8px', 
          padding: 12, 
          background: '#fff',
          minHeight: 280,
          borderRadius: 2
        }}>
          <Outlet />
        </Content>
      </AntLayout>
    );
  }

  // 对于桌面设备：使用常规Sider
  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Sider 
        width={200} 
        theme="light"
        collapsed={collapsed}
        trigger={null}
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          zIndex: 999
        }}
        collapsedWidth={80}
      >
        <Sidebar role={userRole} collapsed={collapsed} />
      </Sider>
      <AntLayout style={{ 
        marginLeft: collapsed ? 80 : 200,
        transition: 'all 0.2s',
        overflowX: 'hidden'
      }}>
        <Header style={{
          padding: '0 16px',
          background: '#fff',
          boxShadow: '0 1px 4px rgba(0,21,41,.08)',
          display: 'flex',
          alignItems: 'center'
        }}>
          <Button 
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={toggleCollapsed}
            style={{
              fontSize: '16px',
              width: 64,
              height: 64,
            }}
            aria-label={collapsed ? "展开菜单" : "收起菜单"}
          />
          <span style={{ marginLeft: 12 }}>合理化建议系统</span>
        </Header>
        <Content style={{ 
          margin: '24px 16px', 
          padding: 24, 
          background: '#fff',
          minHeight: 280,
          borderRadius: 2
        }}>
          <Outlet />
        </Content>
      </AntLayout>
    </AntLayout>
  );
};

export default Layout; 