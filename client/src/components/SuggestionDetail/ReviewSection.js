import React from 'react';
import { Card, Row, Col, Tag, Typography, Timeline, Avatar } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, UserOutlined, CalendarOutlined, CommentOutlined } from '@ant-design/icons';

const { Text, Paragraph } = Typography;

const ReviewSection = ({ review, type, isMobile }) => {
  const isApproved = review.result === 'APPROVED';
  
  const styles = {
    card: {
      borderRadius: '10px',
      marginBottom: '16px',
      borderLeft: `3px solid ${isApproved ? '#52c41a' : '#f5222d'}`
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      marginBottom: '16px'
    },
    icon: {
      fontSize: '18px',
      marginRight: '8px',
      color: isApproved ? '#52c41a' : '#f5222d'
    },
    title: {
      margin: 0,
      fontWeight: 'bold'
    },
    resultTag: {
      borderRadius: '12px',
      padding: '2px 10px',
      fontWeight: 'bold',
      marginLeft: '8px'
    },
    infoItem: {
      display: 'flex',
      alignItems: 'center',
      marginBottom: '8px'
    },
    infoIcon: {
      marginRight: '8px',
      color: '#1890ff'
    },
    infoLabel: {
      fontWeight: 'bold',
      marginRight: '8px'
    },
    commentBox: {
      padding: '12px 16px',
      background: '#f9f9f9',
      borderRadius: '8px',
      marginTop: '12px',
      border: '1px solid #e8e8e8'
    }
  };

  const reviewTime = review.reviewedAt ? new Date(review.reviewedAt).toLocaleString() : '未知';
  
  return (
    <Card
      type="inner"
      style={styles.card}
      bodyStyle={{ padding: isMobile ? '16px' : '20px' }}
    >
      <div style={styles.header}>
        {isApproved ? 
          <CheckCircleOutlined style={styles.icon} /> : 
          <CloseCircleOutlined style={styles.icon} />
        }
        <h3 style={styles.title}>{type === 'first' ? '一级审核' : '二级审核'}</h3>
        <Tag 
          color={isApproved ? 'success' : 'error'}
          style={styles.resultTag}
        >
          {isApproved ? '通过' : '拒绝'}
        </Tag>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12}>
          <div style={styles.infoItem}>
            <UserOutlined style={styles.infoIcon} />
            <span style={styles.infoLabel}>审核人:</span>
            <Avatar 
              size="small" 
              style={{ marginRight: '8px', backgroundColor: '#1890ff' }}
            >
              {review.reviewer?.name ? review.reviewer.name.charAt(0) : '?'}
            </Avatar>
            <Text>{review.reviewer?.name || '未知'}</Text>
          </div>
        </Col>
        <Col xs={24} sm={12}>
          <div style={styles.infoItem}>
            <CalendarOutlined style={styles.infoIcon} />
            <span style={styles.infoLabel}>审核时间:</span>
            <Text>{reviewTime}</Text>
          </div>
        </Col>
        <Col span={24}>
          <div style={styles.infoItem}>
            <CommentOutlined style={styles.infoIcon} />
            <span style={styles.infoLabel}>审核意见:</span>
          </div>
          <div style={styles.commentBox}>
            {review.comments ? 
              <Paragraph style={{ margin: 0 }}>{review.comments}</Paragraph> : 
              <Text type="secondary">无审核意见</Text>
            }
          </div>
        </Col>
      </Row>
    </Card>
  );
};

export default ReviewSection; 