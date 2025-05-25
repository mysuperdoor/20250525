import React from 'react';
import { Divider } from 'antd';

const ContentSection = ({ title, content, isMobile }) => {
  const styles = {
    dividerStyle: {
      margin: isMobile ? '16px 0' : '20px 0',
      color: '#1890ff',
      fontSize: isMobile ? '16px' : '18px'
    },
    contentBlockStyle: {
      whiteSpace: 'pre-wrap',
      padding: '20px',
      borderRadius: '12px',
      background: '#fafafa',
      border: '1px solid #e8e8e8',
      boxShadow: '0 2px 6px rgba(0, 0, 0, 0.03)',
      marginBottom: '24px',
      fontSize: '15px',
      lineHeight: '1.8',
      position: 'relative',
      overflow: 'hidden'
    },
    highlightBar: {
      position: 'absolute',
      left: 0,
      top: 0,
      width: '4px',
      height: '100%',
      background: title === '建议内容' ? '#1890ff' : '#52c41a',
      borderRadius: '4px 0 0 4px'
    }
  };

  return (
    <>
      <Divider orientation="left" style={styles.dividerStyle}>
        <strong>{title}</strong>
      </Divider>
      <div style={styles.contentBlockStyle}>
        <div style={styles.highlightBar}></div>
        <div style={{ marginLeft: '10px' }}>{content}</div>
      </div>
    </>
  );
};

export default ContentSection; 