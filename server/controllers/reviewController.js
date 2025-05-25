const { Review, REVIEW_LEVELS, REVIEW_RESULTS } = require('../models/Review');
const { Suggestion } = require('../models/Suggestion');
const mongoose = require('mongoose');

/**
 * 创建审核记录
 * @param {Object} reviewData 审核数据
 * @param {String} reviewData.suggestion 建议ID
 * @param {String} reviewData.reviewer 审核人ID
 * @param {String} reviewData.level 审核级别 FIRST_LEVEL/SECOND_LEVEL
 * @param {String} reviewData.result 审核结果 APPROVED/REJECTED
 * @param {String} reviewData.comments 审核意见
 * @returns {Promise<Object>} 创建的审核记录
 */
exports.createReview = async (reviewData) => {
  try {
    const { suggestion, reviewer, level, result, comments } = reviewData;
    
    // 验证建议是否存在
    const suggestionExists = await Suggestion.findById(suggestion);
    if (!suggestionExists) {
      throw new Error('建议不存在');
    }
    
    // 创建审核记录
    const review = new Review({
      suggestion,
      reviewer,
      level,
      result,
      comments,
      reviewedAt: Date.now()
    });
    
    await review.save();
    
    return review;
  } catch (error) {
    console.error('创建审核记录失败:', error);
    throw error;
  }
};

/**
 * 获取建议的审核记录
 * @param {String} suggestionId 建议ID
 * @returns {Promise<Object>} 审核记录
 */
exports.getReviewsBySuggestion = async (req, res) => {
  try {
    const { suggestionId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // 验证建议是否存在
    const suggestionExists = await Suggestion.findById(suggestionId);
    if (!suggestionExists) {
      return res.status(404).json({ message: '建议不存在' });
    }

    // 获取审核记录总数
    const total = await Review.countDocuments({ suggestion: suggestionId });

    // 获取审核记录
    const reviews = await Review.find({ suggestion: suggestionId })
      .populate('reviewer', 'name username role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      reviews,
      pagination: {
        current: page,
        pageSize: limit,
        total
      }
    });
  } catch (error) {
    console.error('获取审核记录失败:', error);
    res.status(500).json({ message: '服务器错误', error: error.message });
  }
};

/**
 * 获取审核人的审核记录
 * @param {String} reviewerId 审核人ID
 * @returns {Promise<Object>} 审核记录列表
 */
exports.getReviewsByReviewer = async (req, res) => {
  try {
    const reviewerId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // 获取审核记录总数
    const total = await Review.countDocuments({ reviewer: reviewerId });

    // 获取审核记录
    const reviews = await Review.find({ reviewer: reviewerId })
      .populate({
        path: 'suggestion',
        select: 'title type status submitter',
        populate: {
          path: 'submitter',
          select: 'name username team'
        }
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      reviews,
      pagination: {
        current: page,
        pageSize: limit,
        total
      }
    });
  } catch (error) {
    console.error('获取审核记录失败:', error);
    res.status(500).json({ message: '服务器错误', error: error.message });
  }
};

/**
 * 获取审核统计数据
 * @returns {Promise<Object>} 统计数据
 */
exports.getReviewStats = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // 获取审核人的审核记录总数
    const totalReviews = await Review.countDocuments({ reviewer: userId });
    
    // 按审核结果统计
    const resultStats = await Review.aggregate([
      { $match: { reviewer: mongoose.Types.ObjectId(userId) } },
      { 
        $group: {
          _id: '$result',
          count: { $sum: 1 }
        }
      }
    ]);
    
    // 按审核级别统计
    const levelStats = await Review.aggregate([
      { $match: { reviewer: mongoose.Types.ObjectId(userId) } },
      { 
        $group: {
          _id: '$level',
          count: { $sum: 1 }
        }
      }
    ]);
    
    // 统计审核时效
    const timeEfficiency = await Review.aggregate([
      { $match: { reviewer: mongoose.Types.ObjectId(userId) } },
      {
        $project: {
          reviewTime: {
            $subtract: ['$reviewedAt', '$createdAt']
          }
        }
      },
      {
        $group: {
          _id: null,
          averageTime: { $avg: '$reviewTime' },
          maxTime: { $max: '$reviewTime' },
          minTime: { $min: '$reviewTime' }
        }
      }
    ]);
    
    // 格式化结果
    const formattedResultStats = resultStats.map(item => ({
      result: REVIEW_RESULTS[item._id],
      resultKey: item._id,
      count: item.count
    }));
    
    const formattedLevelStats = levelStats.map(item => ({
      level: REVIEW_LEVELS[item._id],
      levelKey: item._id,
      count: item.count
    }));
    
    const averageTimeInHours = timeEfficiency.length > 0 
      ? (timeEfficiency[0].averageTime / (1000 * 60 * 60)).toFixed(2) 
      : 0;
    
    res.json({
      totalReviews,
      resultStats: formattedResultStats,
      levelStats: formattedLevelStats,
      timeEfficiency: {
        averageTimeInHours: parseFloat(averageTimeInHours),
        maxTimeInHours: timeEfficiency.length > 0 
          ? (timeEfficiency[0].maxTime / (1000 * 60 * 60)).toFixed(2)
          : 0,
        minTimeInHours: timeEfficiency.length > 0 
          ? (timeEfficiency[0].minTime / (1000 * 60 * 60)).toFixed(2)
          : 0
      }
    });
  } catch (error) {
    console.error('获取审核统计数据失败:', error);
    res.status(500).json({ message: '服务器错误', error: error.message });
  }
}; 