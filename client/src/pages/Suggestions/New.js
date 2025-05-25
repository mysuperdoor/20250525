import React, { useState, useEffect } from 'react';
import {
  Form,
  Input,
  Select,
  Upload,
  Button,
  Card,
  message,
  Space,
  Alert
} from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { suggestionService } from '../../services/suggestionService';
import { authService } from '../../services/authService';

const { TextArea } = Input;
const { Option } = Select;

const NewSuggestion = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [fileList, setFileList] = useState([]);
  const [suggestionTypes, setSuggestionTypes] = useState([]);
  const [initializing, setInitializing] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [isRestrictedUser, setIsRestrictedUser] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const navigate = useNavigate();

  // 检测窗口大小变化
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // 检查用户权限
  useEffect(() => {
    const checkUserPermission = async () => {
      try {
        const user = await authService.getCurrentUser();
        setCurrentUser(user);
        
        // 检查是否是运行科或安全科管理人员
        if (user && (user.role === '运行科管理人员' || user.role === '安全科管理人员')) {
          console.log('当前用户没有提交建议权限:', user.role);
          setIsRestrictedUser(true);
          message.error('运行科和安全科管理人员暂时无法提交建议');
          
          // 延迟一秒后重定向，让用户有时间看到消息
          setTimeout(() => {
            navigate('/suggestions/list');
          }, 1500);
        }
      } catch (error) {
        console.error('检查用户权限失败:', error);
      }
    };
    
    checkUserPermission();
  }, [navigate]);

  // 获取初始数据
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setInitializing(true);
        const response = await suggestionService.getCreateData();
        console.log('获取创建建议数据:', response);
        
        if (response && response.types) {
          setSuggestionTypes(response.types);
        } else {
          // 如果API还没准备好，使用默认数据
          setSuggestionTypes([
            { label: '安全管理', value: 'SAFETY' },
            { label: '生产优化', value: 'PRODUCTION' },
            { label: '智能化升级', value: 'AUTOMATION' },
            { label: '其它', value: 'OTHER' }
          ]);
        }
      } catch (error) {
        console.error('获取初始数据失败:', error);
        message.error('加载表单数据失败，使用默认配置');
        // 使用默认数据
        setSuggestionTypes([
          { label: '安全管理', value: 'SAFETY' },
          { label: '生产优化', value: 'PRODUCTION' },
          { label: '智能化升级', value: 'AUTOMATION' },
          { label: '其它', value: 'OTHER' }
        ]);
      } finally {
        setInitializing(false);
      }
    };

    fetchInitialData();
  }, []);

  const handleFileChange = ({ file, fileList: newFileList }) => {
    let finalFileList = newFileList;

    finalFileList = newFileList.filter(f => {
        if (f.status === 'error' && f.response === 'Unsupported file type or size') {
            return false;
        }
        return true;
    });
    
    setFileList(finalFileList);
  };

  const beforeUploadValidation = (file) => {
    const allowedMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    const isAllowedType = allowedMimeTypes.includes(file.type);
    if (!isAllowedType) {
      message.error(`${file.name}: 文件类型不支持。请上传 JPG, PNG, GIF, PDF, DOC, 或 DOCX 格式的文件。`);
      return Upload.LIST_IGNORE;
    }

    const isLt10M = file.size / 1024 / 1024 < 10;
    if (!isLt10M) {
      message.error(`${file.name}: 文件大小不能超过 10MB!`);
      return Upload.LIST_IGNORE;
    }
    
    return false;
  };

  // 处理表单提交
  const handleSubmit = async (values) => {
    // 再次检查用户权限
    if (isRestrictedUser) {
      message.error('您没有提交建议的权限');
      return;
    }
    
    try {
      setLoading(true);
      console.log('提交的表单值:', values);
      
      // 创建FormData对象
      const formData = new FormData();
      
      // 添加文件
      fileList.forEach((file, index) => {
        if (file.originFileObj) {
          console.log(`添加文件 ${index}:`, file.name);
          formData.append('files', file.originFileObj);
        }
      });

      // 添加其他表单数据
      Object.keys(values).forEach(key => {
        console.log(`添加字段 ${key}:`, values[key]);
        formData.append(key, values[key]);
      });

      // 打印FormData内容（仅用于调试）
      for (let pair of formData.entries()) {
        console.log(pair[0] + ': ' + (pair[1] instanceof File ? pair[1].name : pair[1]));
      }

      // 提交建议
      const response = await suggestionService.submitSuggestion(formData);
      
      console.log('提交成功，响应:', response);
      message.success('建议提交成功！');
      navigate('/suggestions/list');
    } catch (error) {
      console.error('提交建议失败:', error);
      message.error(`提交失败: ${error.response?.data?.message || error.message || '请重试'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="responsive-container">
      <Card 
        title="提交合理化建议" 
        loading={initializing}
        bodyStyle={{ padding: isMobile ? '12px' : '24px' }}
      >
        {isRestrictedUser && (
          <Alert
            message="权限受限"
            description="运行科和安全科管理人员暂时无法提交建议。"
            type="error"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}
        
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          disabled={initializing || isRestrictedUser}
          style={{ width: '100%' }}
        >
          <Form.Item
            name="title"
            label="建议标题"
            rules={[{ required: true, message: '请输入建议标题' }]}
          >
            <Input placeholder="请输入建议标题" maxLength={100} />
          </Form.Item>

          <Form.Item
            name="type"
            label="建议类型"
            rules={[{ required: true, message: '请选择建议类型' }]}
          >
            <Select placeholder="请选择建议类型">
              {suggestionTypes.map(type => (
                <Option key={type.value} value={type.value}>
                  {type.label}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="content"
            label="建议内容"
            rules={[{ required: true, message: '请输入建议内容' }]}
          >
            <TextArea
              placeholder="请详细描述您的建议..."
              rows={isMobile ? 4 : 6}
              maxLength={2000}
              showCount
            />
          </Form.Item>

          <Form.Item
            name="expectedBenefit"
            label="预期效益"
            rules={[{ required: true, message: '请描述预期效益' }]}
          >
            <TextArea
              placeholder="请描述实施该建议可能带来的效益..."
              rows={isMobile ? 3 : 4}
              maxLength={1000}
              showCount
            />
          </Form.Item>

          <Form.Item
            label="附件"
            extra="不要上传原来的申报表，附上图片或者pdf文件说明即可，单个文件不超过10MB"
          >
            <Upload
              fileList={fileList}
              onChange={handleFileChange}
              beforeUpload={beforeUploadValidation}
              maxCount={5}
            >
              <Button icon={<UploadOutlined />} disabled={isRestrictedUser}>选择文件</Button>
            </Upload>
          </Form.Item>

          <Form.Item>
            <Space style={{ 
              display: isMobile ? 'flex' : 'inline-flex',
              flexDirection: isMobile ? 'column' : 'row',
              width: isMobile ? '100%' : 'auto'
            }}>
              <Button 
                type="primary" 
                htmlType="submit" 
                loading={loading} 
                disabled={isRestrictedUser}
                style={{ width: isMobile ? '100%' : 'auto' }}
              >
                提交建议
              </Button>
              <Button 
                onClick={() => navigate('/suggestions/list')}
                style={{ width: isMobile ? '100%' : 'auto' }}
              >
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default NewSuggestion; 