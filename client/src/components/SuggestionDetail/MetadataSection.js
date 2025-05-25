import React from 'react';
import { Descriptions, Tag } from 'antd';
import { 
  TagOutlined, 
  ClockCircleOutlined,
  UserOutlined,
  TeamOutlined
} from '@ant-design/icons';
import { TYPE_COLORS, SUGGESTION_TYPES } from '../../constants/suggestions';

const MetadataSection = ({ suggestion, isMobile }) => {
  const styles = {
    container: {
      padding: '12px 16px',
      background: 'linear-gradient(to right, #f8f8f8, #ffffff)',
      borderRadius: '8px',
      marginBottom: '24px',
      border: '1px solid #eaeaea',
      boxShadow: '0 2px 5px rgba(0, 0, 0, 0.03)',
    },
    tagStyle: {
      padding: '2px 8px', 
      borderRadius: '15px', 
      margin: 0,
      fontWeight: 500
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '未知';
    
    const date = new Date(dateString);
    return isMobile 
      ? `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`
      : date.toLocaleString();
  };

  return (
    <div style={styles.container}>
      <Descriptions 
        column={isMobile ? 1 : 4}
        size={isMobile ? "small" : "default"}
        colon={false}
        labelStyle={{ 
          width: isMobile ? '60px' : '70px',
          color: '#666',
          fontWeight: '500'
        }}
        contentStyle={{
          color: '#333',
        }}
      >
        <Descriptions.Item 
          label={
            <span style={{ display: 'flex', alignItems: 'center' }}>
              <TagOutlined style={{ color: '#1890ff', marginRight: '4px' }} />
              类型
            </span>
          }
        >
          <Tag 
            color={TYPE_COLORS[suggestion.type] || 'default'}
            style={styles.tagStyle}
          >
            {SUGGESTION_TYPES[suggestion.type] || suggestion.type}
          </Tag>
        </Descriptions.Item>
        
        <Descriptions.Item 
          label={
            <span style={{ display: 'flex', alignItems: 'center' }}>
              <ClockCircleOutlined style={{ color: '#722ed1', marginRight: '4px' }} />
              时间
            </span>
          }
        >
          <Tag color="purple" style={styles.tagStyle}>
            {formatDate(suggestion.createdAt)}
          </Tag>
        </Descriptions.Item>
        
        <Descriptions.Item 
          label={
            <span style={{ display: 'flex', alignItems: 'center' }}>
              <UserOutlined style={{ color: '#1890ff', marginRight: '4px' }} />
              提交人
            </span>
          }
        >
          <Tag color="blue" style={styles.tagStyle}>
            {suggestion.submitter?.name || '未知'}                 
          </Tag>
        </Descriptions.Item>
        
        <Descriptions.Item 
          label={
            <span style={{ display: 'flex', alignItems: 'center' }}>
              <TeamOutlined style={{ color: '#52c41a', marginRight: '4px' }} />
              班组
            </span>
          }
        >
          <Tag color="green" style={styles.tagStyle}>
            {suggestion.team || '未指定'}
          </Tag>
        </Descriptions.Item>
      </Descriptions>
    </div>
  );
};

export default MetadataSection; 