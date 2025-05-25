const { Suggestion, SUGGESTION_STATUS } = require('../models/Suggestion');
const { User } = require('../models/User');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { validationResult } = require('express-validator');
const { validateSuggestion } = require('../utils/validation');
const { Review, REVIEW_LEVELS, REVIEW_RESULTS } = require('../models/Review');
const { notifyReviewers } = require('../utils/notificationUtils');
// 导入前端定义的常量
const { IMPLEMENTATION_STATUS } = require('../../client/src/constants/suggestions');
const Logger = require('../utils/logger');

const logger = new Logger('SuggestionController');

// 审核状态常量
const REVIEW_STATUS = {
  PENDING_FIRST_REVIEW: '等待一级审核',
  PENDING_SECOND_REVIEW: '等待二级审核',
  APPROVED: '已批准',
  REJECTED: '已驳回',
  WITHDRAWN: '已撤回'
};

exports.getSuggestions = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const { 
      reviewStatus, 
      implementationStatus, 
      responsiblePersonId, 
      submitterId, 
      type, 
      team, 
      title,
      sortBy,
      sortOrder
    } = req.query;

    logger.debug('查询参数:', { page, limit, skip, reviewStatus, implementationStatus, responsiblePersonId, submitterId, type, team, title, sortBy, sortOrder });
    logger.debug('当前用户:', req.user);

    let query = {};
    
    if (title) {
      query.title = { $regex: title, $options: 'i' };
      logger.debug('应用 title 文本搜索:', query.title);
    }

    // -- 1. 应用前端传入的显式过滤条件 --
    if (reviewStatus) {
      // 支持单个状态或逗号分隔的多个状态
      const statuses = reviewStatus.split(',').map(s => s.trim());
      query.reviewStatus = { $in: statuses };
      logger.debug('应用 reviewStatus 过滤:', query.reviewStatus);
    }
    if (type) {
      const types = type.split(',').map(t => t.trim());
      query.type = { $in: types };
      logger.debug('应用 type 过滤:', query.type);
    }
    if (team) {
      const teams = team.split(',').map(t => t.trim());
      query.team = { $in: teams };
      logger.debug('应用 team 过滤:', query.team);
    }
    
    // -- 2. 应用基于用户角色的权限过滤 (如果前端没有指定更具体的 submitterId 或 responsiblePersonId) --
    // 注意：responsiblePersonId 的过滤需要在获取实施信息后进行，或使用聚合管道
    
    let filterByUserPermission = true; // 默认应用权限过滤
    let implementationQuery = {}; // 用于后续查询 Implementation
    
    if (responsiblePersonId && responsiblePersonId === req.user.id) {
        // 如果查询的是 "我负责的"，那么建议本身不需要加 submitter 限制
        // 但需要后续过滤实施信息
        implementationQuery.responsiblePerson = req.user.id; 
        filterByUserPermission = false; // 不再应用下面的通用角色过滤
        logger.debug('按 responsiblePersonId 过滤实施信息:', implementationQuery);
    } else if (submitterId && submitterId === req.user.id) {
        // 如果查询的是 "我提交的"，直接添加到主查询
        query.submitter = req.user.id;
        filterByUserPermission = false; // 不再应用下面的通用角色过滤
        logger.debug('按 submitterId 过滤:', query.submitter);
    }
    
    if (filterByUserPermission) {
        logger.debug('应用基于角色的权限过滤...');
        if (req.user.role === '班组人员') {
          // 班组成员默认只能看到自己的建议
          query.submitter = req.user.id;
        } else if (req.user.role === '值班主任') {
          // 值班主任默认可以看到自己班组的所有建议
          const { TEAMS } = require('../models/User');
          let teamValue = req.user.team;
          let teamKey = Object.keys(TEAMS).find(key => TEAMS[key] === req.user.team);
          if (teamKey) {
            query.$or = [ { team: teamValue }, { team: teamKey } ];
          } else {
            query.team = teamValue;
          }
        } else if (req.user.role === '安全科管理人员') {
          // 安全科管理人员只能看到安全类建议
          query.type = 'SAFETY';
        } else if (req.user.role === '运行科管理人员') {
          // 运行科管理人员只能看到非安全类建议
          query.type = { $ne: 'SAFETY' };
        }
        // 部门经理默认看到所有建议 (无需修改)
    }

    logger.debug('最终主查询条件 (Suggestion):', query);
    // console.log('实施信息过滤条件 (Implementation):', implementationQuery); // 移除独立实施查询日志

    // 如果按 responsiblePerson 或 implementationStatus 过滤，需要调整主查询条件
    if (responsiblePersonId && responsiblePersonId === req.user.id) {
      // 直接在主查询中添加对嵌套字段的查询
      query['implementation.responsiblePerson'] = req.user.id;
      logger.debug('在主查询中添加 implementation.responsiblePerson 过滤');
    }
    if (implementationStatus) {
      const implStatuses = implementationStatus.split(',').map(s => s.trim());
      // 直接在主查询中添加对嵌套字段的查询
      query['implementation.status'] = { $in: implStatuses }; 
      logger.debug('在主查询中添加 implementation.status 过滤:', query['implementation.status']);
    }

    // 重新计算总数 (应用了所有过滤条件)
    const total = await Suggestion.countDocuments(query);
    logger.debug('总记录数 (应用所有过滤后):', total);

    // 构建排序选项
    let sortOptions = {};
    if (sortBy && sortOrder) {
      // 将 Ant Design 的 'ascend'/'descend' 转换为 mongoose 的 1/-1 或 'asc'/'desc'
      const order = (sortOrder === 'ascend' || sortOrder === 'asc') ? 1 : -1;
      // 特别处理嵌套字段
      if (sortBy === 'score') {
        sortOptions['scoring.score'] = order;
      } else {
        sortOptions[sortBy] = order;
      }
      logger.debug('应用排序:', sortOptions);
    } else {
      // 默认按创建时间降序排序
      sortOptions = { createdAt: -1 };
      logger.debug('应用默认排序:', sortOptions);
    }

    // 获取建议列表 (基于最终查询条件和排序)
    let suggestions = await Suggestion.find(query)
      .populate('submitter', 'name team')
      .populate({
        path: 'comments.author',
        select: 'name',
        model: 'User'
      })
      .populate({
        path: 'firstReview.reviewer', // 填充嵌套审核人
        select: 'name',
        model: 'User'
      })
      .populate({
        path: 'secondReview.reviewer', // 填充嵌套审核人
        select: 'name',
        model: 'User'
      })
      .populate({
        path: 'implementation.history.updatedBy', // 尝试填充实施历史更新人
        select: 'name username role',
        model: 'User'
      })
      // 应用排序选项
      .sort(sortOptions)
      .skip(skip)
      .limit(limit)
      .lean(); // 使用lean()提高性能

    logger.debug(`找到 ${suggestions.length} 条建议`);

    // -- 4. 处理数据 (不再需要合并，确保嵌套数据完整) --
    let processedSuggestions = suggestions.map(suggestion => {
      // const implementation = implementationMap[suggestion._id.toString()]; // 移除合并
      return {
        ...suggestion,
        submitter: suggestion.submitter || { name: '未知用户', _id: null },
        comments: Array.isArray(suggestion.comments) ? suggestion.comments.map(comment => ({
          ...comment,
          author: comment.author || { name: '未知用户' }
        })) : [],
        implementation: suggestion.implementation || null // 直接使用嵌套的实施信息
      };
    });
    // 移除 filter 逻辑，因为过滤已在主查询完成
    /*
    .filter(suggestion => {
        if (responsiblePersonId && responsiblePersonId === req.user.id) {
            return !!suggestion.implementation;
        }
        return true;
    });
    */

    logger.debug(`最终处理后 ${processedSuggestions.length} 条建议`);

    // 分页总数现在是准确的
    let finalTotal = total;
    /*
    if (responsiblePersonId && responsiblePersonId === req.user.id) { ... }
    if (implementationStatus) { ... }
    */

    res.json({
      suggestions: processedSuggestions,
      pagination: {
        current: page,
        pageSize: limit,
        // total // 使用调整后的 total
        total: finalTotal 
      }
    });
  } catch (error) {
    logger.error('获取建议列表失败:', error);
    res.status(500).json({ message: '获取建议列表失败', error: error.message });
  }
};

