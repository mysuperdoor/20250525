import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Card,
  Typography,
  Space,
  Tag,
  Button,
  Descriptions,
  Timeline,
  Spin,
  Modal,
  Form,
  Input,
  message,
  Divider,
  Alert,
  Popconfirm,
  List,
  Comment,
  Avatar,
  Radio,
  Row,
  Col,
  Badge,
  Select,
  DatePicker,
  Tooltip,
  Upload,
  InputNumber
} from 'antd';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  EditOutlined, 
  RollbackOutlined, 
  CheckCircleOutlined, 
  CloseCircleOutlined,
  CommentOutlined,
  FileTextOutlined,
  HistoryOutlined,
  DownloadOutlined,
  TagOutlined,
  UserOutlined,
  TeamOutlined,
  ClockCircleOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
  StarOutlined,
  EyeOutlined,
  UploadOutlined,
  UndoOutlined
} from '@ant-design/icons';
import { suggestionService } from '../../services/suggestionService';
import { authService } from '../../services/authService';
import { SUGGESTION_TYPES, SUGGESTION_STATUS, STATUS_COLORS, TYPE_COLORS, IMPLEMENTATION_STATUS } from '../../constants/suggestions';
import { getStatusDisplayText, getStatusColor } from '../../utils/statusUtils';
import { getCurrentStatus } from '../../utils/suggestionUtils';
import moment from 'moment';
import FilePreview from '../../components/FilePreview';

// Import the new components
import {
  MetadataSection,
  ContentSection,
  AttachmentSection,
  StatusSection,
  ReviewSection,
  ScoringSection
} from '../../components/SuggestionDetail';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { confirm } = Modal;
const { Option } = Select;

// 添加一个辅助函数，尝试修复乱码的文件名
const fixEncodingIssues = (text) => {
  try {
    // 尝试检测乱码的中文文件名
    // 乱码字符通常有一些特征，如è®³å¤ç®¡ç这样的组合
    if (/[èéêëàáâãäåæçìíîïòóôõøùúûü]/.test(text)) {
      // 尝试将错误编码的字符重新编码为UTF-8
      // 先转换为ISO-8859-1，再转换为UTF-8
      return decodeURIComponent(escape(text));
    }
    
    // 如果没有检测到乱码特征，则直接返回原始文本
    return text;
  } catch (error) {
    console.error('修复文件名编码错误:', error);
    return text; // 如果修复失败，返回原始文本
  }
};

const SuggestionDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [suggestion, setSuggestion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [firstReviewModalVisible, setFirstReviewModalVisible] = useState(false);
  const [secondReviewModalVisible, setSecondReviewModalVisible] = useState(false);
  const [scoreModalVisible, setScoreModalVisible] = useState(false);
  const [resetScoreModalVisible, setResetScoreModalVisible] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [filePreviewUrl, setFilePreviewUrl] = useState('');
  const [fileType, setFileType] = useState('');
  const [isRejectModalVisible, setIsRejectModalVisible] = useState(false);
  const [fileList, setFileList] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [commentForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [firstReviewForm] = Form.useForm();
  const [secondReviewForm] = Form.useForm();
  const [scoreForm] = Form.useForm();
  
  // Main styles for cards and layout
  const cardStyles = {
    mainCard: {
      borderRadius: '8px', 
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
      overflow: 'hidden'
    },
    contentCard: {
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
      height: '100%'
    },
    cardBody: {
      padding: isMobile ? '16px' : '24px'
    }
  };
  
  // 添加媒体查询检测，优化性能
  useEffect(() => {
    const handleResizeInternal = () => {
      const newIsMobile = window.innerWidth <= 768;
      if (newIsMobile !== isMobile) {
        setIsMobile(newIsMobile);
      }
    };
    
    let resizeTimer;
    const debouncedResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(handleResizeInternal, 100);
    };
    
    window.addEventListener('resize', debouncedResize);
    return () => {
      window.removeEventListener('resize', debouncedResize);
      clearTimeout(resizeTimer);
    };
  }, [isMobile]);
  
  // 判断是否是值班主任
  const isSupervisor = useMemo(() => currentUser?.role === '值班主任', [currentUser]);
  
  // 判断是否是管理人员
  const isAdmin = useMemo(() => currentUser?.role === '安全科管理人员' || 
                 currentUser?.role === '运行科管理人员' || 
                 currentUser?.role === '部门经理', [currentUser]);
                 
  const isDepartmentManager = useMemo(() => currentUser?.role === '部门经理', [currentUser]);
  const isSafetyAdmin = useMemo(() => currentUser?.role === '安全科管理人员', [currentUser]);
  const isOperationAdmin = useMemo(() => currentUser?.role === '运行科管理人员', [currentUser]);
  
  // 添加 isTeamMatch 的定义
  const isTeamMatch = useMemo(() => currentUser?.team === suggestion?.team || 
                     currentUser?.team === suggestion?.submitter?.team, [currentUser, suggestion]);
  
  // 修改检查状态的逻辑，使用getCurrentStatus函数
  const currentStatus = useMemo(() => suggestion ? getCurrentStatus(suggestion) : '', [suggestion]);
  const isPendingFirstReview = useMemo(() => currentStatus === 'PENDING_FIRST_REVIEW', [currentStatus]);
  const isPendingSecondReview = useMemo(() => currentStatus === 'PENDING_SECOND_REVIEW', [currentStatus]);
  const isRejected = useMemo(() => currentStatus === 'REJECTED', [currentStatus]);
  
  // 判断是否可以进行一级审核 - 是值班主任且班组匹配，或部门经理
  const canFirstReview = useMemo(() => ((isSupervisor && isTeamMatch) || isDepartmentManager) && 
                        isPendingFirstReview, [isSupervisor, isTeamMatch, isDepartmentManager, isPendingFirstReview]);

  // 判断是否可以进行二级审核
  const isSafetyType = useMemo(() => suggestion?.type === 'SAFETY' || suggestion?.type === '安全管理', [suggestion]);
  
  const canSecondReview = useMemo(() => (
    (isSafetyAdmin && isSafetyType) || 
    (isOperationAdmin && !isSafetyType) || 
    isDepartmentManager
  ) && isPendingSecondReview, [isSafetyAdmin, isSafetyType, isOperationAdmin, isDepartmentManager, isPendingSecondReview]);

  // 更新评分权限逻辑：部门经理可评所有建议，安全科只评安全类，运行科只评非安全类
  const canScore = useMemo(() => isDepartmentManager || 
                  (currentUser?.role === '安全科管理人员' && isSafetyType) || 
                  (currentUser?.role === '运行科管理人员' && !isSafetyType), [currentUser, isDepartmentManager, isSafetyType]);

  // 新增：判断评分按钮是否应该显示 - 修正对中文状态的兼容
  const shouldShowScoreButton = useMemo(() => canScore && currentStatus === 'APPROVED', [canScore, currentStatus]);

  // 新增：判断管理人员是否有修改建议的权限
  const canManagerEdit = useMemo(() => {
    // 部门经理可以修改所有建议
    if (isDepartmentManager) return true;
    // 安全科管理人员只能修改安全类建议
    if (isSafetyAdmin && isSafetyType) return true;
    // 运行科管理人员只能修改非安全类建议
    if (isOperationAdmin && !isSafetyType) return true;
    // 值班主任只能修改本班组的建议
    if (isSupervisor && isTeamMatch) return true;
    return false;
  }, [isDepartmentManager, isSafetyAdmin, isSafetyType, isOperationAdmin, isSupervisor, isTeamMatch]);

  // 获取建议详情
  const fetchSuggestionDetail = useCallback(async () => {
    setLoading(true);
    try {
      const response = await suggestionService.getSuggestionById(id);
      console.log('获取到的建议详情:', response);
      
      // 检查评分数据格式，确保正确显示
      if (response.scoring) {
        console.log('建议评分数据:', response.scoring);
      }
      
      // 修正：确保正确处理响应数据结构
      const suggestionData = response.data || response;
      setSuggestion(suggestionData);
      
      // 如果有附件，设置文件列表
      if (suggestionData.attachments && suggestionData.attachments.length > 0) {
        const files = suggestionData.attachments.map((attachment, index) => ({
          uid: `-${index + 1}`,
          name: attachment.originalname,
          status: 'done',
          url: `/api/suggestions/files/${attachment.filename}`,
          originalFile: attachment
        }));
        setFileList(files);
      }
    } catch (error) {
      console.error('获取建议详情失败:', error);
      message.error('获取建议详情失败，请重试');
    } finally {
      setLoading(false);
    }
  }, [id]);

  // 获取当前用户信息
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const user = await authService.getCurrentUser();
        if (!user) {
          message.error('请先登录后再访问此页面');
          navigate('/login');
          return;
        }
        setCurrentUser(user);
      } catch (error) {
        message.error('获取用户信息失败');
        navigate('/login');
      }
    };
    
    fetchCurrentUser();
  }, [navigate]);

  useEffect(() => {
    fetchSuggestionDetail();
  }, [fetchSuggestionDetail]);

  // 添加评论
  const handleAddComment = useCallback(async (values) => {
    try {
      setSubmitting(true);
      await suggestionService.addComment(id, values.content);
      message.success('评论添加成功');
      commentForm.resetFields();
      setCommentModalVisible(false);
      fetchSuggestionDetail();
    } catch (error) {
      message.error('添加评论失败');
    } finally {
      setSubmitting(false);
    }
  }, []);

  // 添加文件上传处理函数
  const handleFileChange = ({ fileList: newFileList }) => {
    let finalFileList = newFileList.filter(f => {
      if (f.status === 'error' && f.response === 'Unsupported file type or size') {
        return false;
      }
      return true;
    });
    
    setFileList(finalFileList);
  };

  // 文件上传前验证（与New.js中的功能相同）
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

  // 修改handleEdit函数，添加文件上传处理
  const handleEdit = async (values) => {
    try {
      setSubmitting(true);
      
      // 创建FormData对象用于文件上传
      const formData = new FormData();
      formData.append('title', values.title);
      formData.append('type', values.type);
      formData.append('content', values.content);
      formData.append('expectedBenefit', values.expectedBenefit);
      formData.append('reason', values.reason);
      
      // 处理文件上传
      if (fileList && fileList.length > 0) {
        // 将每个文件添加到FormData中
        fileList.forEach(file => {
          // 检查是否是File对象（如果是antd上传组件的fileList，需要使用originFileObj）
          if (file.originFileObj) {
            formData.append('files', file.originFileObj);
          } else if (file instanceof File) {
            formData.append('files', file);
          }
        });
      }
      
      await suggestionService.updateSuggestion(id, formData);
      message.success('建议修改成功');
      setFileList([]); // 清空文件列表
      editForm.resetFields();
      setEditModalVisible(false);
      fetchSuggestionDetail();
    } catch (error) {
      console.error('修改建议失败:', error);
      // 显示更详细的错误信息
      if (error.userMessage) {
        message.error(error.userMessage);
      } else if (error.response && error.response.data) {
        // 如果有响应数据，优先显示userMessage
        const errorData = error.response.data;
        message.error(errorData.userMessage || errorData.message || '修改建议失败');
      } else {
        message.error('修改建议失败');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // 修改showEditModal函数，重置文件列表
  const showEditModal = () => {
    setFileList([]); // 重置文件列表
    editForm.setFieldsValue({
      title: suggestion.title,
      content: suggestion.content,
      expectedBenefit: suggestion.expectedBenefit,
      type: suggestion.type
    });
    setEditModalVisible(true);
  };

  // 下载附件
  const handleDownloadAttachment = useCallback(async (attachment) => {
    const baseUrl = window.location.protocol + '//' + window.location.hostname + (window.location.port ? ':' + window.location.port : '');
    const token = localStorage.getItem('token');
    
    // 添加时间戳参数来避免缓存
    const timestamp = new Date().getTime();
    const url = `${baseUrl}/download/${attachment.filename}?originalname=${encodeURIComponent(attachment.originalname)}&t=${timestamp}`;
    
    try {
      // 创建一个隐藏的a标签，模拟点击下载
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      // 不使用download属性，让浏览器根据Content-Disposition头处理
      
      // 如果有token，添加到URL或使用fetch API
      if (token) {
        // 使用fetch API进行下载，可以添加认证头
        fetch(url, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
        .then(response => {
          if (!response.ok) {
            throw new Error(`下载失败: ${response.status} ${response.statusText}`);
          }
          return response.blob();
        })
        .then(blob => {
          // 使用URL.createObjectURL创建临时URL
          const blobUrl = window.URL.createObjectURL(blob);
          a.href = blobUrl;
          a.download = attachment.originalname;
          document.body.appendChild(a);
          a.click();
          // 清理
          setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(blobUrl);
          }, 100);
        })
        .catch(error => {
          console.error('下载附件失败:', error);
          message.error('下载附件失败，请稍后重试');
        });
      } else {
        // 如果没有token，直接使用链接下载（不推荐，因为已添加了认证）
        a.href = url;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
      
      // 记录下载操作
      console.log('下载附件:', {
        文件名: attachment.originalname,
        编码后: encodeURIComponent(attachment.originalname),
        URL: url
      });
    } catch (error) {
      // console.error('下载附件失败:', error);
      message.error('下载附件失败，请稍后重试');
    }
  }, []);

  // 一级审核
  const handleFirstReview = async (values) => {
    try {
      setSubmitting(true);
      console.log('提交一级审核:', {
        建议ID: id,
        审核人: currentUser?.name,
        审核人角色: currentUser?.role,
        审核人班组: currentUser?.team,
        审核结果: values.result === 'approve' ? '通过' : '拒绝',
        审核意见: values.comment
      });
      
      const reviewData = {
        suggestionId: id,
        reviewType: 'first',
        result: values.result === 'approve' ? 'APPROVED' : 'REJECTED',
        comment: values.comment,
        reviewerId: currentUser?._id
      };
      
      await suggestionService.submitReview(reviewData);
      message.success('一级审核完成');
      firstReviewForm.resetFields();
      setFirstReviewModalVisible(false);
      fetchSuggestionDetail();
      
      // 如果从审核列表页面进入，则返回审核列表
      if (window.history.length > 1) {
        setTimeout(() => {
          navigate('/suggestions/review');
        }, 1500);
      }
    } catch (error) {
      console.error('一级审核失败:', error);
      message.error('一级审核失败: ' + (error.response?.data?.message || error.message));
    } finally {
      setSubmitting(false);
    }
  };

  // 二级审核
  const handleSecondReview = async (values) => {
    try {
      setSubmitting(true);
      console.log('提交二级审核, 参数:', {
        id,
        result: values.result,
        comment: values.comment
      });
      
      const reviewData = {
        suggestionId: id,
        reviewType: 'second',
        result: values.result === 'approve' ? 'APPROVED' : 'REJECTED',
        comment: values.comment,
        reviewerId: currentUser?._id
      };
      
      await suggestionService.submitReview(reviewData);
      message.success('二级审核完成');
      secondReviewForm.resetFields();
      setSecondReviewModalVisible(false);
      fetchSuggestionDetail();
      
      // 如果从审核列表页面进入，则返回审核列表
      if (window.history.length > 1) {
        setTimeout(() => {
          navigate('/suggestions/review');
        }, 1500);
      }
    } catch (error) {
      console.error('二级审核失败:', error);
      message.error('二级审核失败: ' + (error.response?.data?.message || error.message));
    } finally {
      setSubmitting(false);
    }
  };

  // 删除建议处理函数
  const handleDelete = useCallback(() => {
    confirm({
      title: '确认删除这条建议吗？',
      icon: <ExclamationCircleOutlined />,
      content: '',
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      confirmLoading: isDeleting,
      async onOk() {
        setIsDeleting(true);
        try {
          // 调用 service 中的 deleteSuggestion
          const result = await suggestionService.deleteSuggestion(id);
          console.log('handleDelete 收到 Service Result:', result);
          if (result.success) {
            message.success('建议已成功删除');
            // Navigate after success message is shown
            setTimeout(() => {
              navigate('/suggestions/list');
            }, 1000);
          } else {
            message.error(result.message || '删除建议失败');
          }
        } catch (error) {
          message.error('删除建议时发生错误');
        } finally {
          setIsDeleting(false);
        }
      },
      onCancel() {
        // console.log('取消删除'); // console.log removed
      },
    });
  }, [id, navigate, isDeleting]);

  // Add score submit handler
  const handleScoreSubmit = async () => {
    const values = await scoreForm.validateFields();
    const scoreValue = parseFloat(values.score);
    if (isNaN(scoreValue) || scoreValue < 0.5 || scoreValue > 5) {
      message.error('请输入 0.5 到 5 之间的有效分数');
      return;
    }
    await suggestionService.scoreSuggestion(id, scoreValue);
    message.success('评分成功');
    setScoreModalVisible(false);
    fetchSuggestionDetail();
  };

  // 处理文件预览
  const handlePreviewFile = (file) => {
    setPreviewFile(file);
    setPreviewVisible(true);
  };

  // 处理重置评分
  const handleResetScore = async () => {
    try {
      const result = await suggestionService.resetSuggestionScore(id);
      console.log('重置评分结果:', result);
      
      message.success('评分已成功重置');
      setResetScoreModalVisible(false);
      
      // 重新获取建议详情
      await fetchSuggestionDetail();
    } catch (error) {
      console.error('重置评分失败:', error);
      message.error('重置评分失败: ' + (error.response?.data?.message || error.message));
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin tip="加载建议详情..." />
      </div>
    );
  }

  if (!suggestion) {
    return (
      <Card>
        <Alert
          message="建议不存在或已被删除"
          description="您查找的建议可能不存在或已被删除，请返回列表查看其他建议。"
          type="error"
          showIcon
        />
        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <Button type="primary" onClick={() => navigate('/suggestions/list')}>
            返回列表
          </Button>
        </div>
      </Card>
    );
  }

  // 渲染操作按钮
  const renderActionButtons = () => {
    const actions = [];

    // 提交评论按钮
    actions.push(
      <Button key="comment" icon={<CommentOutlined />} onClick={() => setCommentModalVisible(true)}>
        添加评论
      </Button>
    );

    // 判断是否可以删除建议
    const canDelete = isDepartmentManager || 
      (currentUser && 
       suggestion && 
       suggestion.submitter && 
       currentUser._id === suggestion.submitter._id && 
       (!suggestion.secondReview || suggestion.secondReview.result !== 'APPROVED'));

    // 编辑按钮 - 修改条件，允许管理人员编辑
    if ((currentUser && suggestion && suggestion.submitter && 
        currentUser._id === suggestion.submitter._id && 
        (isPendingFirstReview || isRejected)) || canManagerEdit) {
      actions.push(
        <Button key="edit" icon={<EditOutlined />} onClick={showEditModal} style={{ marginLeft: 8 }}>
          编辑建议
        </Button>
      );
    }

    // 一级审核按钮
    if (canFirstReview) {
      actions.push(
        <Button key="firstReview" type="primary" icon={<CheckCircleOutlined />} onClick={() => setFirstReviewModalVisible(true)} style={{ marginLeft: 8 }}>
          一级审核
        </Button>
      );
    }

    // 二级审核按钮
    if (canSecondReview) {
      actions.push(
        <Button key="secondReview" type="primary" icon={<CheckCircleOutlined />} onClick={() => setSecondReviewModalVisible(true)} style={{ marginLeft: 8 }}>
          二级审核
        </Button>
      );
    }
    
    // 评分按钮 - 使用新的 shouldShowScoreButton 条件
    if (shouldShowScoreButton) {
      actions.push(
        <Button key="score" icon={<StarOutlined />} onClick={() => setScoreModalVisible(true)} style={{ marginLeft: 8 }}>
          评分
        </Button>
      );
    }

    // 重置评分按钮 - 仅部门经理且建议已有评分时显示
    if (isDepartmentManager && suggestion?.scoring?.score !== undefined) {
      actions.push(
        <Button 
          key="resetScore" 
          icon={<UndoOutlined />} 
          onClick={() => setResetScoreModalVisible(true)} 
          style={{ marginLeft: 8 }}
          danger
        >
          重置评分
        </Button>
      );
    }

    // 删除按钮 (部门经理或未通过二级审核的建议提交者可删除)
    if (canDelete) {
      actions.push(
        <Popconfirm
          key="delete"
          title="确定要删除此建议吗？"
          description="删除后将无法恢复，请谨慎操作！"
          icon={<ExclamationCircleOutlined style={{ color: 'red' }} />}
          onConfirm={handleDelete}
          okText="确定删除"
          cancelText="取消"
        >
          <Button danger icon={<DeleteOutlined />} style={{ marginLeft: 8 }} loading={isDeleting}>
            删除建议
          </Button>
        </Popconfirm>
      );
    }
    
    return actions.length > 0 ? actions : null;
  };

  return (
    <div className="responsive-container">
      <Card 
        title={
          isMobile ? (
            <>
              <div style={{ width: '100%' }}>
                <Title level={4} style={{ margin: 0, wordBreak: 'break-word', whiteSpace: 'normal' }}>
                  {suggestion.title}
                </Title>
              </div>
              <div style={{
                marginTop: '8px',
                width: '100%',
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'flex-start',
                gap: '8px'
              }}>
                {renderActionButtons()}
              </div>
            </>
          ) : (
            <Row justify="space-between" align="middle">
              <Col flex="auto">
                <Title level={4} style={{ margin: 0, wordBreak: 'break-word', whiteSpace: 'normal' }}>
                  {suggestion.title}
                </Title>
              </Col>
              <div style={{
                marginLeft: 'auto',
                // width: 'auto', // default for block/flex item not taking full width
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'flex-end',
                gap: '8px'
              }}>
                {renderActionButtons()}
              </div>
            </Row>
          )
        }
        style={cardStyles.mainCard}
        bodyStyle={cardStyles.cardBody}
      >
        <Row gutter={[isMobile ? 12 : 24, isMobile ? 16 : 24]} style={{ marginBottom: '20px' }}>
          <Col xs={24} sm={24} md={16}>
            <Card
              title={<><FileTextOutlined style={{ marginRight: '8px' }} />建议详情</>}
              style={cardStyles.contentCard}
              bodyStyle={cardStyles.cardBody}
            >
              <MetadataSection suggestion={suggestion} isMobile={isMobile} />
              
              <ContentSection 
                title="建议内容" 
                content={suggestion.content} 
                isMobile={isMobile} 
              />
              
              <ContentSection 
                title="预期效益" 
                content={suggestion.expectedBenefit}
                isMobile={isMobile} 
              />
              
              {suggestion.attachments && suggestion.attachments.length > 0 && (
                <AttachmentSection 
                  attachments={suggestion.attachments}
                  handleDownloadAttachment={handleDownloadAttachment}
                  handlePreviewFile={handlePreviewFile}
                  isMobile={isMobile}
                  fixEncodingIssues={fixEncodingIssues}
                />
              )}
            </Card>
          </Col>

          <Col xs={24} sm={24} md={8}>
            <Card
              title="跟进信息"
              style={cardStyles.contentCard}
              bodyStyle={{ padding: isMobile ? '12px' : '16px' }}
            >
              <Space direction="vertical" style={{ width: '100%' }} size={isMobile ? 12 : 16}>
                <StatusSection 
                  currentStatus={currentStatus} 
                  implementation={suggestion.implementation}
                  scoring={suggestion.scoring}
                  isMobile={isMobile}
                />
                
                {suggestion.firstReview && (
                  <ReviewSection 
                    review={suggestion.firstReview} 
                    type="first"
                    isMobile={isMobile}
                  />
                )}
                
                {suggestion.secondReview && (
                  <ReviewSection 
                    review={suggestion.secondReview} 
                    type="second"
                    isMobile={isMobile}
                  />
                )}
                
                {suggestion.scoring && (
                  <ScoringSection 
                    scoring={suggestion.scoring}
                    isMobile={isMobile}
                  />
                )}

                {suggestion.comments && suggestion.comments.length > 0 && (
                  <Card 
                    title={<><CommentOutlined /> 修改记录</>} 
                    type="inner" 
                  >
                    <Timeline>
                      {suggestion.comments.map((comment, index) => (
                        <Timeline.Item key={index} color="#1890ff">
                          <div style={{ 
                                padding: '12px 16px', 
                                background: '#f9f9f9', 
                                borderRadius: '6px',
                                marginBottom: '8px'
                              }}>
                                <p>{comment.content}</p>
                                <div style={{ textAlign: 'right', color: '#888', fontSize: '12px' }}>
                                  {comment.createdAt ? new Date(comment.createdAt).toLocaleString() : ''}
                                </div>
                              </div>
                        </Timeline.Item>
                      ))}
                    </Timeline>
                  </Card>
                )}

                {suggestion.revisionHistory && suggestion.revisionHistory.length > 0 && (
                  <Card 
                    title={<><HistoryOutlined /> 修改历史</>} 
                    type="inner" 
                  >
                    <Timeline>
                      {suggestion.revisionHistory.map((revision, index) => (
                        <Timeline.Item key={index} dot={<HistoryOutlined style={{ fontSize: '16px' }} />}>
                          <div style={{ marginBottom: '8px' }}>
                            <Text strong>{revision.modifiedBy?.name || '未知用户'}</Text> 于{' '}
                            {revision.modifiedAt ? new Date(revision.modifiedAt).toLocaleString() : '未知时间'} 
                            修改了内容
                          </div>
                          <div style={{ 
                            padding: '8px 12px', 
                            background: '#f9f9f9', 
                            borderRadius: '4px' 
                          }}>
                            修改原因: {revision.reason}
                          </div>
                        </Timeline.Item>
                      ))}
                    </Timeline>
                  </Card>
                )}

                {suggestion.implementationRecords && suggestion.implementationRecords.length > 0 && (
                  <Card 
                    title={<>实施记录</>} 
                    type="inner" 
                  >
                    <Timeline>
                      {suggestion.implementationRecords.map((record, index) => (
                        <Timeline.Item 
                          key={index} 
                          color={record.status === '已完成' ? 'green' : (record.status === '已拒绝' ? 'red' : 'blue')}
                        >
                          <div style={{ marginBottom: '8px' }}>
                            <Text strong>{record.updatedBy?.name || '未知用户'}</Text> 于{' '}
                            {record.updatedAt ? new Date(record.updatedAt).toLocaleString() : '未知时间'} 
                            将状态更新为 <Tag 
                              color={STATUS_COLORS[record.status] || 'default'}
                              style={{ padding: '2px 8px', borderRadius: '4px' }}
                            >
                              {SUGGESTION_STATUS[record.status] || record.status}
                            </Tag>
                          </div>
                          <div style={{ 
                            padding: '8px 12px', 
                            background: '#f9f9f9', 
                            borderRadius: '4px' 
                          }}>
                            说明: {record.comments}
                          </div>
                        </Timeline.Item>
                      ))}
                    </Timeline>
                  </Card>
                )}
              </Space>
            </Card>
          </Col>
        </Row>
      </Card>

      {/* 添加评论模态框 */}
      <Modal
        title={<><CommentOutlined /> 添加评论</>}
        open={commentModalVisible}
        onCancel={() => setCommentModalVisible(false)}
        footer={null}
        width={isMobile ? '95%' : 520}
        style={{ borderRadius: '8px' }}
        bodyStyle={{ padding: isMobile ? '16px' : '24px' }}
      >
        <Form
          form={commentForm}
          onFinish={handleAddComment}
          layout="vertical"
        >
          <Form.Item
            name="content"
            rules={[{ required: true, message: '请输入评论内容' }]}
          >
            <TextArea 
              rows={4} 
              placeholder="请输入您的评论..." 
              style={{ borderRadius: '4px' }}
            />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Button 
              onClick={() => setCommentModalVisible(false)}
              style={{ marginRight: '8px', borderRadius: '4px' }}
            >
              取消
            </Button>
            <Button 
              type="primary" 
              htmlType="submit" 
              loading={submitting}
              style={{ borderRadius: '4px' }}
            >
              提交评论
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* 修改建议模态框 */}
      <Modal
        title={<><EditOutlined /> 修改建议</>}
        open={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        footer={null}
        width={700}
        style={{ borderRadius: '8px' }}
        bodyStyle={{ padding: '24px' }}
      >
        <Form
          form={editForm}
          onFinish={handleEdit}
          layout="vertical"
        >
          <Form.Item
            name="title"
            label="标题"
            rules={[{ required: true, message: '请输入标题' }]}
          >
            <Input style={{ borderRadius: '4px' }} />
          </Form.Item>
          <Form.Item
            name="type"
            label="建议类型"
            rules={[{ required: true, message: '请选择建议类型' }]}
          >
            <Select placeholder="请选择建议类型" style={{ borderRadius: '4px' }}>
              {Object.entries(SUGGESTION_TYPES).map(([key, value]) => (
                <Option key={key} value={key}>{value}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="content"
            label="内容"
            rules={[{ required: true, message: '请输入内容' }]}
          >
            <TextArea 
              rows={6} 
              style={{ borderRadius: '4px' }} 
            />
          </Form.Item>
          <Form.Item
            name="expectedBenefit"
            label="预期效益"
            rules={[{ required: true, message: '请输入预期效益' }]}
          >
            <TextArea 
              rows={4} 
              style={{ borderRadius: '4px' }} 
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
              multiple
              listType="text"
              maxCount={5}
            >
              <Button icon={<UploadOutlined />}>选择文件</Button>
            </Upload>
          </Form.Item>
          <Form.Item
            name="reason"
            label="修改原因"
          >
            <TextArea 
              rows={2} 
              style={{ borderRadius: '4px' }} 
            />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Button 
              onClick={() => setEditModalVisible(false)}
              style={{ marginRight: '8px', borderRadius: '4px' }}
            >
              取消
            </Button>
            <Button 
              type="primary" 
              htmlType="submit" 
              loading={submitting}
              style={{ borderRadius: '4px' }}
            >
              提交修改
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* 一级审核模态框 */}
      <Modal
        title={<><CheckCircleOutlined /> 一级审核</>}
        open={firstReviewModalVisible}
        onCancel={() => setFirstReviewModalVisible(false)}
        footer={null}
        width={600}
        style={{ borderRadius: '8px' }}
        bodyStyle={{ padding: '24px' }}
      >
        <Alert
          message="一级审核提示"
          description="请仔细审核建议内容，确认是否通过一级审核。通过后将进入二级审核流程。"
          type="info"
          showIcon
          style={{ marginBottom: '16px', borderRadius: '4px' }}
        />
        <Form
          form={firstReviewForm}
          onFinish={handleFirstReview}
          layout="vertical"
          initialValues={{ result: 'approve' }}
        >
          <Form.Item
            name="result"
            label="审核结果"
            rules={[{ required: true, message: '请选择审核结果' }]}
          >
            <Radio.Group>
              <Radio.Button value="approve" style={{ borderRadius: '4px 0 0 4px' }}>通过</Radio.Button>
              <Radio.Button value="reject" style={{ borderRadius: '0 4px 4px 0' }}>拒绝</Radio.Button>
            </Radio.Group>
          </Form.Item>
          <Form.Item
            name="comment"
            label="审核意见"
            rules={[{ required: true, message: '请输入审核意见' }]}
          >
            <TextArea 
              rows={4} 
              placeholder="请输入审核意见..." 
              style={{ borderRadius: '4px' }}
            />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Button 
              onClick={() => setFirstReviewModalVisible(false)}
              style={{ marginRight: '8px', borderRadius: '4px' }}
            >
              取消
            </Button>
            <Button 
              type="primary" 
              htmlType="submit" 
              loading={submitting}
              style={{ borderRadius: '4px' }}
            >
              提交审核
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* 二级审核模态框 */}
      <Modal
        title={<><CheckCircleOutlined /> 二级审核</>}
        open={secondReviewModalVisible}
        onCancel={() => setSecondReviewModalVisible(false)}
        footer={null}
        width={600}
        style={{ borderRadius: '8px' }}
        bodyStyle={{ padding: '24px' }}
      >
        <Alert
          message="二级审核提示"
          description="请仔细审核建议内容，确认是否最终通过。通过后建议将进入实施流程，否则将结束处理。"
          type="warning"
          showIcon
          style={{ marginBottom: '16px', borderRadius: '4px' }}
        />
        <Form
          form={secondReviewForm}
          onFinish={handleSecondReview}
          layout="vertical"
          initialValues={{ result: 'approve' }}
        >
          <Form.Item
            name="result"
            label="审核结果"
            rules={[{ required: true, message: '请选择审核结果' }]}
          >
            <Radio.Group>
              <Radio.Button value="approve" style={{ borderRadius: '4px 0 0 4px' }}>通过</Radio.Button>
              <Radio.Button value="reject" style={{ borderRadius: '0 4px 4px 0' }}>拒绝</Radio.Button>
            </Radio.Group>
          </Form.Item>
          <Form.Item
            name="comment"
            label="审核意见"
            rules={[{ required: true, message: '请输入审核意见' }]}
          >
            <TextArea 
              rows={4} 
              placeholder="请输入审核意见..." 
              style={{ borderRadius: '4px' }}
            />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Button 
              onClick={() => setSecondReviewModalVisible(false)}
              style={{ marginRight: '8px', borderRadius: '4px' }}
            >
              取消
            </Button>
            <Button 
              type="primary" 
              htmlType="submit" 
              loading={submitting}
              style={{ borderRadius: '4px' }}
            >
              提交审核
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* Score Modal */} 
      <Modal
        title={suggestion?.scoring?.score !== undefined ? '修改建议评分' : '为建议评分'}
        open={scoreModalVisible}
        onCancel={() => setScoreModalVisible(false)}
        onOk={handleScoreSubmit}
        okText="提交评分"
        cancelText="取消"
      >
        <Alert
          message="评分提示"
          description="请根据以下标准评分：创新性、实用性、效益性、完整性、可行性。最小评分单位0.5分。"
          type="info"
          showIcon
          style={{ marginBottom: '16px', borderRadius: '4px' }}
        />
        <Form form={scoreForm} layout="vertical" name="score_form">
          <Form.Item
            name="score"
            label="分数 (0.5-5)"
            rules={[
              { required: true, message: '请输入分数' },
              {
                validator: (_, value) => {
                  const scoreNum = parseFloat(value);
                  if (isNaN(scoreNum) || scoreNum < 0.5 || scoreNum > 5) {
                    return Promise.reject(new Error('分数必须在 0.5 到 5 之间'));
                  }
                  // 校验是否为0.5的倍数
                  if ((scoreNum * 10) % 5 !== 0) {
                    return Promise.reject(new Error('分数必须是0.5的倍数'));
                  }
                  return Promise.resolve();
                },
              },
            ]}
          >
            <Input type="number" min={0.5} max={5} step={0.5} placeholder="请输入 0.5-5 之间的分数 (例如: 3.5)" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 重置评分模态框 */}
      <Modal
        title="重置建议评分"
        open={resetScoreModalVisible}
        onCancel={() => setResetScoreModalVisible(false)}
        onOk={handleResetScore}
        okText="确认重置"
        cancelText="取消"
        okButtonProps={{ danger: true }}
      >
        <Alert
          message="警告"
          description="重置评分将完全清除当前评分记录，使建议恢复到未评分状态。此操作不可撤销，确定要继续吗？"
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
      </Modal>

      {/* 添加文件预览组件 */}
      <FilePreview
        visible={previewVisible}
        onClose={() => setPreviewVisible(false)}
        filename={previewFile?.filename}
      />
    </div>
  );
};

export default SuggestionDetail; 