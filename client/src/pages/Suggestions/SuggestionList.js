import React, { useState, useEffect } from 'react';
import { Table, Tag, Space, Button, Input, Select, message, Modal, Form, Radio } from 'antd';
import { EyeOutlined, EditOutlined, RollbackOutlined, FileAddOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { suggestionService } from '../services/suggestionService';
import { SUGGESTION_TYPES, SUGGESTION_STATUS, STATUS_COLORS, TYPE_COLORS } from '../constants/suggestions';

const { Search } = Input;
const { Option } = Select;
const { TextArea } = Input;

const SuggestionList = () => {
  const navigate = useNavigate();
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: '',
    type: '',
    keyword: ''
  });
  const [currentSuggestion, setCurrentSuggestion] = useState(null);
  const [sortInfo, setSortInfo] = useState({ field: null, order: null });

  // 获取建议列表
  const fetchSuggestions = async () => {
    try {
      setLoading(true);
      const params = {
        page: 1,
        limit: 50
      };
      if (filters.status) params.status = filters.status;
      if (filters.type) params.type = filters.type;
      if (filters.keyword) params.keyword = filters.keyword;
      
      // 添加排序参数
      if (sortInfo.field && sortInfo.order) {
        params.sortBy = sortInfo.field;
        // 转换 Ant Design 的 'ascend'/'descend' 为后端的 'asc'/'desc'
        params.sortOrder = sortInfo.order === 'ascend' ? 'asc' : 'desc';
      }

      const response = await suggestionService.getSuggestions(params);
      
      // 确保设置的是数组类型的数据
      if (response && response.data && Array.isArray(response.data)) {
        setSuggestions(response.data);
      } else if (response && Array.isArray(response)) {
        setSuggestions(response);
      } else {
        // 如果返回的不是数组，设置为空数组并记录错误
        console.error('API返回的建议列表不是数组类型:', response);
        setSuggestions([]);
        message.error('返回的数据格式不正确');
      }
    } catch (error) {
      console.error('获取建议列表失败:', error);
      message.error('获取建议列表失败');
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuggestions();
  }, [filters, sortInfo]);

  // 处理表格变化（排序、过滤）
  const handleTableChange = (pagination, filters, sorter) => {
    console.log('Table change:', { pagination, filters, sorter });
    if (sorter && (sorter.field !== sortInfo.field || sorter.order !== sortInfo.order)) {
      setSortInfo({
        field: sorter.field,
        order: sorter.order
      });
      // 由于添加了 sortInfo 到 fetchSuggestions 的依赖中，useEffect 会自动触发获取
    }
  };

  // 获取状态标签
  const getStatusTag = (status) => {
    const text = SUGGESTION_STATUS[status] || status;
    const color = STATUS_COLORS[status] || 'blue';
    
    return <Tag color={color}>{text}</Tag>;
  };

  const columns = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
      width: 200,
      sorter: true
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 120,
      sorter: true,
      render: (type) => (
        <Tag color={TYPE_COLORS[type] || 'default'}>
          {SUGGESTION_TYPES[type] || type}
        </Tag>
      ),
      filters: [
        { text: '安全管理', value: 'SAFETY' },
        { text: '生产优化', value: 'PRODUCTION' },
        { text: '智能化升级', value: 'AUTOMATION' },
        { text: '其它', value: 'OTHER' }
      ]
    },
    {
      title: '提交人',
      dataIndex: ['submitter', 'name'],
      key: 'submitter',
      width: 120,
      sorter: true
    },
    {
      title: '提交时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      sorter: true,
      render: (text) => new Date(text).toLocaleString()
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      sorter: true,
      render: getStatusTag,
      filters: [
        { text: '等待一级审核', value: 'PENDING_FIRST_REVIEW' },
        { text: '等待二级审核', value: 'PENDING_SECOND_REVIEW' },
        { text: '已驳回', value: 'REJECTED' },
        { text: '未开始', value: 'NOT_STARTED' },
        { text: '已批准待实施', value: 'NOT_IMPLEMENTED' },
        { text: '实施中', value: 'IMPLEMENTING' },
        { text: '实施延期', value: 'DELAYED' },
        { text: '已完成', value: 'COMPLETED' },
        { text: '已取消', value: 'CANCELLED' },
        { text: '已撤回', value: 'WITHDRAWN' }
      ]
    },
    {
      title: '得分',
      dataIndex: ['scoring', 'score'],
      key: 'score',
      width: 80,
      sorter: (a, b) => {
        // 确保正确排序，处理空值情况
        const scoreA = a.scoring?.score;
        const scoreB = b.scoring?.score;
        
        // 当两个值都存在时进行数值比较
        if (scoreA !== undefined && scoreA !== null && 
            scoreB !== undefined && scoreB !== null) {
          return scoreA - scoreB;
        }
        
        // 处理空值情况 (将空值排在最后)
        if (scoreA === undefined || scoreA === null) return 1;
        if (scoreB === undefined || scoreB === null) return -1;
        return 0;
      },
      render: (score) => (
        <span>{typeof score === 'number' ? score.toFixed(1) : '-'}</span>
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_, record) => (
        <Space size="middle">
          <Button
            type="primary"
            icon={<EyeOutlined />}
            size="small"
            onClick={() => navigate(`/suggestions/${record._id}`)}
          >
            查看
          </Button>
          {record.status === 'PENDING_FIRST_REVIEW' && 
           record.submitter._id === localStorage.getItem('userId') && (
            <Button
              icon={<EditOutlined />}
              size="small"
              onClick={() => navigate(`/suggestions/${record._id}/edit`)}
            >
              修改
            </Button>
          )}
          {/* 撤回功能已删除 */}
        </Space>
      )
    }
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 16 }}>
        <Space size="large">
          <Search
            placeholder="搜索建议标题或内容"
            allowClear
            style={{ width: 300 }}
            onSearch={(value) => setFilters(prev => ({ ...prev, keyword: value }))}
          />
          <Select
            placeholder="按类型筛选"
            allowClear
            style={{ width: 150 }}
            onChange={(value) => setFilters(prev => ({ ...prev, type: value }))}
          >
            <Option value="SAFETY">安全管理</Option>
            <Option value="PRODUCTION">生产优化</Option>
            <Option value="AUTOMATION">智能化升级</Option>
            <Option value="OTHER">其它</Option>
          </Select>
          <Select
            placeholder="按状态筛选"
            allowClear
            style={{ width: 150 }}
            onChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
          >
            <Option value="PENDING_FIRST_REVIEW">等待一级审核</Option>
            <Option value="PENDING_SECOND_REVIEW">等待二级审核</Option>
            <Option value="REJECTED">已驳回</Option>
            <Option value="NOT_STARTED">未开始</Option>
            <Option value="NOT_IMPLEMENTED">已批准待实施</Option>
            <Option value="IMPLEMENTING">实施中</Option>
            <Option value="DELAYED">实施延期</Option>
            <Option value="COMPLETED">已完成</Option>
            <Option value="CANCELLED">已取消</Option>
            <Option value="WITHDRAWN">已撤回</Option>
          </Select>
          <Button 
            type="primary" 
            icon={<FileAddOutlined />} 
            onClick={() => navigate('/suggestions/create')}
          >
            提交新建议
          </Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={suggestions}
        rowKey="_id"
        loading={loading}
        pagination={{
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `共 ${total} 条建议`
        }}
        onChange={handleTableChange}
      />

      {/* 撤回模态框已删除 */}
    </div>
  );
};

export default SuggestionList; 