exports.getSuggestionById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const suggestion = await Suggestion.findById(id)
      .populate('submitter', 'name username department team')
      .populate({
        path: 'firstReview',
        populate: {
          path: 'reviewer',
          select: 'name username role'
        }
      })
      .populate({
        path: 'secondReview',
        populate: {
          path: 'reviewer',
          select: 'name username role'
        }
      })
      .populate({
        path: 'comments.author',
        select: 'name username role'
      })
      .populate({
        path: 'scoring.scorer', // 添加对打分人的 populate
        select: 'name username role'
      })
      .populate({
        path: 'scoring.history.scorer', // 添加对评分历史记录中评分人的 populate
        select: 'name username role'
      })
      .populate({
        path: 'implementation.history.updatedBy', // 确保填充实施历史操作人
        select: 'name username role',
        model: 'User'
      });
    
    if (!suggestion) {
      return res.status(404).json({ message: '未找到建议' });
    }
    
    // 不再需要查询独立的 Implementation 模型
    /*
    const { Implementation } = require('../models/Implementation');
    const implementation = await Implementation.findOne({ suggestion: suggestion._id })
      .populate('implementer', 'name username department')
      .populate('statusHistory.updatedBy', 'name username role')
      .lean();
    */
    
    // 直接使用 suggestion 中的嵌套实施信息
    const suggestionWithImplementation = suggestion.toObject();
    // suggestion.implementation 应该已经包含在 suggestion 中
    // suggestionWithImplementation.implementation = implementation || null; 
    
    res.json(suggestionWithImplementation);
  } catch (error) {
    logger.error('获取建议详情失败:', error);
    res.status(500).json({ message: '服务器错误', error: error.message });
  }
};

exports.updateSuggestionStatus = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { status, comment } = req.body;
    const suggestion = await Suggestion.findById(req.params.id);

    if (!suggestion) {
      return res.status(404).json({ message: '建议不存在' });
    }

    // 检查权限
    if (req.user.role !== '部门经理') {
      return res.status(403).json({ message: '没有权限更新建议状态' });
    }

    // 更新状态
    suggestion.status = status;
    
    // 添加评论
    if (comment) {
      suggestion.comments.push({
        author: req.user.id,
        content: comment
      });
    }

    await suggestion.save();

    // 返回更新后的建议
    const updatedSuggestion = await Suggestion.findById(req.params.id)
      .populate('submitter', 'name team')
      .populate({
        path: 'comments.author',
        select: 'name',
        model: 'User'
      })
      .populate({
        path: 'firstReview secondReview',
        populate: {
          path: 'reviewer',
          select: 'name',
          model: 'User'
        }
      })
      .lean();

    // 处理null值
    const processedSuggestion = {
      ...updatedSuggestion,
      submitter: updatedSuggestion.submitter || { name: '未知用户', _id: null },
      comments: Array.isArray(updatedSuggestion.comments) ? updatedSuggestion.comments.map(comment => ({
        ...comment,
        author: comment.author || { name: '未知用户' }
      })) : []
    };

    res.json(processedSuggestion);
  } catch (error) {
    logger.error('更新建议状态失败:', error);
    res.status(500).json({ message: '更新建议状态失败', error: error.message });
  }
};

exports.addComment = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const suggestion = await Suggestion.findById(req.params.id);

    if (!suggestion) {
      return res.status(404).json({ message: '建议不存在' });
    }

    // 添加评论
    suggestion.comments.push({
      author: req.user.id,
      content: req.body.content
    });

    await suggestion.save();

    // 返回更新后的建议
    const updatedSuggestion = await Suggestion.findById(req.params.id)
      .populate('submitter', 'name team')
      .populate({
        path: 'comments.author',
        select: 'name',
        model: 'User'
      })
      .populate({
        path: 'firstReview secondReview',
        populate: {
          path: 'reviewer',
          select: 'name',
          model: 'User'
        }
      })
      .lean();

    // 处理null值
    const processedSuggestion = {
      ...updatedSuggestion,
      submitter: updatedSuggestion.submitter || { name: '未知用户', _id: null },
      comments: Array.isArray(updatedSuggestion.comments) ? updatedSuggestion.comments.map(comment => ({
        ...comment,
        author: comment.author || { name: '未知用户' }
      })) : []
    };

    res.json(processedSuggestion);
  } catch (error) {
    logger.error('添加评论失败:', error);
    res.status(500).json({ message: '添加评论失败', error: error.message });
  }
};

/**
 * 获取所有建议
 * @param {Object} req - 请求对象
 * @param {Object} res - 响应对象
 */
exports.getAllSuggestions = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // 获取总数
    const total = await Suggestion.countDocuments();
    
    // 获取建议列表
    const suggestions = await Suggestion.find()
      .populate('submitter', 'name team')
      .populate({
        path: 'comments.author',
        select: 'name',
        model: 'User'
      })
      .populate({
        path: 'firstReview secondReview',
        populate: {
          path: 'reviewer',
          select: 'name',
          model: 'User'
        }
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // 处理null的submitter字段
    const processedSuggestions = suggestions.map(suggestion => {
      return {
        ...suggestion,
        submitter: suggestion.submitter || { name: '未知用户', _id: null },
        comments: Array.isArray(suggestion.comments) ? suggestion.comments.map(comment => ({
          ...comment,
          author: comment.author || { name: '未知用户' }
        })) : []
      };
    });

    res.json({
      suggestions: processedSuggestions,
      pagination: {
        current: page,
        pageSize: limit,
        total
      }
    });
  } catch (error) {
    logger.error('获取所有建议失败:', error);
    res.status(500).json({ message: '获取建议列表失败', error: error.message });
  }
};

