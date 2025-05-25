import React, { useState, useEffect } from 'react';
import {
  Table,
  Tag,
  Space,
  Button,
  message,
  Input,
  Select,
  Row,
  Col,
  Form
} from 'antd';
import { EyeOutlined, EditOutlined, SearchOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { suggestionService } from '../../services/suggestionService';
import { authService } from '../../services/authService';
import { useNavigate } from 'react-router-dom';
import {
  SUGGESTION_TYPES,
  REVIEW_STATUS,
  STATUS_COLORS,
  TYPE_COLORS,
  IMPLEMENTATION_STATUS,
  IMPLEMENTATION_STATUS_COLORS
} from '../../constants/suggestions';
import { getStatusDisplayText, getStatusColor } from '../../utils/statusUtils';
import { getCurrentStatus } from '../../utils/suggestionUtils';

const { Option } = Select;

const SuggestionList = () => {
  console.log('STATUS_COLORS:', STATUS_COLORS);
  
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });
  const [sorter, setSorter] = useState({ field: 'createdAt', order: 'descend' });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [filterReviewStatus, setFilterReviewStatus] = useState('ALL');
  const [filterImplementationStatus, setFilterImplementationStatus] = useState('ALL');
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  const currentUser = authService.getCurrentUser();
  const isManager = currentUser?.role === '部门经理';
  const isSupervisor = currentUser?.role === '值班主任';
  const isSafetyAdmin = currentUser?.role === '安全科管理人员';
  const isOperationAdmin = currentUser?.role === '运行科管理人员';

  const navigate = useNavigate();

  const fetchSuggestions = async () => {
    setLoading(true);
    const params = {
      page: pagination.current,
      limit: pagination.pageSize,
      sortBy: sorter.field,
      sortOrder: sorter.order === 'ascend' ? 'asc' : 'desc',
    };

    if (searchTerm) {
      params.title = searchTerm;
    }
    if (filterType && filterType !== 'ALL') {
      params.type = filterType;
    }
    if (filterReviewStatus && filterReviewStatus !== 'ALL') {
      params.reviewStatus = filterReviewStatus; 
    }
    if (filterImplementationStatus && filterImplementationStatus !== 'ALL') {
      params.implementationStatus = filterImplementationStatus;
    }
    
    Object.keys(params).forEach(key => (params[key] == null) && delete params[key]);

    console.log('Fetching suggestions with params:', params);

    try {
      const response = await suggestionService.getSuggestions(params);
      console.log('获取到的建议列表数据:', response);
      
      const { data, pagination: responsePagination } = response;
      setSuggestions(data || []);
      
      // 更详细的日志
      console.log('获取到的建议数量:', data?.length || 0);
      console.log('原始分页信息:', responsePagination);
      
      // 确保分页信息正确更新
      if (responsePagination) {
        const newPagination = {
          ...pagination,
          current: parseInt(responsePagination.current) || pagination.current,
          pageSize: parseInt(responsePagination.pageSize) || pagination.pageSize,
          total: parseInt(responsePagination.total) || 0
        };
        console.log('更新后的分页信息:', newPagination);
        setPagination(newPagination);
      } else {
        // 如果没有分页信息，则至少更新total
        const newPagination = { 
          ...pagination, 
          total: data?.length || 0,
          current: params.page || pagination.current
        };
        console.log('没有分页信息，使用默认值:', newPagination);
        setPagination(newPagination);
      }
    } catch (error) {
      console.error('获取建议列表失败:', error);
      message.error('获取建议列表失败');
      setSuggestions([]);
      setPagination(prev => ({ ...prev, total: 0, current: 1}));
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    fetchSuggestions();
  }, [pagination.current, pagination.pageSize, sorter, searchTerm, filterType, filterReviewStatus, filterImplementationStatus]);

  useEffect(() => {
    const handleFocus = () => {
      console.log('SuggestionList window focused, refreshing data with current filters...');
      fetchSuggestions();
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const handleSearch = (value) => {
    setSearchTerm(value);
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  const handleTypeChange = (value) => {
    setFilterType(value);
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  const handleReviewStatusChange = (value) => {
    setFilterReviewStatus(value);
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  const handleImplementationStatusChange = (value) => {
    setFilterImplementationStatus(value);
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  const handleTableChange = (newPageInfo, tableFilters, newSorter) => {
    console.log('Table changed:', newPageInfo, tableFilters, newSorter);
    setPagination(prev => ({
        ...prev,
        current: newPageInfo.current,
        pageSize: newPageInfo.pageSize,
    }));
    
    if (newSorter && newSorter.field) {
        setSorter({ field: newSorter.field, order: newSorter.order });
    } else {
        setSorter({ field: 'createdAt', order: 'descend' });
    }
  };

  const handleView = (record) => {
    navigate(`/suggestions/${record._id}`);
  };

  const columns = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      width: '20%',
      sorter: true,
      render: (text, record) => (
        <Link to={`/suggestions/${record._id}`} style={{ fontSize: '14px' }}>
          {text}
        </Link>
      )
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: '10%',
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
      title: '提交人',
      dataIndex: ['submitter', 'name'],
      key: 'submitter',
      width: '10%',
      sorter: true,
      render: (text, record) => <span style={{ fontSize: '14px' }}>{record.submitter ? record.submitter.name : '未知'}</span>
    },
    {
      title: '提交时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: '15%',
      sorter: true,
      render: (text) => <span style={{ fontSize: '14px' }}>{text ? new Date(text).toLocaleString() : '未知'}</span>
    },
    {
      title: '建议状态',
      dataIndex: 'status',
      key: 'status',
      width: '10%',
      sorter: true,
      render: (status, record) => {
        const currentStatus = getCurrentStatus(record);
        console.log('状态渲染:', {
          原始状态: status,
          当前状态: currentStatus,
          状态颜色: STATUS_COLORS[currentStatus],
          状态显示文本: REVIEW_STATUS[currentStatus] || currentStatus
        });
        
        const displayColor = STATUS_COLORS[currentStatus] || 'default';
        
        return (
          <Tag 
            color={displayColor}
            style={{ 
              padding: '4px 8px', 
              borderRadius: '4px', 
              fontSize: '14px'
            }}
          >
            {REVIEW_STATUS[currentStatus] || currentStatus}
          </Tag>
        );
      }
    },
    {
      title: '实施状态',
      dataIndex: 'implementationStatus',
      key: 'implementationStatus',
      width: '10%',
      sorter: true,
      render: (status, record) => {
        const implStatus = record.implementation?.status || status || 'NOT_STARTED';
        const statusText = getStatusDisplayText(implStatus, 'implementation');
        const statusColor = getStatusColor(implStatus, 'implementation');

        return (
          <Tag
            color={statusColor}
            style={{
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '14px'
            }}
          >
            {statusText}
          </Tag>
        );
      }
    },
    {
      title: '得分',
      dataIndex: ['scoring', 'score'],
      key: 'score',
      width: '8%',
      sorter: (a, b) => {
        const scoreA = a.scoring?.score;
        const scoreB = b.scoring?.score;
        
        if (scoreA !== undefined && scoreA !== null && 
            scoreB !== undefined && scoreB !== null) {
          return scoreA - scoreB;
        }
        
        if (scoreA === undefined || scoreA === null) return 1;
        if (scoreB === undefined || scoreB === null) return -1;
        return 0;
      },
      render: (score) => (
        <span style={{ fontSize: '14px', fontWeight: 'bold' }}>
          {typeof score === 'number' ? score.toFixed(1) : '-'}
        </span>
      )
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => {
        const currentStatus = getCurrentStatus(record);
        return (
          <Space>
            <Button
              type="link"
              icon={<EyeOutlined />}
              onClick={() => handleView(record)}
              style={{ fontSize: '14px' }}
            >
              查看
            </Button>
            {isManager && currentStatus === 'PENDING_FIRST_REVIEW' && (
              <Button
                type="link"
                icon={<EditOutlined />}
                onClick={() => navigate(`/suggestions/${record._id}`)}
                style={{ fontSize: '14px' }}
              >
                一级审核
              </Button>
            )}
            {isSafetyAdmin && currentStatus === 'PENDING_SECOND_REVIEW' && record.type === 'SAFETY' && (
              <Button
                type="link"
                icon={<EditOutlined />}
                onClick={() => navigate(`/suggestions/${record._id}`)}
                style={{ fontSize: '14px' }}
              >
                二级审核
              </Button>
            )}
            {isOperationAdmin && currentStatus === 'PENDING_SECOND_REVIEW' && record.type !== 'SAFETY' && (
              <Button
                type="link"
                icon={<EditOutlined />}
                onClick={() => navigate(`/suggestions/${record._id}`)}
                style={{ fontSize: '14px' }}
              >
                二级审核
              </Button>
            )}
            {isManager && currentStatus === 'PENDING_SECOND_REVIEW' && (
              <Button
                type="link"
                icon={<EditOutlined />}
                onClick={() => navigate(`/suggestions/${record._id}`)}
                style={{ fontSize: '14px' }}
              >
                二级审核
              </Button>
            )}
          </Space>
        );
      },
    },
  ];

  const mobileColumns = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      render: (text, record) => (
        <div onClick={() => handleView(record)} style={{ cursor: 'pointer' }}>
          <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' }}>{text}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
            <Tag 
              color={TYPE_COLORS[record.type] || 'default'}
              style={{ padding: '2px 4px', fontSize: '12px' }}
            >
              {SUGGESTION_TYPES[record.type] || record.type}
            </Tag>
            
            {(() => {
              const currentStatus = getCurrentStatus(record);
              const displayColor = STATUS_COLORS[currentStatus] || 'default';
              return (
                <Tag 
                  color={displayColor}
                  style={{ padding: '2px 4px', fontSize: '12px' }}
                >
                  {REVIEW_STATUS[currentStatus] || currentStatus}
                </Tag>
              );
            })()}
            
            {(() => {
              const implStatus = record.implementation?.status || record.implementationStatus || 'NOT_STARTED';
              const statusText = getStatusDisplayText(implStatus, 'implementation');
              const statusColor = getStatusColor(implStatus, 'implementation');
              return (
                <Tag
                  color={statusColor}
                  style={{ padding: '2px 4px', fontSize: '12px' }}
                >
                  {statusText}
                </Tag>
              );
            })()}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#999' }}>
            <span>{record.submitter ? record.submitter.name : '未知'}</span>
            <span>{record.createdAt ? new Date(record.createdAt).toLocaleDateString() : '未知'}</span>
            {typeof record.scoring?.score === 'number' && (
              <span style={{ fontWeight: 'bold' }}>得分: {record.scoring.score.toFixed(1)}</span>
            )}
          </div>
        </div>
      )
    }
  ];

  return (
    <div className="responsive-container" style={{ padding: '24px' }}>
      <Form layout={isMobile ? "vertical" : "inline"} style={{ marginBottom: '20px' }}>
        <Row gutter={isMobile ? 8 : 16} style={{ width: '100%' }}>
          <Col xs={24} sm={12} md={8} lg={6} xl={5}>
            <Form.Item style={{ width: '100%', marginBottom: isMobile ? '12px' : '20px' }} label="搜索">
              <Input.Search
                placeholder="建议标题..."
                allowClear
                onSearch={handleSearch}
                onChange={(e) => {
                  if (!e.target.value) handleSearch('');
                }}
                enterButton
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={8} lg={6} xl={5}>
            <Form.Item style={{ width: '100%', marginBottom: isMobile ? '12px' : '20px' }} label="类型">
              <Select
                value={filterType}
                onChange={handleTypeChange}
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
          <Col xs={24} sm={12} md={8} lg={6} xl={5}>
            <Form.Item style={{ width: '100%', marginBottom: isMobile ? '12px' : '20px' }} label="建议状态">
              <Select
                value={filterReviewStatus}
                onChange={handleReviewStatusChange}
                style={{ width: '100%' }}
                placeholder="所有建议状态"
              >
                <Option value="ALL">所有建议状态</Option>
                {Object.entries(REVIEW_STATUS).map(([key, value]) => (
                  <Option key={key} value={key}>{value}</Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={8} lg={6} xl={5}>
            <Form.Item style={{ width: '100%', marginBottom: isMobile ? '12px' : '20px' }} label="实施状态">
              <Select
                value={filterImplementationStatus}
                onChange={handleImplementationStatusChange}
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

      <Table
        columns={isMobile ? mobileColumns : columns}
        dataSource={suggestions}
        rowKey="_id"
        pagination={{
          current: pagination.current,
          pageSize: pagination.pageSize,
          total: pagination.total,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `共 ${total} 条建议`
        }}
        loading={loading}
        onChange={handleTableChange}
        style={{ fontSize: isMobile ? '13px' : '14px' }}
        className="suggestions-table"
        bordered
        rowClassName={() => 'suggestion-row'}
        scroll={isMobile ? {} : {}}
      />
    </div>
  );
};

export default SuggestionList; 