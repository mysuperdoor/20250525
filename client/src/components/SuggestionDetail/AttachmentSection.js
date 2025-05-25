import React from 'react';
import { Card, List, Button, Avatar, Typography, Divider } from 'antd';
import { DownloadOutlined, EyeOutlined, FileTextOutlined, FileExcelOutlined, FilePdfOutlined, FileImageOutlined, FileWordOutlined } from '@ant-design/icons';

const { Text } = Typography;

const AttachmentSection = ({ attachments, handleDownloadAttachment, handlePreviewFile, isMobile, fixEncodingIssues }) => {
  const styles = {
    dividerStyle: {
      margin: isMobile ? '16px 0' : '20px 0',
      color: '#1890ff',
      fontSize: isMobile ? '16px' : '18px'
    },
    cardStyle: {
      borderRadius: '12px',
      marginBottom: '16px',
      boxShadow: '0 1px 4px rgba(0, 0, 0, 0.05)'
    },
    listItemStyle: {
      padding: isMobile ? '8px 0' : '12px 0',
      transition: 'all 0.3s ease',
      ':hover': {
        background: '#f0f5ff'
      }
    },
    buttonStyle: (type, isMobileProp) => ({
      borderRadius: '16px',
      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
      border: 0,
      transition: 'all 0.3s',
      padding: isMobileProp ? '0 6px' : '0 12px',
      height: '28px',
      minWidth: isMobileProp ? '28px' : undefined,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
    })
  };

  const getFileIcon = (filename) => {
    if (!filename) return <FileTextOutlined />;
    
    const ext = filename.split('.').pop().toLowerCase();
    
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext)) {
      return <FileImageOutlined style={{ color: '#13c2c2' }} />;
    } else if (['pdf'].includes(ext)) {
      return <FilePdfOutlined style={{ color: '#f5222d' }} />;
    } else if (['doc', 'docx'].includes(ext)) {
      return <FileWordOutlined style={{ color: '#1890ff' }} />;
    } else if (['xls', 'xlsx', 'csv'].includes(ext)) {
      return <FileExcelOutlined style={{ color: '#52c41a' }} />;
    } else {
      return <FileTextOutlined style={{ color: '#fa8c16' }} />;
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '未知时间';
    
    const date = new Date(dateString);
    return isMobile 
      ? date.toLocaleDateString()
      : date.toLocaleString();
  };

  return (
    <>
      <Divider orientation="left" style={styles.dividerStyle}>
        <DownloadOutlined /> <strong>附件</strong>
      </Divider>
      <Card 
        type="inner" 
        style={styles.cardStyle}
        bodyStyle={{ padding: isMobile ? '12px' : '16px' }}
      >
        <List
          itemLayout={isMobile ? "vertical" : "horizontal"}
          dataSource={attachments}
          renderItem={attachment => (
            <List.Item
              style={styles.listItemStyle}
              actions={[
                <Button 
                  type="primary"
                  ghost
                  size="small"
                  icon={<DownloadOutlined />} 
                  onClick={() => handleDownloadAttachment(attachment)}
                  style={styles.buttonStyle('download', isMobile)}
                >
                  {isMobile ? null : '下载'}
                </Button>,
                <Button 
                  type="default"
                  size="small"
                  icon={<EyeOutlined />} 
                  onClick={() => handlePreviewFile(attachment)}
                  style={{...styles.buttonStyle('preview', isMobile), marginLeft: '8px'}}
                >
                  {isMobile ? null : '预览'}
                </Button>
              ]}
            >
              <List.Item.Meta
                avatar={
                  <Avatar 
                    shape="square" 
                    icon={getFileIcon(attachment.originalname)} 
                    size={isMobile ? "default" : "large"}
                    style={{ backgroundColor: '#f5f5f5' }}
                  />
                }
                title={
                  <Text 
                    style={{ 
                      fontSize: isMobile ? '14px' : '15px',
                      fontWeight: 500
                    }} 
                    ellipsis={{ tooltip: attachment.originalname ? fixEncodingIssues(attachment.originalname) : '未知文件名' }}
                  >
                    {attachment.originalname ? fixEncodingIssues(attachment.originalname) : '未知文件名'}
                  </Text>
                }
                description={`上传于 ${formatDate(attachment.uploadedAt)}`}
              />
            </List.Item>
          )}
        />
      </Card>
    </>
  );
};

export default AttachmentSection; 