/**
 * 获取特定部门的建议
 * @param {Object} req - 请求对象
 * @param {Object} res - 响应对象
 */
exports.getSuggestionsByDepartment = async (req, res) => {
  try {
    const { departmentId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // 获取总数
    const total = await Suggestion.countDocuments({ department: departmentId });
    
    // 获取建议列表
    const suggestions = await Suggestion.find({ department: departmentId })
      .populate('submitter', 'name team')
      .populate({
        path: 'comments.author',
        select: 'name',
        model: 'User'
      })
      .populate({
        path: 'firstReview secondReview',
        populate: {
          path: 'reviewer',
          select: 'name',
          model: 'User'
        }
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // 处理null的submitter字段
    const processedSuggestions = suggestions.map(suggestion => {
      return {
        ...suggestion,
        submitter: suggestion.submitter || { name: '未知用户', _id: null },
        comments: Array.isArray(suggestion.comments) ? suggestion.comments.map(comment => ({
          ...comment,
          author: comment.author || { name: '未知用户' }
        })) : []
      };
    });

    res.json({
      suggestions: processedSuggestions,
      pagination: {
        current: page,
        pageSize: limit,
        total
      }
    });
  } catch (error) {
    logger.error('获取部门建议失败:', error);
    res.status(500).json({ message: '获取建议列表失败', error: error.message });
  }
};

/**
 * 获取特定团队的建议
 * @param {Object} req - 请求对象
 * @param {Object} res - 响应对象
 */
exports.getSuggestionsByTeam = async (req, res) => {
  try {
    const { teamId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // 获取总数
    const total = await Suggestion.countDocuments({ team: teamId });
    
    // 获取建议列表
    const suggestions = await Suggestion.find({ team: teamId })
      .populate('submitter', 'name team')
      .populate({
        path: 'comments.author',
        select: 'name',
        model: 'User'
      })
      .populate({
        path: 'firstReview secondReview',
        populate: {
          path: 'reviewer',
          select: 'name',
          model: 'User'
        }
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // 处理null的submitter字段
    const processedSuggestions = suggestions.map(suggestion => {
      return {
        ...suggestion,
        submitter: suggestion.submitter || { name: '未知用户', _id: null },
        comments: Array.isArray(suggestion.comments) ? suggestion.comments.map(comment => ({
          ...comment,
          author: comment.author || { name: '未知用户' }
        })) : []
      };
    });

    res.json({
      suggestions: processedSuggestions,
      pagination: {
        current: page,
        pageSize: limit,
        total
      }
    });
  } catch (error) {
    logger.error('获取团队建议失败:', error);
    res.status(500).json({ message: '获取建议列表失败', error: error.message });
  }
};

/**
 * 获取用户提交的建议
 * @param {Object} req - 请求对象
 * @param {Object} res - 响应对象
 */
exports.getUserSuggestions = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // 获取总数
    const total = await Suggestion.countDocuments({ submitter: req.user.id });
    
    // 获取建议列表
    const suggestions = await Suggestion.find({ submitter: req.user.id })
      .populate('submitter', 'name team')
      .populate({
        path: 'comments.author',
        select: 'name',
        model: 'User'
      })
      .populate({
        path: 'firstReview secondReview',
        populate: {
          path: 'reviewer',
          select: 'name',
          model: 'User'
        }
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // 处理null的submitter字段
    const processedSuggestions = suggestions.map(suggestion => {
      return {
        ...suggestion,
        submitter: suggestion.submitter || { name: '未知用户', _id: null },
        comments: Array.isArray(suggestion.comments) ? suggestion.comments.map(comment => ({
          ...comment,
          author: comment.author || { name: '未知用户' }
        })) : []
      };
    });

    res.json({
      suggestions: processedSuggestions,
      pagination: {
        current: page,
        pageSize: limit,
        total
      }
    });
  } catch (error) {
    logger.error('获取用户建议失败:', error);
    res.status(500).json({ message: '获取建议列表失败', error: error.message });
  }
};

/**
 * 获取待审核的建议
 * @param {Object} req - 请求对象
 * @param {Object} res - 响应对象
 */
exports.getPendingReviewSuggestions = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // 构建查询条件
    const query = {};
    const userRole = req.user.role;
    const userTeam = req.user.team;

    if (userRole === '值班主任') {
      // 值班主任只能看到自己团队待一级审核的建议
      query.team = userTeam;
      query.status = 'PENDING_FIRST_REVIEW';
    } else if (userRole === '安全科管理人员') {
      // 安全科管理人员只能看到安全类的待二级审核的建议
      query.type = 'SAFETY';
      query.status = 'PENDING_SECOND_REVIEW';
    } else if (userRole === '运行科管理人员') {
      // 运行科管理人员只能看到非安全类的待二级审核的建议
      query.type = { $ne: 'SAFETY' };
      query.status = 'PENDING_SECOND_REVIEW';
    } else if (userRole === '部门经理') {
      // 部门经理可以看到所有待审核的建议
      query.status = { $in: ['PENDING_FIRST_REVIEW', 'PENDING_SECOND_REVIEW'] };
    }

    // 获取总数
    const total = await Suggestion.countDocuments(query);
    
    // 获取建议列表
    const suggestions = await Suggestion.find(query)
      .populate('submitter', 'name team')
      .populate({
        path: 'comments.author',
        select: 'name',
        model: 'User'
      })
      .populate({
        path: 'firstReview secondReview',
        populate: {
          path: 'reviewer',
          select: 'name',
          model: 'User'
        }
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // 处理null的submitter字段
    const processedSuggestions = suggestions.map(suggestion => {
      return {
        ...suggestion,
        submitter: suggestion.submitter || { name: '未知用户', _id: null },
        comments: Array.isArray(suggestion.comments) ? suggestion.comments.map(comment => ({
          ...comment,
          author: comment.author || { name: '未知用户' }
        })) : []
      };
    });

    res.json({
      suggestions: processedSuggestions,
      pagination: {
        current: page,
        pageSize: limit,
        total
      }
    });
  } catch (error) {
    logger.error('获取待审核建议失败:', error);
    res.status(500).json({ message: '获取建议列表失败', error: error.message });
  }
};

// 创建新建议
exports.createSuggestion = async (req, res) => {
  try {
    // 检查用户权限 - 运行科和安全科管理人员不允许提交建议
    if (req.user && (req.user.role === '运行科管理人员' || req.user.role === '安全科管理人员')) {
      return res.status(403).json({
        success: false,
        message: '运行科和安全科管理人员暂时无法提交建议'
      });
    }
    
    const { title, type, content, expectedBenefit } = req.body;
    
    // 验证必填字段
    if (!title || !type || !content) {
      return res.status(400).json({
        success: false,
        message: '标题、类型和内容为必填项'
      });
    }
    
    // 创建建议对象
    const suggestion = new Suggestion({
      title,
      type,
      content,
      expectedBenefit,
      submitter: req.user._id,
      team: req.user.team
    });
    
    // 处理附件上传
    if (req.files && req.files.length > 0) {
      suggestion.attachments = req.files.map(file => ({
        filename: file.filename,
        path: file.path,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size
      }));
    }
    
    // 保存建议
    await suggestion.save();
    
    // 返回成功响应
    res.status(201).json({
      success: true,
      message: '建议提交成功',
      suggestion
    });
  } catch (error) {
    logger.error('创建建议失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误，建议提交失败',
      error: error.message
    });
  }
};

/**
 * 更新建议
 * @param {Object} req - 请求对象
 * @param {Object} res - 响应对象
 */
exports.updateSuggestion = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, category, content, type, expectedBenefit, reason } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;
    const userTeam = req.user.team;
    
    // 查找待更新的建议
    const suggestion = await Suggestion.findById(id);
    
    if (!suggestion) {
      return res.status(404).json({ message: '未找到建议' });
    }
    
    // 确保正确比较MongoDB ObjectId
    const submitterId = typeof suggestion.submitter === 'object' ? 
                        suggestion.submitter.toString() : 
                        suggestion.submitter;
    
    // 确保用户ID也是字符串格式
    const userIdStr = typeof userId === 'object' ? userId.toString() : userId;
    
    // 检查用户是否有修改权限
    const isSubmitter = submitterId && submitterId === userIdStr;
    const isDepartmentManager = userRole === '部门经理';
    const isSafetyAdmin = userRole === '安全科管理人员';
    const isOperationAdmin = userRole === '运行科管理人员';
    const isSupervisor = userRole === '值班主任';
    
    // 获取建议的类型
    const isSafetyType = suggestion.type === 'SAFETY' || suggestion.type === '安全管理';
    
    // 管理人员对建议的修改权限检查
    const hasManagementAccess = 
        // 部门经理可以修改所有建议
        isDepartmentManager || 
        // 安全科管理人员只能修改安全类建议
        (isSafetyAdmin && isSafetyType) || 
        // 运行科管理人员只能修改非安全类建议
        (isOperationAdmin && !isSafetyType) || 
        // 值班主任只能修改本班组的建议
        (isSupervisor && suggestion.team === userTeam);
    
    // 权限检查：非提交者也非管理人员，则无权修改
    if (!isSubmitter && !hasManagementAccess) {
      return res.status(403).json({ 
        message: '没有修改权限',
        userMessage: '没有修改权限'
      });
    }
    
    // 提交者修改权限检查：只有在等待一级审核或已驳回状态下可以更新
    if (isSubmitter && !hasManagementAccess) {
      if (suggestion.reviewStatus !== 'PENDING_FIRST_REVIEW' && suggestion.reviewStatus !== 'REJECTED') {
        return res.status(400).json({ 
          message: '只有等待一级审核或已驳回的建议才能更新',
          userMessage: '建议当前状态无法修改'
        });
      }
    }
    
    // 处理新上传的附件
    const newAttachments = req.files ? req.files.map(file => ({
      filename: file.filename,
      originalname: file.originalname,
      path: file.path,
      mimetype: file.mimetype,
      size: file.size
    })) : [];
    
    // 更新建议
    if (title) suggestion.title = title;
    if (type) suggestion.type = type;
    if (content) suggestion.content = content;
    if (expectedBenefit) suggestion.expectedBenefit = expectedBenefit;
    if (description) suggestion.description = description;
    if (category) suggestion.category = category;
    
    // 如果建议被驳回且由提交者修改，则将状态改回待一级审核状态
    if (isSubmitter && suggestion.reviewStatus === 'REJECTED') {
      suggestion.reviewStatus = 'PENDING_FIRST_REVIEW';
      suggestion.status = 'PENDING_FIRST_REVIEW';
      
      // 添加状态变更记录
      suggestion.comments.push({
        content: '建议已修改并重新提交审核',
        author: userId,
        createdAt: new Date()
      });
    }
    
    // 如果有新附件，添加到现有附件列表
    if (newAttachments.length > 0) {
      suggestion.attachments = [...suggestion.attachments, ...newAttachments];
    }
    
    // 添加更新记录到comments中
    if (reason) {
      suggestion.comments.push({
        content: `修改原因: ${reason} ${hasManagementAccess ? '(管理人员修改)' : ''}`,
        author: userId,
        createdAt: new Date()
      });
    } else {
      suggestion.comments.push({
        content: `建议已被${hasManagementAccess ? '管理人员' : '提交者'}修改`,
        author: userId,
        createdAt: new Date()
      });
    }
    
    await suggestion.save();
    
    // 返回更新后的建议
    const updatedSuggestion = await Suggestion.findById(id)
      .populate('submitter', 'name username department team');
    
    res.json(updatedSuggestion);
  } catch (error) {
    logger.error('更新建议失败:', error);
    res.status(500).json({ message: '服务器错误', error: error.message });
  }
};

// 删除建议
exports.deleteSuggestion = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    // 查找待删除的建议
    const suggestion = await Suggestion.findById(id);
    logger.debug('获取建议信息', { suggestionId: id });

    if (!suggestion) {
      return res.status(404).json({ success: false, message: '未找到建议' });
    }
    
    // 权限验证：允许部门经理或未通过二级审核的建议提交者删除
    const user = await User.findById(userId);
    if (!user) {
      return res.status(403).json({ success: false, message: '用户不存在' });
    }

    // 检查删除权限
    const submitterId = suggestion.submitter.toString();
    const currentUserId = userId.toString();
    const isSubmitter = submitterId === currentUserId;
    const isManager = user.role === '部门经理';
    const hasSecondReviewApproval = suggestion.secondReview && suggestion.secondReview.result === 'APPROVED';
    
    // 允许删除的条件：1. 是部门经理 2. 是提交者且建议未通过二级审核
    const canDelete = isManager || (isSubmitter && !hasSecondReviewApproval);

    if (!canDelete) {
      logger.warn('删除建议权限不足', {
        userId,
        userRole: user.role,
        isSubmitter,
        isManager,
        hasSecondReviewApproval
      });

      let message = '权限不足';
      let details = [];
      
      if (!isSubmitter && !isManager) {
        details.push('只有建议提交者或部门经理可以删除建议');
      } else if (isSubmitter && hasSecondReviewApproval) {
        details.push('建议已通过二级审核，无法删除');
      }

      return res.status(403).json({ 
        success: false, 
        message: message,
        details: details,
        required: ['部门经理', '建议提交者（仅限二级审核通过前）'],
        current: user.role
      });
    }
        
    // 删除关联的附件
    if (suggestion.attachments && suggestion.attachments.length > 0) {
      logger.debug('开始删除附件', { 
        suggestionId: id, 
        attachmentCount: suggestion.attachments.length 
      });

      const unlinkPromises = suggestion.attachments.map(attachment => {
        return new Promise((resolve, reject) => {
          if (attachment.filename) {
            const uploadsDir = path.join(__dirname, '../uploads');
            const filePath = path.join(uploadsDir, attachment.filename);
            fs.unlink(filePath, (err) => {
              if (err && err.code === 'ENOENT') {
                logger.warn('附件文件不存在', { filePath });
                resolve();
              } else if (err) {
                logger.error('删除附件失败', { filePath, error: err });
                reject(err);
              } else {
                logger.debug('附件删除成功', { filePath });
                resolve();
              }
            });
          } else {
            resolve();
          }
        });
      });

      try {
        await Promise.all(unlinkPromises);
        logger.info('所有附件删除完成', { suggestionId: id });
      } catch (unlinkError) {
        logger.error('删除附件时出错', { 
          suggestionId: id, 
          error: unlinkError 
        });
        return res.status(500).json({ 
          success: false, 
          message: '删除建议的附件时出错', 
          error: unlinkError.message 
        });
      }
    }
    
    // 删除建议文档
    await Suggestion.findByIdAndDelete(id);
    logger.info('建议删除成功', { 
      suggestionId: id, 
      userId, 
      userRole: user.role 
    });
    
    res.json({ success: true, message: '建议及关联数据已成功删除' });
  } catch (error) {
    logger.error('删除建议失败', { 
      suggestionId: req.params.id, 
      error 
    });
    res.status(500).json({ 
      success: false, 
      message: '服务器错误，删除建议失败', 
      error: error.message 
    });
  }
};



