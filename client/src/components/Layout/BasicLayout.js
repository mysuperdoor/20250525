import React, { useState, useEffect } from 'react';
import { Layout, Menu, Dropdown, Space, Avatar, message } from 'antd';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import {
  HomeOutlined,
  PlusOutlined,
  CheckOutlined,
  BarChartOutlined,
  TeamOutlined,
  UserOutlined,
  LogoutOutlined,
  MenuOutlined
} from '@ant-design/icons';
import { authService } from '../../services/authService';

const { Header, Footer, Content, Sider } = Layout;

const BasicLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const currentUser = authService.getCurrentUser();
  
  // 侧边栏折叠状态 - 默认为折叠状态
  const [collapsed, setCollapsed] = useState(true);
  // 是否为移动设备视图
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  // 监听窗口大小变化，调整布局
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      // 在移动设备视图下强制折叠侧边栏
      if (mobile) {
        setCollapsed(true);
      }
    };

    // 初始化检查
    checkMobile();

    // 添加窗口大小变化监听
    window.addEventListener('resize', checkMobile);

    // 组件销毁时移除监听
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // 检查是否有部门经理权限 (与 DepartmentManagerRoute 保持一致)
  const hasAdminAccess = currentUser?.role === '部门经理';

  const menuItems = [
    {
      key: '/home',
      icon: <HomeOutlined />,
      label: '首页'
    },
    {
      key: '/suggestions/new',
      icon: <PlusOutlined />,
      label: '提交建议'
    },
    {
      key: '/suggestions/list',
      icon: <CheckOutlined />,
      label: '建议列表'
    },
    {
      key: '/reports',
      icon: <BarChartOutlined />,
      label: '统计报表'
    },
    hasAdminAccess && {
      key: '/users',
      icon: <TeamOutlined />,
      label: '用户管理'
    }
  ].filter(Boolean); // 过滤掉 false 值

  const handleMenuClick = (e) => {
    navigate(e.key);
    // 在移动设备上，点击菜单项后折叠侧边栏
    if (isMobile) {
      setCollapsed(true);
    }
  };

  const handleLogout = () => {
    authService.logout();
    message.success('退出登录成功');
    navigate('/login');
  };

  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人信息'
    },
    {
      type: 'divider'
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录'
    }
  ];

  const handleUserMenuClick = ({ key }) => {
    if (key === 'logout') {
      handleLogout();
    } else if (key === 'profile') {
      // 跳转到个人信息页面
      navigate('/profile');
    }
  };

  const toggleSider = () => {
    setCollapsed(!collapsed);
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        // 在非移动设备上显示折叠按钮，移动设备上隐藏（通过Header中的按钮控制）
        trigger={isMobile ? null : undefined}
        // 移动设备上使用抽屉模式
        breakpoint="md"
        collapsedWidth={isMobile ? 0 : 80}
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: collapsed ? (isMobile ? -80 : 0) : 0,
          zIndex: 999,
          transition: 'all 0.2s'
        }}
      >
        <div className="logo" style={{
          height: '64px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          color: '#fff',
          fontSize: collapsed ? '16px' : '18px',
          fontWeight: 'bold',
          whiteSpace: 'nowrap',
          overflow: 'hidden'
        }}>
          {collapsed ? '建议系统' : '合理化建议系统'}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={handleMenuClick}
        />
      </Sider>
      <Layout style={{ 
        marginLeft: collapsed ? (isMobile ? 0 : 80) : 200,
        transition: 'all 0.2s'
      }}>
        <Header style={{ 
          padding: 0,
          display: 'flex',
          alignItems: 'center',
          background: '#001529'
        }}>
          {/* 移动设备上的菜单折叠按钮 */}
          {isMobile && (
            <MenuOutlined 
              style={{ 
                color: '#fff', 
                fontSize: '18px', 
                padding: '0 24px',
                cursor: 'pointer'
              }} 
              onClick={toggleSider}
            />
          )}
          
          <div className="header-title" style={{
            flex: 1,
            color: '#fff',
            fontSize: '18px',
            fontWeight: 'bold',
            textAlign: isMobile ? 'center' : 'left',
            marginLeft: isMobile ? 0 : '24px'
          }}>
            {isMobile ? '合理化建议系统' : ''}
          </div>
          
          <div style={{ marginRight: '24px' }}>
            <Dropdown
              menu={{
                items: userMenuItems,
                onClick: handleUserMenuClick
              }}
            >
              <Space style={{ color: '#fff', cursor: 'pointer' }}>
                <Avatar icon={<UserOutlined />} />
                {!isMobile && <span>{currentUser?.name || '用户'}</span>}
              </Space>
            </Dropdown>
          </div>
        </Header>
        <Content style={{ 
          padding: isMobile ? '12px' : '24px',
          background: '#f0f2f5',
          marginLeft: isMobile && !collapsed ? '200px' : '0' // 移动设备下侧边栏展开时内容右移
        }}>
          <div style={{ 
            background: '#fff',
            padding: isMobile ? '12px' : '24px',
            minHeight: '280px',
            borderRadius: '2px'
          }}>
            <Outlet />
          </div>
        </Content>
        <Footer style={{ 
          textAlign: 'center',
          background: '#fff',
          padding: isMobile ? '12px' : '24px'
        }}>
          合理化建议管理系统 ©{new Date().getFullYear()}
        </Footer>
      </Layout>
    </Layout>
  );
};

export default BasicLayout; 