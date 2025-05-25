import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Tag,
  Button,
  Space,
  message,
  Typography,
  Modal,
  Form,
  Input,
  DatePicker,
  Select,
  Upload,
  Timeline,
  Alert,
  Tooltip,
  Collapse,
  Empty,
  Row,
  Col
} from 'antd';
import {
  FileTextOutlined,
  UploadOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ToolOutlined,
  InboxOutlined,
  PlusOutlined,
  SearchOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import moment from 'moment';
import { suggestionService } from '../../../services/suggestionService';
import { authService } from '../../../services/authService';
import { 
  SUGGESTION_TYPES, 
  SUGGESTION_STATUS, 
  STATUS_COLORS, 
  TYPE_COLORS,
  IMPLEMENTATION_STATUS,
  IMPLEMENTATION_STATUS_COLORS,
  REVIEW_STATUS
} from '../../../constants/suggestions';
import { getStatusDisplayText, getStatusColor } from '../../../utils/statusUtils';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Option } = Select;
const { Panel } = Collapse;
const { Dragger } = Upload;

const ImplementationList = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [implementationSuggestions, setImplementationSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [updateModalVisible, setUpdateModalVisible] = useState(false);
  const [currentSuggestion, setCurrentSuggestion] = useState(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [currentStatusValue, setCurrentStatusValue] = useState('未开始');
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [sorter, setSorter] = useState({ field: 'updatedAt', order: 'descend' });
  
  // New states for global filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [filterImplementationStatus, setFilterImplementationStatus] = useState('ALL');

  // 表格变化处理器 (分页, 排序) - filters from table columns are not used with global filters
  const handleTableChange = (newPagination, tableColumnFilters, sorterParam) => {
    console.log('Table changed:', newPagination, tableColumnFilters, sorterParam);
    setPagination(prev => ({
      ...prev,
      current: newPagination.current,
      pageSize: newPagination.pageSize,
    }));
    if (sorterParam && sorterParam.field && sorterParam.order) {
      setSorter({ field: sorterParam.field, order: sorterParam.order });
    } else {
      setSorter({ field: 'updatedAt', order: 'descend' });
    }
  };

  // 获取当前用户信息
  const fetchCurrentUser = async () => {
    try {
      const user = await authService.getCurrentUser();
      if (!user) {
        message.error('请先登录');
        navigate('/login');
        return;
      }
      setCurrentUser(user);
    } catch (error) {
      console.error('获取用户信息失败:', error);
      message.error('获取用户信息失败');
      navigate('/login');
    }
  };
  
  useEffect(() => {
    fetchCurrentUser();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  // 获取待实施和实施中的建议 - Modified to include global filters
  const fetchImplementationSuggestions = async () => { // Removed page, pageSize, currentSorter params
    if (!currentUser) return; // Don't fetch if no user
    setLoading(true);
    const params = {
      page: pagination.current,
      pageSize: pagination.pageSize,
      sortBy: sorter.field,
      sortOrder: sorter.order === 'ascend' ? 'asc' : 'desc',
      reviewStatus: 'APPROVED', // Core filter for this page
      includeImplementation: true,
      forceRefresh: true 
    };

    if (searchTerm) {
      params.title = searchTerm; // Changed to 'title'
    }
    if (filterType && filterType !== 'ALL') {
      params.type = filterType;
    }
    if (filterImplementationStatus && filterImplementationStatus !== 'ALL') {
      params.implementationStatus = filterImplementationStatus;
    }
    
    // Remove null or undefined params to keep query clean
    Object.keys(params).forEach(key => (params[key] == null || params[key] === '') && delete params[key]);

    console.log('开始获取实施建议数据...');
    console.log('请求参数:', params);
    
    try {
      const response = await suggestionService.getSuggestions(params);
      console.log('获取到实施建议数据:', response);
      
      if (response && response.data && response.pagination) {
        setImplementationSuggestions(response.data);
        setPagination(prev => ({
          ...prev,
          current: response.pagination.current,
          pageSize: response.pagination.pageSize,
          total: response.pagination.total,
        }));
      } else {
        setImplementationSuggestions([]);
        setPagination(prev => ({ ...prev, total: 0 }));
        console.warn('从API获取的数据格式不符合预期或数据为空');
      }
    } catch (error) {
      console.error('获取待实施建议失败:', error);
      message.error('获取待实施建议失败');
      setImplementationSuggestions([]);
      setPagination(prev => ({ ...prev, total: 0, current: 1 }));
    } finally {
      setLoading(false);
    }
  };

  // useEffect for data fetching based on dependencies
  useEffect(() => {
    if (currentUser) { // Ensure currentUser is loaded before fetching
      fetchImplementationSuggestions();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, pagination.current, pagination.pageSize, sorter, searchTerm, filterType, filterImplementationStatus]);

  // Handlers for global filter changes
  const handleGlobalSearch = (value) => {
    setSearchTerm(value);
    setPagination(prev => ({ ...prev, current: 1 })); // Reset to first page
  };

  const handleGlobalTypeChange = (value) => {
    setFilterType(value);
    setPagination(prev => ({ ...prev, current: 1 })); // Reset to first page
  };

  const handleGlobalImplementationStatusChange = (value) => {
    setFilterImplementationStatus(value);
    setPagination(prev => ({ ...prev, current: 1 })); // Reset to first page
  };

  // 点击查看详情
  const handleViewDetail = (id) => {
    navigate(`/suggestions/${id}`);
  };

  // 打开更新实施状态模态框
  const showUpdateModal = (suggestion) => {
    setCurrentSuggestion(suggestion);
    setUpdateModalVisible(true);
    
    // 确定当前状态
    let currentStatus = '未开始';
    
    if (suggestion.implementation && suggestion.implementation.status) {
      // 优先使用implementation中的status
      currentStatus = getStatusDisplayText(suggestion.implementation.status, 'implementation');
    } else if (suggestion.implementationStatus) {
      // 其次使用顶层的implementationStatus
      currentStatus = getStatusDisplayText(suggestion.implementationStatus, 'implementation');
    }
    
    console.log('当前状态:', currentStatus);
    
    // 更新当前状态值
    setCurrentStatusValue(currentStatus);
    
    // 预填表单
    form.setFieldsValue({
      status: currentStatus, // 使用从 getStatusDisplayText 获取的中文状态
      responsiblePerson: suggestion.implementation?.responsiblePerson || '',
      startDate: suggestion.implementation?.startDate ? moment(suggestion.implementation.startDate) : null,
      plannedEndDate: suggestion.implementation?.plannedEndDate ? moment(suggestion.implementation.plannedEndDate) : null,
      actualEndDate: suggestion.implementation?.actualEndDate ? moment(suggestion.implementation.actualEndDate) : null,
      notes: suggestion.implementation?.notes || '',
    });
  };

  // 处理状态变更
  const handleStatusChange = (value) => {
    console.log('状态变更为:', value);
    setCurrentStatusValue(value);
    form.setFieldsValue({ status: value });
  };

  // 关闭更新实施状态模态框
  const handleUpdateCancel = () => {
    setUpdateModalVisible(false);
    setCurrentSuggestion(null);
    form.resetFields();
  };

  // 提交实施状态更新
  const handleUpdateSubmit = async () => {
    try {
      // 验证表单
      const values = await form.validateFields();
      setConfirmLoading(true);

      // 将中文状态转换回英文键
      const statusKey = Object.keys(IMPLEMENTATION_STATUS).find(
        key => IMPLEMENTATION_STATUS[key] === values.status
      );

      if (!statusKey) {
        message.error('无效的状态选择，无法找到对应的状态代码');
        setConfirmLoading(false);
        return;
      }

      const updateData = {
        status: statusKey, // 使用转换后的英文键
        responsiblePerson: values.responsiblePerson,
        startDate: values.startDate?.format('YYYY-MM-DD'),
        plannedCompletionDate: values.plannedEndDate?.format('YYYY-MM-DD'), // 注意字段名对应后端
        actualCompletionDate: values.actualEndDate?.format('YYYY-MM-DD'), // 注意字段名对应后端
        notes: values.notes
        // 移除 evaluation 相关字段
      };

      console.log('准备更新实施状态:', currentSuggestion._id, updateData);

      // 调用 service 更新状态
      const result = await suggestionService.updateImplementation(currentSuggestion._id, updateData);

      console.log('更新实施状态 API 响应:', result);

      if (result && result.success) { // 检查 success 标志
        message.success('实施状态更新成功');
        setUpdateModalVisible(false);
        // 重新加载数据
        fetchImplementationSuggestions();
      } else {
        message.error(result?.message || '操作失败'); // 显示后端返回的错误信息
      }
    } catch (error) {
      console.error('更新实施状态失败:', error);
      // 检查是否是表单验证错误
      if (error.errorFields) {
        message.error('表单填写有误，请检查');
      } else {
         message.error('更新实施状态时发生错误');
      }
    } finally {
      setConfirmLoading(false);
    }
  };

  // 打开详情查看模态框
  const showDetailModal = (suggestion) => {
    setCurrentSuggestion(suggestion);
    setDetailVisible(true);
  };

  // 关闭详情查看模态框
  const handleDetailCancel = () => {
    setDetailVisible(false);
  };

  // 表格列定义
  const desktopColumns = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      sorter: true,
      render: (text, record) => (
        <Button 
          type="link" 
          onClick={() => showDetailModal(record)}
          style={{
            fontSize: '14px',
            padding: '0',
            textAlign: 'left',
            height: 'auto',
            lineHeight: 'normal'
          }}
        >
          <span style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>
            {text}
          </span>
        </Button>
      )
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      sorter: true,
      render: (type) => {
        // 优先使用常量中的中文，其次是原始值
        const typeText = SUGGESTION_TYPES[type] || type;
        return (
          <Tag 
            color={TYPE_COLORS[type] || 'default'}
            style={{ 
              padding: '4px 8px', 
              borderRadius: '4px', 
              fontSize: '14px'
            }}
          >
            {typeText}
          </Tag>
        );
      }
    },
    {
      title: '审核状态',
      dataIndex: 'reviewStatus',
      key: 'reviewStatus',
      sorter: true,
      render: (status) => {
        // 在实施列表，审核状态理论上都应是 '已批准'
        // 使用工具函数获取文本和颜色
        const statusText = getStatusDisplayText(status, 'review');
        const statusColor = getStatusColor(status, 'review'); // 确保 getStatusColor 支持 review 类型
        return (
          <Tag 
            color={statusColor || 'green'}
            style={{ 
              padding: '4px 8px', 
              borderRadius: '4px', 
              fontSize: '14px'
            }}
          >
            {statusText || '已批准'}
          </Tag>
        );
      }
    },
    {
      title: '实施状态',
      dataIndex: 'implementationStatus',
      key: 'implementationStatus',
      sorter: true,
      render: (status, record) => {
        // 优先使用 implementation 对象中的状态，其次才是顶层的 implementationStatus
        const implStatus = record.implementation?.status || status || 'NOT_STARTED';
        const statusText = getStatusDisplayText(implStatus, 'implementation');
        const statusColor = getStatusColor(implStatus, 'implementation');
        
        return (
          <Tag 
            color={statusColor || 'default'}
            style={{ 
              padding: '4px 8px', 
              borderRadius: '4px', 
              fontSize: '14px'
            }}
          >
            {statusText || '未开始'}
          </Tag>
        );
      }
    },
    {
      title: '班组',
      dataIndex: 'team',
      key: 'team',
      sorter: true,
      render: (team) => <span style={{ fontSize: '14px' }}>{team}</span>
    },
    {
      title: '责任人',
      dataIndex: ['implementation', 'responsiblePerson'],
      key: 'responsiblePerson',
      render: (person) => <span style={{ fontSize: '14px' }}>{person || '未分配'}</span>
    },
    {
      title: '计划完成日期',
      dataIndex: ['implementation', 'plannedEndDate'],
      key: 'plannedEndDate',
      render: (date) => (
        <span style={{ fontSize: '14px' }}>
          {date ? moment(date).format('YYYY-MM-DD') : '未设置'}
        </span>
      )
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button 
            type="primary" 
            onClick={() => showUpdateModal(record)}
            style={{ fontSize: '14px' }}
          >
            更新状态
          </Button>
          <Button 
            onClick={() => handleViewDetail(record._id)}
            icon={<FileTextOutlined />}
            style={{ fontSize: '14px' }}
          >
            详情
          </Button>
        </Space>
      )
    }
  ];

  // 添加移动端适配的列定义
  const mobileColumns = [
    {
      title: '建议实施信息',
      dataIndex: 'title',
      key: 'title',
      render: (text, record) => {
        // 获取实施状态
        const implStatus = record.implementation?.status || record.implementationStatus || 'NOT_STARTED';
        const statusText = getStatusDisplayText(implStatus, 'implementation');
        const statusColor = getStatusColor(implStatus, 'implementation');
        
        return (
          <div style={{ padding: '8px 0' }}>
            <div style={{ fontSize: '15px', fontWeight: 'bold', marginBottom: '8px' }}>
              {text}
            </div>
            
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
              <Tag 
                color={TYPE_COLORS[record.type] || 'default'}
                style={{ padding: '2px 6px', fontSize: '12px' }}
              >
                {SUGGESTION_TYPES[record.type] || record.type}
              </Tag>
              
              <Tag 
                color={statusColor}
                style={{ padding: '2px 6px', fontSize: '12px' }}
              >
                {statusText}
              </Tag>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#888', marginBottom: '8px' }}>
              <span>班组: {record.team || '未知'}</span>
              <span>责任人: {record.implementation?.responsiblePerson || '未分配'}</span>
            </div>
            
            <div style={{ fontSize: '12px', color: '#888', marginBottom: '10px' }}>
              <span>计划完成: {record.implementation?.plannedEndDate ? moment(record.implementation.plannedEndDate).format('YYYY-MM-DD') : '未设置'}</span>
            </div>
            
            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
              <Button 
                type="primary" 
                size="small"
                onClick={() => showUpdateModal(record)}
              >
                更新状态
              </Button>
              
              <Button 
                size="small"
                onClick={() => handleViewDetail(record._id)}
              >
                查看详情
              </Button>
            </div>
          </div>
        );
      }
    }
  ];

  const renderImplementationDetail = () => {
    if (!currentSuggestion || !currentSuggestion.implementation) {
      return <Alert message="暂无实施信息" type="info" showIcon />;
    }
    
    const implementation = currentSuggestion.implementation;
    const history = implementation.statusHistory || implementation.history || [];
    
    console.log('实施历史记录:', history);
    
    return (
      <div>
        <Card title="实施基本信息" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <div style={{ marginBottom: 16, minWidth: '45%' }}>
              <Text strong>实施状态: </Text>
              <Tag 
                color={getStatusColor(implementation.status || '未开始')}
                style={{ 
                  padding: '4px 8px', 
                  borderRadius: '4px', 
                  fontSize: '14px'
                }}
              >
                {getStatusDisplayText(implementation.status || '未开始', 'implementation')}
              </Tag>
            </div>
            
            <div style={{ marginBottom: 16, minWidth: '45%' }}>
              <Text strong>责任人: </Text>
              <Text>{implementation.responsiblePerson || '未分配'}</Text>
            </div>
            
            <div style={{ marginBottom: 16, minWidth: '45%' }}>
              <Text strong>开始日期: </Text>
              <Text>{implementation.startDate ? moment(implementation.startDate).format('YYYY-MM-DD') : '未设置'}</Text>
            </div>
            
            <div style={{ marginBottom: 16, minWidth: '45%' }}>
              <Text strong>计划完成日期: </Text>
              <Text>{implementation.plannedEndDate ? moment(implementation.plannedEndDate).format('YYYY-MM-DD') : '未设置'}</Text>
            </div>
            
            {implementation.actualEndDate && (
              <div style={{ marginBottom: 16, minWidth: '45%' }}>
                <Text strong>实际完成日期: </Text>
                <Text>{moment(implementation.actualEndDate).format('YYYY-MM-DD')}</Text>
              </div>
            )}
          </div>
          
          {implementation.notes && (
            <div style={{ marginTop: 16 }}>
              <Text strong>实施备注: </Text>
              <Paragraph>{implementation.notes}</Paragraph>
            </div>
          )}
        </Card>
        
        {implementation.attachments && implementation.attachments.length > 0 && (
          <Card title="实施附件" style={{ marginBottom: 16 }}>
            <ul style={{ paddingLeft: 20 }}>
              {implementation.attachments.map((attachment, index) => (
                <li key={index}>
                  <a href={attachment.url} target="_blank" rel="noopener noreferrer">
                    {attachment.name}
                  </a>
                </li>
              ))}
            </ul>
          </Card>
        )}
        
        {history && history.length > 0 ? (
          <Card title="实施历史记录" style={{ marginBottom: 16 }}>
            <Timeline reverse={true}>
              {[...history].reverse().map((record, index) => (
                <Timeline.Item 
                  key={index} 
                  color={getStatusColor(record.status)}
                  dot={
                    <div style={{ 
                      background: getStatusColor(record.status), 
                      borderRadius: '50%', 
                      width: '16px', 
                      height: '16px', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center' 
                    }}>
                      {index === 0 && <ClockCircleOutlined style={{ fontSize: '10px', color: '#fff' }} />}
                    </div>
                  }
                >
                  <div style={{ 
                    border: '1px solid #f0f0f0', 
                    borderRadius: '4px', 
                    padding: '12px', 
                    marginBottom: '8px',
                    backgroundColor: '#fafafa'
                  }}>
                    <div style={{ borderBottom: '1px solid #f0f0f0', paddingBottom: '8px', marginBottom: '8px' }}>
                      <Tag 
                        color={getStatusColor(record.status)}
                        style={{ 
                          padding: '4px 8px', 
                          borderRadius: '4px', 
                          fontSize: '14px'
                        }}
                      >
                        {getStatusDisplayText(record.status, 'implementation')}
                      </Tag>
                      <Text type="secondary" style={{ marginLeft: '8px' }}>
                        {moment(record.date || record.timestamp).format('YYYY-MM-DD HH:mm:ss')}
                      </Text>
                    </div>
                    
                    <p><Text strong>操作人员: </Text>{record.updatedBy?.name || record.updatedBy || '系统'}</p>
                    {(record.notes || record.comments) && (
                      <div style={{ marginTop: '4px' }}>
                        <Text strong>备注信息: </Text>
                        <div style={{ 
                          backgroundColor: '#fff', 
                          padding: '8px', 
                          borderRadius: '4px',
                          border: '1px solid #f0f0f0',
                          marginTop: '4px'
                        }}>
                          {record.notes || record.comments}
                        </div>
                      </div>
                    )}
                    
                    {index < history.length - 1 && index !== 0 && (
                      <div style={{ marginTop: '8px' }}>
                        <Text type="secondary">
                          状态持续时间: {
                            moment(record.date || record.timestamp).diff(moment([...history].reverse()[index-1].date || [...history].reverse()[index-1].timestamp), 'hours') >= 24 ?
                            `${moment(record.date || record.timestamp).diff(moment([...history].reverse()[index-1].date || [...history].reverse()[index-1].timestamp), 'days')} 天` :
                            `${moment(record.date || record.timestamp).diff(moment([...history].reverse()[index-1].date || [...history].reverse()[index-1].timestamp), 'hours')} 小时`
                          }
                        </Text>
                      </div>
                    )}
                  </div>
                </Timeline.Item>
              ))}
            </Timeline>
          </Card>
        ) : (
          <Card title="实施历史记录" style={{ marginBottom: 16 }}>
            <Empty description="暂无状态变更记录" />
          </Card>
        )}
      </div>
    );
  };

  // 获取可用的状态选项
  const getStatusOptions = (currentStatus) => {
    // 直接返回所有有效的实施状态
    return Object.entries(IMPLEMENTATION_STATUS)
           // 过滤掉 EVALUATED (虽然常量已移除，双重保险)
           .filter(([key, value]) => key !== 'EVALUATED') 
           .map(([key, value]) => ({ 
             value: value, // 使用中文值作为选项值和显示文本
             label: value 
           }));
  };

  // 在组件函数内的状态声明区域添加移动设备检测状态
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  // 在 useEffect 区域添加窗口大小监听代码
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <div className="responsive-container" style={{ padding: isMobile ? '12px' : '24px' }}>
      {/* Global Filter UI */}
      <Card style={{ marginBottom: isMobile ? '12px' : '20px' }} bodyStyle={{ padding: isMobile ? '12px' : '24px' }}>
        <Form layout={isMobile ? "vertical" : "inline"}>
          <Row gutter={isMobile ? 8 : 16} style={{ width: '100%' }}>
            <Col xs={24} sm={12} md={8} lg={6}>
              <Form.Item style={{width: '100%', marginBottom: isMobile ? '12px' : '20px'}} label="搜索">
                <Input.Search
                  placeholder="搜索建议标题..."
                  allowClear
                  onSearch={handleGlobalSearch}
                  onChange={(e) => {
                    if (!e.target.value) handleGlobalSearch('');
                  }}
                  enterButton
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8} lg={6}>
              <Form.Item style={{width: '100%', marginBottom: isMobile ? '12px' : '20px'}} label="类型">
                <Select
                  value={filterType}
                  onChange={handleGlobalTypeChange}
                  style={{ width: '100%' }}
                  placeholder="所有类型"
                >
                  <Option value="ALL">所有类型</Option>
                  {Object.entries(SUGGESTION_TYPES).map(([key, value]) => (
                    <Option key={key} value={key}>{value}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8} lg={6}>
              <Form.Item style={{width: '100%', marginBottom: isMobile ? '12px' : '20px'}} label="实施状态">
                <Select
                  value={filterImplementationStatus}
                  onChange={handleGlobalImplementationStatusChange}
                  style={{ width: '100%' }}
                  placeholder="所有实施状态"
                >
                  <Option value="ALL">所有实施状态</Option>
                  {Object.entries(IMPLEMENTATION_STATUS).map(([key, value]) => (
                    <Option key={key} value={key}>{value}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Card>

      <Card bodyStyle={{ padding: isMobile ? '12px' : '24px' }}>
        <Title level={isMobile ? 4 : 3} style={{ fontSize: isMobile ? '18px' : '20px', marginBottom: isMobile ? '16px' : '20px' }}>建议实施跟踪</Title>
        
        <Table
          columns={isMobile ? mobileColumns : desktopColumns}
          dataSource={implementationSuggestions}
          rowKey="_id"
          loading={loading}
          onChange={handleTableChange}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            size: isMobile ? "small" : "default",
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条建议`
          }}
          scroll={isMobile ? {} : {}}
        />
      </Card>

      {/* 更新实施状态模态框 */}
      <Modal
        title="更新实施状态"
        visible={updateModalVisible}
        onCancel={handleUpdateCancel}
        footer={null}
        width={isMobile ? '95%' : 600}
        bodyStyle={{ padding: isMobile ? '16px' : '24px' }}
      >
        <Form
          form={form}
          onFinish={handleUpdateSubmit}
          layout="vertical"
        >
          <Row gutter={isMobile ? 8 : 16}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="status"
                label="实施状态"
                rules={[{ required: true, message: '请选择实施状态' }]}
              >
                <Select
                  placeholder="请选择实施状态"
                  onChange={handleStatusChange}
                  options={getStatusOptions(currentStatusValue)}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="responsiblePerson"
                label="责任人"
                rules={[
                  { required: true, message: '请输入责任人' },
                  { max: 50, message: '责任人不能超过50个字符' },
                ]}
              >
                <Input placeholder="请输入责任人" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={isMobile ? 8 : 16}>
            <Col xs={24} sm={8}>
              <Form.Item
                name="startDate"
                label="开始日期"
                rules={[{ required: true, message: '请选择开始日期' }]}
              >
                <DatePicker 
                  style={{ width: '100%' }} 
                  placeholder="选择日期"
                  format="YYYY-MM-DD"
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item
                name="plannedEndDate"
                label="计划完成日期"
                rules={[{ required: true, message: '请选择计划完成日期' }]}
              >
                <DatePicker 
                  style={{ width: '100%' }} 
                  placeholder="选择日期"
                  format="YYYY-MM-DD"
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item
                name="actualEndDate"
                label="实际完成日期"
              >
                <DatePicker 
                  style={{ width: '100%' }} 
                  placeholder="选择日期"
                  format="YYYY-MM-DD"
                  disabled={!['COMPLETED', '已完成'].includes(currentStatusValue)}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="notes"
            label="实施备注"
          >
            <Input.TextArea rows={isMobile ? 3 : 4} placeholder="请输入实施过程中的详细说明" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={isMobile ? 12 : 8}>
              <Button type="primary" htmlType="submit" loading={confirmLoading} style={{ width: '100%' }}>
                提交
              </Button>
            </Col>
            <Col span={isMobile ? 12 : 8}>
              <Button onClick={handleUpdateCancel} style={{ width: '100%' }}>
                取消
              </Button>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* 建议实施详情模态框 */}
      <Modal
        title={currentSuggestion ? `建议实施跟踪: ${currentSuggestion.title}` : '建议详情'}
        visible={detailVisible}
        onCancel={handleDetailCancel}
        footer={[
          <Button key="back" onClick={handleDetailCancel} style={{ fontSize: '14px' }}>
            关闭
          </Button>,
        ]}
        width={isMobile ? '95%' : 800}
        bodyStyle={{ fontSize: '14px', padding: isMobile ? '16px' : '24px' }}
      >
        {currentSuggestion && (
          <div>
            <Card title="建议基本信息" style={{ marginBottom: 16 }} bodyStyle={{ padding: isMobile ? '12px' : '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                <div style={{ marginBottom: 16, minWidth: isMobile ? '100%' : '45%' }}>
                  <Text strong>建议类型: </Text>
                  <Tag 
                    color={TYPE_COLORS[currentSuggestion.type] || 'default'}
                    style={{ 
                      marginLeft: '8px',
                      padding: '4px 8px', 
                      borderRadius: '4px', 
                      fontSize: '14px'
                    }}
                  >
                    {SUGGESTION_TYPES[currentSuggestion.type] || currentSuggestion.type}
                  </Tag>
                </div>
                
                <div style={{ marginBottom: 16, minWidth: isMobile ? '100%' : '45%' }}>
                  <Text strong>提交人: </Text>
                  <Text>{currentSuggestion.submitter?.name || '未知'}</Text>
                </div>
                
                <div style={{ marginBottom: 16, minWidth: isMobile ? '100%' : '45%' }}>
                  <Text strong>班组: </Text>
                  <Text>{currentSuggestion.team || '未知'}</Text>
                </div>
                
                <div style={{ marginBottom: 16, minWidth: isMobile ? '100%' : '45%' }}>
                  <Text strong>提交时间: </Text>
                  <Text>{currentSuggestion.createdAt ? moment(currentSuggestion.createdAt).format('YYYY-MM-DD HH:mm') : '未知'}</Text>
                </div>
              </div>
              
              <div style={{ marginTop: 16 }}>
                <Text strong>建议内容: </Text>
                <Paragraph>{currentSuggestion.content}</Paragraph>
              </div>
            </Card>
            
            {/* 实施详情 */}
            {renderImplementationDetail()}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ImplementationList; 