// 获取建议统计数据
exports.getSuggestionStats = async (req, res) => {
  try {
    const totalCount = await Suggestion.countDocuments();
    
    // 按状态统计
    const statusCounts = await Suggestion.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    
    // 按类别统计
    const categoryCounts = await Suggestion.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      }
    ]);
    
    // 按部门统计
    const departmentStats = await Suggestion.aggregate([
      {
        $lookup: {
          from: 'users',
          localField: 'author',
          foreignField: '_id',
          as: 'authorInfo'
        }
      },
      {
        $unwind: '$authorInfo'
      },
      {
        $group: {
          _id: '$authorInfo.department',
          count: { $sum: 1 }
        }
      }
    ]);
    
    // 格式化状态统计结果
    const formattedStatusCounts = statusCounts.map(item => ({
      status: SUGGESTION_STATUS[item._id],
      statusKey: item._id,
      count: item.count
    }));
    
    res.json({
      totalCount,
      statusCounts: formattedStatusCounts,
      categoryCounts,
      departmentStats
    });
  } catch (error) {
    logger.error('获取建议统计数据失败:', error);
    res.status(500).json({ message: '服务器错误', error: error.message });
  }
};

// 获取实施完成率
exports.getImplementationRate = async (req, res) => {
  try {
    // 获取总审核通过的建议数
    const approvedTotal = await Suggestion.countDocuments({
      status: { $in: ['NOT_IMPLEMENTED', 'IMPLEMENTING', 'COMPLETED'] }
    });
    
    // 获取已完成实施的建议数
    const completedCount = await Suggestion.countDocuments({
      status: 'COMPLETED'
    });
    
    // 计算实施完成率
    const implementationRate = approvedTotal > 0 ? (completedCount / approvedTotal * 100).toFixed(2) : 0;
    
    // 获取实施时间统计
    const implementationTimes = await Suggestion.aggregate([
      {
        $match: {
          status: 'COMPLETED',
          implementationDate: { $exists: true }
        }
      },
      {
        $project: {
          implementationDuration: {
            $divide: [
              { $subtract: ['$implementationDate', '$createdAt'] },
              1000 * 60 * 60 * 24 // 转换为天数
            ]
          }
        }
      },
      {
        $group: {
          _id: null,
          averageDuration: { $avg: '$implementationDuration' },
          minDuration: { $min: '$implementationDuration' },
          maxDuration: { $max: '$implementationDuration' }
        }
      }
    ]);
    
    // 按月统计实施完成情况
    const monthlyStats = await Suggestion.aggregate([
      {
        $match: {
          status: 'COMPLETED',
          implementationDate: { $exists: true }
        }
      },
      {
        $project: {
          month: { $month: '$implementationDate' },
          year: { $year: '$implementationDate' }
        }
      },
      {
        $group: {
          _id: {
            year: '$year',
            month: '$month'
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: {
          '_id.year': 1,
          '_id.month': 1
        }
      }
    ]);
    
    res.json({
      approvedTotal,
      completedCount,
      implementationRate,
      averageImplementationTime: implementationTimes.length > 0 ? implementationTimes[0].averageDuration.toFixed(2) : 0,
      minImplementationTime: implementationTimes.length > 0 ? implementationTimes[0].minDuration.toFixed(2) : 0,
      maxImplementationTime: implementationTimes.length > 0 ? implementationTimes[0].maxDuration.toFixed(2) : 0,
      monthlyStats
    });
  } catch (error) {
    logger.error('获取实施完成率失败:', error);
    res.status(500).json({ message: '服务器错误', error: error.message });
  }
};

/**
 * 提交审核
 * @param {Object} req - 请求对象
 * @param {Object} res - 响应对象
 */
exports.submitReview = async (req, res) => {
  try {
    const { suggestionId, reviewType, result, comment } = req.body;
    
    logger.debug('接收到审核请求:', {
      suggestionId,
      reviewType,
      result,
      comment,
      userId: req.user.id
    });
    
    if (!suggestionId || !reviewType || !result || !comment) {
      return res.status(400).json({ message: '缺少必要参数' });
    }
    
    // 验证reviewType (first/second)
    if (reviewType !== 'first' && reviewType !== 'second') {
      return res.status(400).json({ message: '无效的审核类型' });
    }
    
    // 验证result (APPROVED/REJECTED)
    if (result !== 'APPROVED' && result !== 'REJECTED') {
      return res.status(400).json({ message: '无效的审核结果' });
    }
    
    // 获取建议
    const suggestion = await Suggestion.findById(suggestionId);
    if (!suggestion) {
      return res.status(404).json({ message: '建议不存在' });
    }
    
    logger.debug('找到建议:', {
      id: suggestion._id,
      status: suggestion.status,
      type: suggestion.type,
      team: suggestion.team
    });
    
    // 更灵活地验证建议状态
    const currentDbStatus = suggestion.reviewStatus || suggestion.status; // 获取当前状态（优先reviewStatus）
    const isPendingFirstReview = [
      'PENDING_FIRST_REVIEW',               // 检查 Key
      REVIEW_STATUS.PENDING_FIRST_REVIEW, // 检查 Value ('等待一级审核')
      // 如果还有其他可能的旧值，也加在这里
    ].includes(currentDbStatus);
    
    const isPendingSecondReview = [
      'PENDING_SECOND_REVIEW',              // 检查 Key
      REVIEW_STATUS.PENDING_SECOND_REVIEW, // 检查 Value ('等待二级审核')
      // 如果还有其他可能的旧值，也加在这里
    ].includes(currentDbStatus);
    
    logger.debug('状态验证结果:', {
      statusFromDb: suggestion.status, // 保留原始日志
      reviewStatusFromDb: suggestion.reviewStatus, // 增加 reviewStatus 日志
      currentDbStatus: currentDbStatus, // 增加合并后的状态日志
      isPendingFirstReview,
      isPendingSecondReview,
      SUGGESTION_STATUS_VALUE: REVIEW_STATUS.PENDING_FIRST_REVIEW
    });
    
    // 验证建议状态
    if (reviewType === 'first' && !isPendingFirstReview) {
      return res.status(400).json({ 
        message: '建议不处于待一级审核状态',
        currentStatus: currentDbStatus, // 使用合并后的状态
        expectedStatus: REVIEW_STATUS.PENDING_FIRST_REVIEW
      });
    }
    
    if (reviewType === 'second' && !isPendingSecondReview) {
      return res.status(400).json({ 
        message: '建议不处于待二级审核状态',
        currentStatus: currentDbStatus, // 使用合并后的状态
        expectedStatus: REVIEW_STATUS.PENDING_SECOND_REVIEW
      });
    }
    
    // 获取审核人
    const reviewer = await User.findById(req.user.id);
    if (!reviewer) {
      return res.status(404).json({ message: '审核人不存在' });
    }
    
    logger.debug('审核人信息:', {
      id: reviewer._id,
      role: reviewer.role,
      team: reviewer.team
    });
    
    // 验证审核权限
    const canReview = await validateReviewPermission(reviewer, suggestion, reviewType);
    if (!canReview) {
      return res.status(403).json({ message: '无审核权限' });
    }
    
    // 创建审核记录
    const review = {
      reviewer: req.user.id,
      result: result,
      comments: comment,
      reviewedAt: new Date()
    };
    
    // 更新建议
    if (reviewType === 'first') {
      suggestion.firstReview = review;
      if (result === 'APPROVED') {
        suggestion.reviewStatus = 'PENDING_SECOND_REVIEW';
        suggestion.status = 'PENDING_SECOND_REVIEW'; // 同时更新status字段
      } else {
        suggestion.reviewStatus = 'REJECTED';
        suggestion.status = 'REJECTED'; // 同时更新status字段
      }
    } else if (reviewType === 'second') {
      suggestion.secondReview = review;
      if (result === 'APPROVED') {
        suggestion.reviewStatus = 'APPROVED';
        suggestion.status = 'NOT_IMPLEMENTED'; // 同时更新status字段
        // 初始化实施状态
        suggestion.implementationStatus = 'NOT_STARTED';
        suggestion.implementation = {
          status: 'NOT_STARTED',
          history: [{
            status: 'NOT_STARTED',
            updatedBy: req.user.id,
            date: new Date(),
            notes: '建议已通过二级审核，等待实施'
          }]
        };
      } else {
        suggestion.reviewStatus = 'REJECTED';
        suggestion.status = 'REJECTED'; // 同时更新status字段
      }
    }
    
    logger.debug('即将保存的建议:', {
      id: suggestion._id,
      newStatus: suggestion.status,
      newReviewStatus: suggestion.reviewStatus
    });
    
    await suggestion.save();
    
    // 查询完整的建议信息
    const updatedSuggestion = await Suggestion.findById(suggestionId)
      .populate('submitter', 'name team')
      .populate({
        path: 'firstReview.reviewer',
        select: 'name role',
        model: 'User'
      })
      .populate({
        path: 'secondReview.reviewer',
        select: 'name role',
        model: 'User'
      });
    
    logger.debug('审核成功完成');
    
    res.json({
      message: '审核提交成功',
      suggestion: updatedSuggestion
    });
  } catch (error) {
    logger.error('提交审核失败:', error);
    res.status(500).json({ message: '服务器错误', error: error.message });
  }
};

// 验证审核权限
const validateReviewPermission = async (reviewer, suggestion, reviewType) => {
  const role = reviewer.role;
  const team = reviewer.team;

  // 部门经理可以进行所有审核
  if (role === '部门经理') {
    return true;
  }

  // 一级审核权限验证
  if (reviewType === 'first') {
    // 值班主任只能审核自己班组的建议
    if (role === '值班主任' && team === suggestion.team) {
      return true;
    }
  }

  // 二级审核权限验证
  if (reviewType === 'second') {
    // 安全科管理人员只能审核安全类建议
    if (role === '安全科管理人员' && suggestion.type === 'SAFETY') {
      return true;
    }
    // 运行科管理人员只能审核非安全类建议
    if (role === '运行科管理人员' && suggestion.type !== 'SAFETY') {
      return true;
    }
  }

  return false;
};

/**
 * 更新建议实施状态
 * @param {Object} req - 请求对象
 * @param {Object} res - 响应对象
 */
exports.updateImplementation = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, responsiblePerson, startDate, plannedCompletionDate, actualCompletionDate, notes, attachments, completionRate } = req.body;
    const userId = req.user.id;

    // 查找建议
    const suggestion = await Suggestion.findById(id);
    if (!suggestion) {
      return res.status(404).json({ success: false, message: '未找到该建议' });
    }

    // 检查审核状态是否为 '已批准'
    if (suggestion.reviewStatus !== 'APPROVED') {
         return res.status(400).json({ success: false, message: '建议尚未通过审核，无法更新实施状态' });
    }

    // 直接验证传入的 status 是否是有效的英文代码
    const validStatusCodes = Object.keys(IMPLEMENTATION_STATUS); // 使用从常量文件导入的 IMPLEMENTATION_STATUS
    if (!status || !validStatusCodes.includes(status)) {
        // 如果 status 无效或未提供
        return res.status(400).json({
            success: false,
            message: `无效的实施状态代码: ${status}`
        });
    }
    
    // 查找或创建实施信息
    let implementation = suggestion.implementation;
    if (!implementation) {
      suggestion.implementation = {};
      implementation = suggestion.implementation;
      implementation.status = 'NOT_STARTED';
      implementation.history = [{
          status: 'NOT_STARTED',
          updatedBy: userId,
          date: new Date(),
          notes: '初始化实施记录'
      }];
    }
    if (!implementation.history) {
        implementation.history = [];
    }

    const oldStatus = implementation.status || 'NOT_STARTED';
    let statusChanged = false;

    // 更新实施信息 (直接使用验证后的 status)
    if (status !== oldStatus) {
      implementation.status = status;
      suggestion.implementationStatus = status; // 同步顶层状态
      statusChanged = true;
    }
    if (responsiblePerson) implementation.responsiblePerson = responsiblePerson;
    if (startDate) implementation.startDate = startDate;
    if (plannedCompletionDate) implementation.plannedEndDate = plannedCompletionDate; 
    if (actualCompletionDate) implementation.actualEndDate = actualCompletionDate;
    if (typeof completionRate === 'number') implementation.completionRate = completionRate;
    
    // 添加历史记录
    if (statusChanged || notes) {
        const historyEntry = {
            status: implementation.status,
            updatedBy: userId,
            date: new Date(),
            // 使用导入的 IMPLEMENTATION_STATUS 获取中文名
            notes: notes || (statusChanged ? `状态更新为: ${IMPLEMENTATION_STATUS[implementation.status] || implementation.status}` : '更新实施信息')
        };
        implementation.history.push(historyEntry);
    }
    
    await suggestion.save();

    res.json({
      success: true,
      message: '实施信息更新成功',
      suggestion: suggestion
    });

  } catch (error) {
    logger.error('更新实施状态失败:', error);
    res.status(500).json({
      success: false,
      message: '更新实施状态失败',
      error: error.message
    });
  }
};

