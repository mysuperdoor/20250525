import React, { useState, useEffect, useCallback } from 'react';
import { 
  Card, 
  Table, 
  Tag, 
  Button, 
  Space, 
  message, 
  Typography, 
  Alert,
  Tooltip,
  Badge,
  Tabs,
  Modal,
  Form,
  Input,
  Radio,
  Row,
  Col
} from 'antd';
import { useNavigate } from 'react-router-dom';
import { 
  CheckCircleOutlined, 
  CloseCircleOutlined, 
  FileTextOutlined,
  QuestionCircleOutlined
} from '@ant-design/icons';
import { suggestionService } from '../../../services/suggestionService';
import { authService } from '../../../services/authService';
import { SUGGESTION_TYPES, STATUS_COLORS, TYPE_COLORS, REVIEW_STATUS } from '../../../constants/suggestions';
import { getCurrentStatus } from '../../../utils/suggestionUtils';

const { Title, Text, TextArea } = Typography;
const { TabPane } = Tabs;

// 获取当前用户信息
const ReviewList = () => {
  const navigate = useNavigate();
  const [pendingReviews, setPendingReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState('');
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [currentSuggestion, setCurrentSuggestion] = useState(null);
  const [reviewForm] = Form.useForm();
  const [reviewType, setReviewType] = useState('');
  const [sortInfo, setSortInfo] = useState({ field: null, order: null });
  // 添加移动设备检测状态
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: window.innerWidth <= 768 ? 5 : 10,
    total: 0,
  });
  const [firstReviewTotalCount, setFirstReviewTotalCount] = useState(0);
  const [secondReviewTotalCount, setSecondReviewTotalCount] = useState(0);

  // 监听窗口大小变化
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      setPagination(prev => ({ ...prev, pageSize: mobile ? 5 : 10 }));
    };
    
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // 根据用户角色确定可以查看的审核类型
  const isSupervisor = currentUser?.role === '值班主任';
  const isSafetyAdmin = currentUser?.role === '安全科管理人员';
  const isOperationAdmin = currentUser?.role === '运行科管理人员';
  const isDepartmentManager = currentUser?.role === '部门经理';
  
  const canAccessFirstTab = isSupervisor || isDepartmentManager;
  const canAccessSecondTab = isSafetyAdmin || isOperationAdmin || isDepartmentManager;

  // 获取当前用户信息
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const user = await authService.getCurrentUser();
        if (!user || !user.role) {
          message.error('请先登录或用户信息不完整');
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
    
    fetchCurrentUser();
  }, [navigate]);

  // 设置默认激活的 Tab
  useEffect(() => {
    if (currentUser) {
      if (canAccessFirstTab) {
        setActiveTab('first');
      } else if (canAccessSecondTab) {
        setActiveTab('second');
      } else {
        setActiveTab('');
      }
    }
  }, [currentUser, canAccessFirstTab, canAccessSecondTab]);

  // 获取待审核建议 (添加排序参数)
  const fetchPendingReviews = useCallback(async () => {
    if (!currentUser || !activeTab) {
      setPendingReviews([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const params = {
        page: pagination.current,
        limit: pagination.pageSize,
      };

      if (sortInfo.field && sortInfo.order) {
        params.sortBy = sortInfo.field;
        params.sortOrder = sortInfo.order === 'ascend' ? 'asc' : 'desc';
      }

      if (activeTab === 'first') {
        params.reviewStatus = 'PENDING_FIRST_REVIEW';
      } else if (activeTab === 'second') {
        params.reviewStatus = 'PENDING_SECOND_REVIEW';
      } else {
        setPendingReviews([]);
        setPagination(prev => ({ ...prev, total: 0, current: 1 }));
        setLoading(false);
        console.log('No active/authorized tab for fetching reviews.');
        return;
      }
      
      console.log('[ReviewList] Fetching suggestions with params:', params);
      const response = await suggestionService.getSuggestions(params);

      console.log('[ReviewList] Received suggestions response:', response);
      
      setPendingReviews(response.data || []);
      const backendPagination = response.pagination || { total: 0, current: 1, pageSize: pagination.pageSize };
      setPagination(prev => ({
        ...prev,
        current: backendPagination.current,
        pageSize: backendPagination.pageSize,
        total: backendPagination.total,
      }));

      if (activeTab === 'first') {
        setFirstReviewTotalCount(backendPagination.total || 0);
      } else if (activeTab === 'second') {
        setSecondReviewTotalCount(backendPagination.total || 0);
      }

    } catch (error) {
      console.error('获取待审核建议失败:', error);
      message.error('获取待审核建议失败: ' + (error.response?.data?.message || error.message));
      setPendingReviews([]);
      setPagination(prev => ({ ...prev, total: 0 }));
    } finally {
      setLoading(false);
    }
  }, [currentUser, activeTab, sortInfo.field, sortInfo.order, pagination.current, pagination.pageSize]);

  useEffect(() => {
    if (currentUser && activeTab) {
      fetchPendingReviews();
    } else if (currentUser && !canAccessFirstTab && !canAccessSecondTab) {
      setLoading(false);
      setPendingReviews([]);
      setPagination(prev => ({ ...prev, current: 1, total: 0 }));
    }
  }, [currentUser, activeTab, fetchPendingReviews, canAccessFirstTab, canAccessSecondTab, pagination.current, pagination.pageSize]);

  // 点击查看详情
  const handleViewDetail = (id) => {
    navigate(`/suggestions/${id}`);
  };

  // 处理审核操作
  const handleReview = (record, type) => {
    setCurrentSuggestion(record);
    setReviewType(type);
    setReviewModalVisible(true);
  };

  // 处理审核提交
  const handleSubmitReview = async (values) => {
    setLoading(true); // Add loading state for review submission
    try {
      const { result, comment } = values;
      const reviewData = {
        suggestionId: currentSuggestion._id,
        reviewType, // Already set in state by handleReview
        comment,
        result: result === 'approve' ? 'APPROVED' : 'REJECTED', // Ensure correct value for backend
        reviewerId: currentUser._id
      };

      console.log('提交审核数据:', JSON.stringify(reviewData, null, 2));
      console.log('当前建议状态:', currentSuggestion.status);
      console.log('当前用户角色:', currentUser?.role);
      console.log('当前用户班组:', currentUser?.team);
      console.log('建议所属班组:', currentSuggestion.team);
      console.log('建议类型:', currentSuggestion.type);
      
      await suggestionService.submitReview(reviewData);
      message.success('审核提交成功');
      setReviewModalVisible(false);
      reviewForm.resetFields();
      
      // Fetch reviews for the current tab and page to reflect changes
      fetchPendingReviews();
      
      // 2秒后再次刷新，确保状态更新完全同步
      setTimeout(() => {
        fetchPendingReviews();
      }, 2000);
    } catch (error) {
      console.error('审核提交失败:', error);
      message.error('审核提交失败: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  // 表格列定义 - 桌面版
  const desktopColumns = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      sorter: true,
      render: (text, record) => (
        <Button
          type="link"
          onClick={() => handleViewDetail(record._id)}
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
      render: (type) => (
        <Tag 
          color={TYPE_COLORS[type] || 'default'}
          style={{ 
            padding: '4px 8px', 
            borderRadius: '4px', 
            fontSize: '14px'
          }}
        >
          {SUGGESTION_TYPES[type] || type}
        </Tag>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      sorter: true,
      render: (status, record) => {
        const currentStatusKey = getCurrentStatus(record, true);
        const displayColor = STATUS_COLORS[currentStatusKey] || 'default';
        const displayText = REVIEW_STATUS[currentStatusKey] || currentStatusKey;
        
        return (
          <Tag 
            color={displayColor}
            style={{ 
              padding: '4px 8px', 
              borderRadius: '4px', 
              fontSize: '14px'
            }}
          >
            {displayText}
          </Tag>
        );
      }
    },
    {
      title: '提交人',
      dataIndex: 'submitter',
      key: 'submitter',
      sorter: true,
      render: (submitter) => <span style={{ fontSize: '14px' }}>{submitter?.name || '未知'}</span>
    },
    {
      title: '班组',
      dataIndex: 'team',
      key: 'team',
      sorter: true,
      render: (team) => <span style={{ fontSize: '14px' }}>{team}</span>
    },
    {
      title: '提交时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      sorter: true,
      render: (text) => <span style={{ fontSize: '14px' }}>{text ? new Date(text).toLocaleString() : '未知'}</span>
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => {
        const currentStatus = getCurrentStatus(record);
        // 一级审核按钮
        const firstReviewButton = (
          currentStatus === 'PENDING_FIRST_REVIEW' && 
          (isSupervisor || isDepartmentManager)
        ) && (
          <Button 
            type="primary" 
            onClick={() => handleReview(record, 'first')}
            style={{ fontSize: '14px' }}
          >
            一级审核
          </Button>
        );

        // 二级审核按钮
        const secondReviewButton = (
          currentStatus === 'PENDING_SECOND_REVIEW' && 
          (
            (isSafetyAdmin && (record.type === '安全管理' || record.type === 'SAFETY')) || 
            (isOperationAdmin && record.type !== '安全管理' && record.type !== 'SAFETY') || 
            isDepartmentManager
          )
        ) && (
          <Button 
            type="primary" 
            onClick={() => handleReview(record, 'second')}
            style={{ fontSize: '14px' }}
          >
            二级审核
          </Button>
        );

        return (
          <Space>
            {firstReviewButton}
            {secondReviewButton}
            <Button 
              type="default" 
              icon={<FileTextOutlined />} 
              onClick={() => handleViewDetail(record._id)}
              style={{ fontSize: '14px' }}
            >
              查看详情
            </Button>
          </Space>
        );
      }
    }
  ];

  // 移动端卡片式列定义
  const mobileColumns = [
    {
      title: '建议信息',
      dataIndex: 'title',
      key: 'title',
      render: (text, record) => {
        const currentStatus = getCurrentStatus(record);
        // 检查是否可以进行一级审核
        const canFirstReview = (
          currentStatus === 'PENDING_FIRST_REVIEW' && 
          (isSupervisor || isDepartmentManager)
        );

        // 检查是否可以进行二级审核
        const canSecondReview = (
          currentStatus === 'PENDING_SECOND_REVIEW' && 
          (
            (isSafetyAdmin && (record.type === '安全管理' || record.type === 'SAFETY')) || 
            (isOperationAdmin && record.type !== '安全管理' && record.type !== 'SAFETY') || 
            isDepartmentManager
          )
        );

        return (
          <div style={{ padding: '8px 0' }}>
            <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '8px' }}>
              {text}
            </div>
            
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
              <Tag 
                color={TYPE_COLORS[record.type] || 'default'}
                style={{ padding: '2px 6px', fontSize: '12px' }}
              >
                {SUGGESTION_TYPES[record.type] || record.type}
              </Tag>
              
              <Tag 
                color={STATUS_COLORS[currentStatus] || 'default'}
                style={{ padding: '2px 6px', fontSize: '12px' }}
              >
                {REVIEW_STATUS[currentStatus] || currentStatus}
              </Tag>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#888', marginBottom: '10px' }}>
              <span>{record.submitter?.name || '未知'} ({record.team || '未知班组'})</span>
              <span>{record.createdAt ? new Date(record.createdAt).toLocaleDateString() : '未知'}</span>
            </div>
            
            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
              {canFirstReview && (
                <Button 
                  type="primary" 
                  size="small"
                  onClick={() => handleReview(record, 'first')}
                >
                  一级审核
                </Button>
              )}
              
              {canSecondReview && (
                <Button 
                  type="primary" 
                  size="small"
                  onClick={() => handleReview(record, 'second')}
                >
                  二级审核
                </Button>
              )}
              
              <Button 
                type="default" 
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

  // 表格变化处理函数（排序、分页）
  const handleTableChange = (pageInfo, filters, sorter) => {
    const newPagination = {
      ...pagination,
      current: pageInfo.current,
      pageSize: pageInfo.pageSize,
    };
    let newSortInfo = sortInfo;
    if (sorter.field !== sortInfo.field || sorter.order !== sortInfo.order) {
      newSortInfo = { field: sorter.field, order: sorter.order };
    }
    setSortInfo(newSortInfo);
    setPagination(newPagination);
  };

  return (
    <div className="responsive-container" style={{ padding: isMobile ? '12px' : '24px' }}>
      <Card bodyStyle={{ padding: isMobile ? '12px' : '24px' }}>
        <Title level={isMobile ? 4 : 3} style={{ fontSize: isMobile ? '18px' : '20px', marginBottom: isMobile ? '16px' : '20px' }}>建议审核管理</Title>
        
        {!canAccessFirstTab && !canAccessSecondTab ? (
          <Alert
            message="无访问权限"
            description="您没有权限访问审核管理页面"
            type="error"
            showIcon
          />
        ) : (
          <Tabs activeKey={activeTab} onChange={(key) => setActiveTab(key)}>
            {canAccessFirstTab && (
              <TabPane 
                tab={
                  <span>
                    一级审核
                    <Badge count={firstReviewTotalCount} offset={[5, -5]} style={{ backgroundColor: '#FF4D4F' }} />
                  </span>
                }
                key="first"
              >
                {(loading && pagination.current === 1 && pendingReviews.length === 0) || firstReviewTotalCount === 0 ? (
                  <Alert
                    message="暂无待审核建议"
                    description="当前没有需要进行一级审核的建议"
                    type="info"
                    showIcon
                  />
                ) : (
                  <Table
                    columns={isMobile ? mobileColumns : desktopColumns}
                    dataSource={pendingReviews}
                    rowKey="_id"
                    loading={loading}
                    pagination={pagination}
                    onChange={handleTableChange}
                    style={{ fontSize: isMobile ? '13px' : '14px' }}
                    className="suggestions-table"
                    bordered
                    rowClassName={() => 'suggestion-row'}
                    scroll={isMobile ? {} : {}}
                    size={isMobile ? "small" : "default"}
                  />
                )}
              </TabPane>
            )}

            {canAccessSecondTab && (
              <TabPane 
                tab={
                  <span>
                    二级审核
                    <Badge count={secondReviewTotalCount} offset={[5, -5]} style={{ backgroundColor: '#FF4D4F' }} />
                  </span>
                }
                key="second"
              >
                {(loading && pagination.current === 1 && pendingReviews.length === 0) || secondReviewTotalCount === 0 ? (
                  <Alert
                    message="暂无待审核建议"
                    description="当前没有需要进行二级审核的建议"
                    type="info"
                    showIcon
                  />
                ) : (
                  <Table
                    columns={isMobile ? mobileColumns : desktopColumns}
                    dataSource={pendingReviews}
                    rowKey="_id"
                    loading={loading}
                    pagination={pagination}
                    onChange={handleTableChange}
                    style={{ fontSize: isMobile ? '13px' : '14px' }}
                    className="suggestions-table"
                    bordered
                    rowClassName={() => 'suggestion-row'}
                    scroll={isMobile ? {} : {}}
                    size={isMobile ? "small" : "default"}
                  />
                )}
              </TabPane>
            )}
          </Tabs>
        )}

        <Modal
          title={`${reviewType === 'first' ? '一级' : '二级'}审核`}
          visible={reviewModalVisible}
          onCancel={() => {
            setReviewModalVisible(false);
            reviewForm.resetFields();
          }}
          footer={null}
          bodyStyle={{ fontSize: '14px' }}
          width={isMobile ? '95%' : 520}
        >
          <Form
            form={reviewForm}
            onFinish={handleSubmitReview}
            layout="vertical"
          >
            <Form.Item
              name="result"
              label="审核结果"
              rules={[{ required: true, message: '请选择审核结果' }]}
            >
              <Radio.Group style={{ fontSize: '14px' }}>
                <Radio value="approve">通过</Radio>
                <Radio value="reject">拒绝</Radio>
              </Radio.Group>
            </Form.Item>

            <Form.Item
              name="comment"
              label="审核意见"
              rules={[{ required: true, message: '请输入审核意见' }]}
            >
              <Input.TextArea rows={isMobile ? 3 : 4} style={{ fontSize: '14px' }} />
            </Form.Item>

            <Form.Item>
              <Row gutter={16}>
                <Col span={isMobile ? 12 : 8}>
                  <Button
                    type="primary"
                    htmlType="submit"
                    style={{ width: '100%', fontSize: '14px' }}
                  >
                    提交
                  </Button>
                </Col>
                <Col span={isMobile ? 12 : 8}>
                  <Button 
                    onClick={() => {
                      setReviewModalVisible(false);
                      reviewForm.resetFields();
                    }}
                    style={{ width: '100%', fontSize: '14px' }}
                  >
                    取消
                  </Button>
                </Col>
              </Row>
            </Form.Item>
          </Form>
        </Modal>
      </Card>
    </div>
  );
};

export default ReviewList; 