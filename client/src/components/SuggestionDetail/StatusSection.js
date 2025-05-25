import React from 'react';
import { Card, Tag, Typography, Space, Badge } from 'antd';
import { CheckCircleOutlined, ClockCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { STATUS_COLORS, SUGGESTION_STATUS } from '../../constants/suggestions';
import { getStatusDisplayText, getStatusColor } from '../../utils/statusUtils';

const { Text } = Typography;

const StatusSection = ({ currentStatus, implementation, scoring, isMobile }) => {
  const styles = {
    card: {
      borderRadius: '10px',
      marginBottom: '16px'
    },
    tagStyle: {
      padding: '3px 10px',
      borderRadius: '12px',
      marginLeft: '8px',
      fontSize: '14px',
      fontWeight: '500'
    },
    badgeStyle: (status) => {
      const isApproved = status === 'APPROVED';
      const isRejected = status === 'REJECTED';
      
      return {
        display: 'block',
        padding: '4px 8px 4px 4px',
        background: isApproved ? '#f6ffed' : isRejected ? '#fff2f0' : '#e6f7ff',
        border: `1px solid ${isApproved ? '#b7eb8f' : isRejected ? '#ffccc7' : '#91d5ff'}`,
        borderRadius: '16px',
        marginBottom: '16px'
      };
    },
    badgeDot: (status) => {
      const isApproved = status === 'APPROVED';
      const isRejected = status === 'REJECTED';
      
      return {
        display: 'inline-block',
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        background: isApproved ? '#52c41a' : isRejected ? '#f5222d' : '#1890ff',
        marginRight: '8px'
      };
    }
  };

  const getStatusIcon = (status) => {
    if (status === 'APPROVED') return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
    if (status === 'REJECTED') return <ExclamationCircleOutlined style={{ color: '#f5222d' }} />;
    return <ClockCircleOutlined style={{ color: '#1890ff' }} />;
  };

  return (
    <Card 
      title={
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{ marginRight: '8px' }}>状态信息</span>
          <Badge status={STATUS_COLORS[currentStatus] === 'success' ? 'success' : 
                         STATUS_COLORS[currentStatus] === 'error' ? 'error' : 
                         STATUS_COLORS[currentStatus] === 'warning' ? 'warning' : 'processing'} />
        </div>
      }
      type="inner" 
      style={styles.card}
      bodyStyle={{ padding: isMobile ? '16px' : '20px' }}
    >
      <Space direction="vertical" style={{ width: '100%' }}>
        <div>
          <div style={styles.badgeStyle(currentStatus)}>
            <span style={styles.badgeDot(currentStatus)}></span>
            <Text strong>当前状态: </Text>
            <Text style={{ fontWeight: '500' }}>
              {SUGGESTION_STATUS[currentStatus] || currentStatus}
            </Text>
          </div>

          {implementation && (
            <div style={styles.badgeStyle(implementation.status)}>
              <span style={styles.badgeDot(implementation.status)}></span>
              <Text strong>实施状态: </Text>
              <Text style={{ fontWeight: '500' }}>
                {getStatusDisplayText(implementation.status || 'NOT_STARTED', 'implementation')}
              </Text>
            </div>
          )}

          {scoring && scoring.score !== undefined && (
            <div style={{ marginTop: '16px' }}>
              <Text strong>建议评分: </Text>
              <Tag 
                color="gold"
                style={styles.tagStyle}
              >
                {typeof scoring.score === 'number' ? scoring.score.toFixed(1) : '-'}
              </Tag>
            </div>
          )}
        </div>
      </Space>
    </Card>
  );
};

export default StatusSection; 