/**
 * 获取建议实施统计数据
 * @param {Object} req - 请求对象
 * @param {Object} res - 响应对象
 */
exports.getImplementationStats = async (req, res) => {
  try {
    // 获取已批准建议总数
    const approvedCount = await Suggestion.countDocuments({
      status: { $in: ['NOT_IMPLEMENTED', 'IMPLEMENTING', 'COMPLETED'] }
    });
    
    // 获取各实施状态的数量
    const implementingCount = await Suggestion.countDocuments({ status: 'IMPLEMENTING' });
    const completedCount = await Suggestion.countDocuments({ status: 'COMPLETED' });
    const notImplementedCount = await Suggestion.countDocuments({ status: 'NOT_IMPLEMENTED' });
    
    // 计算实施率
    const implementationRate = approvedCount > 0 
      ? (completedCount / approvedCount * 100).toFixed(2)
      : 0;
    
    // 按月统计实施完成数量
    const monthlyStats = await Suggestion.aggregate([
      {
        $match: { status: 'COMPLETED', implementationDate: { $exists: true } }
      },
      {
        $group: {
          _id: {
            year: { $year: '$implementationDate' },
            month: { $month: '$implementationDate' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);
    
    // 按类型统计实施完成情况
    const typeStats = await Suggestion.aggregate([
      {
        $match: { status: 'COMPLETED' }
      },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 }
        }
      }
    ]);
    
    // 按班组统计实施完成情况
    const teamStats = await Suggestion.aggregate([
      {
        $match: { status: 'COMPLETED' }
      },
      {
        $group: {
          _id: '$team',
          count: { $sum: 1 }
        }
      }
    ]);
    
    res.json({
      approvedCount,
      implementingCount,
      completedCount,
      notImplementedCount,
      implementationRate,
      monthlyStats,
      typeStats,
      teamStats
    });
  } catch (error) {
    logger.error('获取实施统计数据失败:', error);
    res.status(500).json({ message: '服务器错误', error: error.message });
  }
};

/**
 * 一级审核（值班主任）
 * @param {Object} req - 请求对象
 * @param {Object} res - 响应对象
 */
exports.firstReview = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { approved, comments } = req.body;
    const suggestion = await Suggestion.findById(req.params.id);

    if (!suggestion) {
      return res.status(404).json({ message: '建议不存在' });
    }

    // 检查建议是否处于待一级审核状态
    if (suggestion.status !== 'PENDING_FIRST_REVIEW') {
      return res.status(400).json({ message: '建议不处于待一级审核状态' });
    }

    // 检查权限（值班主任只能审核自己班组的建议）
    if (req.user.role === '值班主任' && req.user.team !== suggestion.team) {
      return res.status(403).json({ message: '只能审核自己班组的建议' });
    }

    // 创建审核记录
    const review = {
      reviewer: req.user.id,
      result: approved === 'approve' ? 'APPROVED' : 'REJECTED',
      comments: comments,
      reviewedAt: new Date()
    };

    // 更新建议
    suggestion.firstReview = review;
    
    if (approved === 'approve') {
      suggestion.status = 'PENDING_SECOND_REVIEW';
      suggestion.reviewStatus = 'PENDING_SECOND_REVIEW'; // 同时更新reviewStatus字段
    } else {
      suggestion.status = 'REJECTED';
      suggestion.reviewStatus = 'REJECTED'; // 同时更新reviewStatus字段
    }

    await suggestion.save();

    // 获取更新后的建议（包含关联信息）
    const updatedSuggestion = await Suggestion.findById(req.params.id)
      .populate('submitter', 'name team')
      .populate({
        path: 'firstReview.reviewer',
        select: 'name role',
        model: 'User'
      });

    res.json({
      message: approved === 'approve' ? '建议已通过一级审核' : '建议已在一级审核中被拒绝',
      suggestion: updatedSuggestion
    });
  } catch (error) {
    logger.error('一级审核失败:', error);
    res.status(500).json({ message: '服务器错误', error: error.message });
  }
};

/**
 * 二级审核（安全科/运行科管理人员）
 * @param {Object} req - 请求对象
 * @param {Object} res - 响应对象
 */
exports.secondReview = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { approved, comments } = req.body;
    const suggestion = await Suggestion.findById(req.params.id);

    if (!suggestion) {
      return res.status(404).json({ message: '建议不存在' });
    }

    // 检查建议是否处于待二级审核状态
    if (suggestion.status !== 'PENDING_SECOND_REVIEW') {
      return res.status(400).json({ message: '建议不处于待二级审核状态' });
    }

    // 检查权限
    const userRole = req.user.role;
    if (userRole === '安全科管理人员' && suggestion.type !== 'SAFETY') {
      return res.status(403).json({ message: '安全科管理人员只能审核安全类建议' });
    }
    if (userRole === '运行科管理人员' && suggestion.type === 'SAFETY') {
      return res.status(403).json({ message: '运行科管理人员不能审核安全类建议' });
    }

    // 创建审核记录
    const review = {
      reviewer: req.user.id,
      result: approved === 'approve' ? 'APPROVED' : 'REJECTED',
      comments: comments,
      reviewedAt: new Date()
    };

    // 更新建议
    suggestion.secondReview = review;
    
    if (approved === 'approve') {
      suggestion.status = 'NOT_IMPLEMENTED'; // 或者之前使用的 'APPROVED'
      suggestion.reviewStatus = 'APPROVED'; // 同时更新reviewStatus字段
      
      // 初始化实施状态
      suggestion.implementationStatus = 'NOT_STARTED';
      suggestion.implementation = {
        status: 'NOT_STARTED',
        history: [{
          status: 'NOT_STARTED',
          updatedBy: req.user.id,
          date: new Date(),
          notes: '建议已通过二级审核，等待实施'
        }]
      };
    } else {
      suggestion.status = 'REJECTED';
      suggestion.reviewStatus = 'REJECTED'; // 同时更新reviewStatus字段
    }

    await suggestion.save();

    // 获取更新后的建议（包含关联信息）
    const updatedSuggestion = await Suggestion.findById(req.params.id)
      .populate('submitter', 'name team')
      .populate({
        path: 'firstReview.reviewer',
        select: 'name role',
        model: 'User'
      })
      .populate({
        path: 'secondReview.reviewer',
        select: 'name role',
        model: 'User'
      });

    res.json({
      message: approved === 'approve' ? '建议已通过二级审核' : '建议已在二级审核中被拒绝',
      suggestion: updatedSuggestion
    });
  } catch (error) {
    logger.error('二级审核失败:', error);
    res.status(500).json({ message: '服务器错误', error: error.message });
  }
};

/**
 * 为建议打分
 * 部门经理可以评分所有建议
 * 安全科管理人员只能评分安全类建议
 * 运行科管理人员只能评分非安全类建议
 * @param {Object} req - 请求对象
 * @param {Object} res - 响应对象
 */
exports.scoreSuggestion = async (req, res) => {
  // Add log at the very beginning
  logger.debug(`[DEBUG] Entering scoreSuggestion for suggestion ID: ${req.params.id} by user ${req.user.id}`); 
  try {
    const { id } = req.params;
    const { score } = req.body;
    const scorerId = req.user.id; // 从 auth 中间件获取

    const suggestion = await Suggestion.findById(id);
    if (!suggestion) {
      return res.status(404).json({ success: false, message: '未找到建议' });
    }

    // 新增校验：确保建议状态是 APPROVED
    if (suggestion.reviewStatus !== 'APPROVED') {
      return res.status(400).json({ success: false, message: '建议必须处于已批准状态才能评分' });
    }

    // 验证分数 (允许小数，范围 0-10)
    const scoreValue = parseFloat(req.body.score);
    if (isNaN(scoreValue) || scoreValue < 0 || scoreValue > 10) {
      return res.status(400).json({ success: false, message: '分数必须是 0 到 10 之间的有效数字' });
    }

    // 创建评分记录，使用验证和转换后的 scoreValue
    const scoringRecord = {
      score: scoreValue, 
      scorer: scorerId,
      scorerRole: req.user.role,
      scoredAt: new Date()
    };

    // 如果已有评分，将当前评分保存到历史记录
    if (suggestion.scoring && suggestion.scoring.score !== undefined) {
      // 初始化历史记录数组（如果不存在）
      if (!suggestion.scoring.history) {
        suggestion.scoring.history = [];
      }
      
      // 将当前评分信息（修改前的）添加到历史记录
      // Make sure to push the OLD data before overwriting
      const oldScoringData = {
        score: suggestion.scoring.score, // Push the existing numeric score
        scorer: suggestion.scoring.scorer,
        scorerRole: suggestion.scoring.scorerRole, // Use the role stored in the suggestion
        scoredAt: suggestion.scoring.scoredAt // Use the date stored in the suggestion
      };
      suggestion.scoring.history.push(oldScoringData);

      // 更新当前评分信息 (直接修改字段，而不是替换整个对象)
      suggestion.scoring.score = scoreValue; // Update with the validated numeric score
      suggestion.scoring.scorer = scoringRecord.scorer;
      suggestion.scoring.scorerRole = scoringRecord.scorerRole;
      suggestion.scoring.scoredAt = scoringRecord.scoredAt;
      // suggestion.scoring.history remains as it is (already updated)

    } else {
       // 如果是第一次评分，直接设置 scoring 对象
       suggestion.scoring = {
         score: scoreValue, // Use the validated numeric score
         scorer: scorerId,
         scorerRole: req.user.role,
         scoredAt: new Date(),
         history: [] // Initialize history
       };
       // Ensure history array is initialized for future updates, even if empty now
       // suggestion.scoring.history = []; // Already initialized above
    }

    // 在保存前打印日志，检查 scoring 对象和 history 数组
    logger.debug('[DEBUG] Saving suggestion scoring data:');
    logger.debug('[DEBUG] Current Score:', suggestion.scoring?.score);
    logger.debug('[DEBUG] Scorer:', suggestion.scoring?.scorer);
    logger.debug('[DEBUG] Scored At:', suggestion.scoring?.scoredAt);
    logger.debug('[DEBUG] Full Scoring Object:', JSON.stringify(suggestion.scoring, null, 2));
    logger.debug('[DEBUG] History Array Length:', suggestion.scoring?.history?.length);
    logger.debug('[DEBUG] History Array Content:', JSON.stringify(suggestion.scoring?.history, null, 2));

    await suggestion.save();

    // 返回更新后的建议，并填充打分人信息
    const updatedSuggestion = await Suggestion.findById(id)
      .populate('submitter', 'name team')
      .populate({
        path: 'firstReview.reviewer',
        select: 'name role',
        model: 'User'
      })
      .populate({
        path: 'secondReview.reviewer',
        select: 'name role',
        model: 'User'
      })
      .populate({
        path: 'scoring.scorer', // 填充打分人信息
        select: 'name role',
        model: 'User'
      });

    res.json({
      success: true,
      message: '建议打分成功',
      suggestion: updatedSuggestion
    });

  } catch (error) {
    logger.error('建议打分失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误，打分失败',
      error: error.message
    });
  }
};

/**
 * 重置建议评分
 * 部门经理可以清除错误的评分，将建议恢复到未打分状态
 * @param {Object} req - 请求对象
 * @param {Object} res - 响应对象
 */
exports.resetSuggestionScore = async (req, res) => {
  logger.debug(`[DEBUG] Entering resetSuggestionScore for suggestion ID: ${req.params.id} by user ${req.user.id}`); 
  try {
    const { id } = req.params;
    const userId = req.user.id; // 从 auth 中间件获取

    const suggestion = await Suggestion.findById(id);
    if (!suggestion) {
      return res.status(404).json({ success: false, message: '未找到建议' });
    }

    // 新增校验：确保建议有评分
    if (!suggestion.scoring || suggestion.scoring.score === undefined) {
      return res.status(400).json({ success: false, message: '该建议尚未评分，无需重置' });
    }

    // 简单记录操作日志
    logger.info('重置评分操作', {
      suggestionId: id,
      previousScore: suggestion.scoring.score,
      resetBy: userId,
      resetByRole: req.user.role,
      resetAt: new Date()
    });

    // 完全删除评分信息
    suggestion.scoring = undefined;

    await suggestion.save();

    // 返回更新后的建议，并填充相关信息
    const updatedSuggestion = await Suggestion.findById(id)
      .populate('submitter', 'name team')
      .populate({
        path: 'firstReview.reviewer',
        select: 'name role',
        model: 'User'
      })
      .populate({
        path: 'secondReview.reviewer',
        select: 'name role',
        model: 'User'
      });

    res.json({
      success: true,
      message: '建议评分已完全重置',
      suggestion: updatedSuggestion
    });

  } catch (error) {
    logger.error('重置建议评分失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误，重置评分失败',
      error: error.message
    });
  }
}; 