const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const { Suggestion, SUGGESTION_TYPES, REVIEW_STATUS, IMPLEMENTATION_STATUS } = require('../models/Suggestion');
const { User, ROLES, TEAMS, DEPARTMENTS } = require('../models/User');

// 检查管理员或经理权限的中间件
const checkAdminOrManagerRole = (req, res, next) => {
  if (req.user.role !== ROLES.SAFETY_ADMIN && 
      req.user.role !== ROLES.OPS_ADMIN && 
      req.user.role !== ROLES.DEPARTMENT_MANAGER) {
    return res.status(403).json({ msg: '没有权限，需要管理人员或部门经理权限' });
  }
  next();
};

// @route   GET api/reports/summary
// @desc    获取建议总体统计数据
// @access  Private (管理人员和部门经理)
router.get('/summary', [auth, checkAdminOrManagerRole], async (req, res) => {
  try {
    // 获取时间范围参数
    const { startDate, endDate } = req.query;
    const dateFilter = {};
    
    if (startDate) {
      dateFilter.createdAt = { $gte: new Date(startDate) };
    }
    
    if (endDate) {
      if (dateFilter.createdAt) {
        dateFilter.createdAt.$lte = new Date(endDate);
      } else {
        dateFilter.createdAt = { $lte: new Date(endDate) };
      }
    }

    // 移除基于角色的类型过滤
    const filter = { ...dateFilter };

    // 获取总建议数
    const totalCount = await Suggestion.countDocuments(filter);

    // 按状态统计
    const statusCounts = await Suggestion.aggregate([
      { $match: filter },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    // 按类型统计
    const typeCounts = await Suggestion.aggregate([
      { $match: filter },
      { $group: { _id: '$type', count: { $sum: 1 } } }
    ]);

    // 按班组统计
    const teamCounts = await Suggestion.aggregate([
      { $match: filter },
      { $group: { _id: '$team', count: { $sum: 1 } } }
    ]);

    // 处理结果
    const formatStatusCounts = {};
    statusCounts.forEach(item => {
      formatStatusCounts[item._id] = item.count;
    });

    const formatTypeCounts = {};
    typeCounts.forEach(item => {
      formatTypeCounts[item._id] = item.count;
    });

    const formatTeamCounts = {};
    teamCounts.forEach(item => {
      formatTeamCounts[item._id] = item.count;
    });

    res.json({
      totalCount,
      statusCounts: formatStatusCounts,
      typeCounts: formatTypeCounts,
      teamCounts: formatTeamCounts
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('服务器错误');
  }
});

// @route   GET api/reports/team-comparison
// @desc    获取班组建议对比数据
// @access  Private (管理人员和部门经理)
router.get('/team-comparison', [auth, checkAdminOrManagerRole], async (req, res) => {
  try {
    // 获取时间范围参数
    const { startDate, endDate } = req.query;
    const dateFilter = {};
    
    if (startDate) {
      dateFilter.createdAt = { $gte: new Date(startDate) };
    }
    
    if (endDate) {
      if (dateFilter.createdAt) {
        dateFilter.createdAt.$lte = new Date(endDate);
      } else {
        dateFilter.createdAt = { $lte: new Date(endDate) };
      }
    }

    // 移除基于角色的类型过滤
    const filter = { ...dateFilter };

    // 按班组和类型统计
    const teamTypeData = await Suggestion.aggregate([
      { $match: filter },
      { $group: { 
        _id: { team: '$team', type: '$type' }, 
        count: { $sum: 1 } 
      }},
      { $sort: { '_id.team': 1, '_id.type': 1 } }
    ]);

    // 按班组和状态统计
    const teamStatusData = await Suggestion.aggregate([
      { $match: filter },
      { $group: { 
        _id: { team: '$team', status: '$status' }, 
        count: { $sum: 1 } 
      }},
      { $sort: { '_id.team': 1, '_id.status': 1 } }
    ]);

    // 格式化结果用于图表显示
    const formattedTeamTypeData = [];
    teamTypeData.forEach(item => {
      formattedTeamTypeData.push({
        team: item._id.team,
        type: item._id.type,
        count: item.count
      });
    });

    const formattedTeamStatusData = [];
    teamStatusData.forEach(item => {
      formattedTeamStatusData.push({
        team: item._id.team,
        status: item._id.status,
        count: item.count
      });
    });

    res.json({
      teamTypeData: formattedTeamTypeData,
      teamStatusData: formattedTeamStatusData
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('服务器错误');
  }
});

// @route   GET api/reports/monthly-trend
// @desc    获取月度趋势数据
// @access  Private (管理人员和部门经理)
router.get('/monthly-trend', [auth, checkAdminOrManagerRole], async (req, res) => {
  try {
    // 获取年份参数，默认为当前年份
    const year = req.query.year ? parseInt(req.query.year) : new Date().getFullYear();
    
    // 设置年份范围
    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31, 23, 59, 59);
    
    // 移除基于角色的类型过滤
    const filter = { 
      createdAt: { $gte: startOfYear, $lte: endOfYear }
    };

    // 按月份统计
    const monthlyData = await Suggestion.aggregate([
      { $match: filter },
      { 
        $project: {
          month: { $month: '$createdAt' },
          type: 1
        }
      },
      { 
        $group: {
          _id: { month: '$month', type: '$type' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.month': 1, '_id.type': 1 } }
    ]);

    // 按月份和班组统计
    const monthlyTeamData = await Suggestion.aggregate([
      { $match: filter },
      { 
        $project: {
          month: { $month: '$createdAt' },
          team: 1
        }
      },
      { 
        $group: {
          _id: { month: '$month', team: '$team' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.month': 1, '_id.team': 1 } }
    ]);

    // 格式化结果，填充所有月份
    const months = Array.from({ length: 12 }, (_, i) => i + 1);
    const formattedMonthlyData = [];
    const formattedMonthlyTeamData = [];

    // 为每个类型准备数据
    Object.values(SUGGESTION_TYPES).forEach(type => {
      const typeData = {
        type,
        data: []
      };

      months.forEach(month => {
        const found = monthlyData.find(item => 
          item._id.month === month && item._id.type === type
        );
        
        typeData.data.push({
          month,
          count: found ? found.count : 0
        });
      });

      formattedMonthlyData.push(typeData);
    });

    // 为每个班组准备数据
    Object.values(TEAMS).forEach(team => {
      // 跳过"无班组"
      if (team === TEAMS.NONE) return;
      
      const teamData = {
        team,
        data: []
      };

      months.forEach(month => {
        const found = monthlyTeamData.find(item => 
          item._id.month === month && item._id.team === team
        );
        
        teamData.data.push({
          month,
          count: found ? found.count : 0
        });
      });

      formattedMonthlyTeamData.push(teamData);
    });

    res.json({
      year,
      monthlyTypeData: formattedMonthlyData,
      monthlyTeamData: formattedMonthlyTeamData
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('服务器错误');
  }
});

// @route   GET api/reports/implementation-status
// @desc    获取实施状态统计数据
// @access  Private (管理人员和部门经理)
router.get('/implementation-status', [auth, checkAdminOrManagerRole], async (req, res) => {
  try {
    // 获取时间范围参数
    const { startDate, endDate } = req.query;
    const dateFilter = {};
    
    if (startDate) {
      dateFilter.createdAt = { $gte: new Date(startDate) };
    }
    
    if (endDate) {
      if (dateFilter.createdAt) {
        dateFilter.createdAt.$lte = new Date(endDate);
      } else {
        dateFilter.createdAt = { $lte: new Date(endDate) };
      }
    }

    // 移除基于角色的类型过滤
    // 只查询已通过二级审核的建议
    const statusFilter = {
      status: { 
        $in: [
          REVIEW_STATUS.REJECTED, 
          IMPLEMENTATION_STATUS.IMPLEMENTING, 
          IMPLEMENTATION_STATUS.COMPLETED
        ]
      }
    };

    // 合并过滤条件
    const filter = { ...dateFilter, ...statusFilter };

    // 按类型和状态统计
    const typeStatusData = await Suggestion.aggregate([
      { $match: filter },
      { $group: { 
        _id: { type: '$type', status: '$status' }, 
        count: { $sum: 1 } 
      }},
      { $sort: { '_id.type': 1, '_id.status': 1 } }
    ]);

    // 按班组和状态统计
    const teamStatusData = await Suggestion.aggregate([
      { $match: filter },
      { $group: { 
        _id: { team: '$team', status: '$status' }, 
        count: { $sum: 1 } 
      }},
      { $sort: { '_id.team': 1, '_id.status': 1 } }
    ]);

    // 格式化结果用于图表显示
    const formattedTypeStatusData = [];
    typeStatusData.forEach(item => {
      formattedTypeStatusData.push({
        type: item._id.type,
        status: item._id.status,
        count: item.count
      });
    });

    const formattedTeamStatusData = [];
    teamStatusData.forEach(item => {
      formattedTeamStatusData.push({
        team: item._id.team,
        status: item._id.status,
        count: item.count
      });
    });

    res.json({
      typeStatusData: formattedTypeStatusData,
      teamStatusData: formattedTeamStatusData
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('服务器错误');
  }
});

// @route   GET api/reports/statistics
// @desc    获取建议统计数据
// @access  Private (管理员或经理权限)
router.get('/statistics', auth, checkAdminOrManagerRole, async (req, res) => {
  try {
    // 获取查询参数
    const { startDate, endDate, timeUnit = 'month' } = req.query;
    
    // 构建基础查询条件
    let queryConditions = {};
    
    // 按日期范围筛选
    if (startDate && endDate) {
      queryConditions.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    
    // 移除基于部门的类型过滤
    
    // 1. 按时间分布统计
    let timeDistribution = [];
    let timeGrouping = {};
    
    if (timeUnit === 'year') {
      timeGrouping = { 
        $dateToString: { format: "%Y", date: "$createdAt" } 
      };
    } else if (timeUnit === 'quarter') {
      timeGrouping = {
        $concat: [
          { $dateToString: { format: "%Y", date: "$createdAt" } },
          "-Q",
          { $toString: { $ceil: { $divide: [{ $month: "$createdAt" }, 3] } } }
        ]
      };
    } else if (timeUnit === 'month') {
      timeGrouping = { 
        $dateToString: { format: "%Y-%m", date: "$createdAt" } 
      };
    } else if (timeUnit === 'week') {
      timeGrouping = {
        $concat: [
          { $dateToString: { format: "%Y-W", date: "$createdAt" } },
          { $toString: { $week: "$createdAt" } }
        ]
      };
    }
    
    const timeResults = await Suggestion.aggregate([
      { $match: queryConditions },
      {
        $group: {
          _id: { timePeriod: timeGrouping },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.timePeriod': 1 } },
      {
        $project: {
          _id: 0,
          timePeriod: '$_id.timePeriod',
          count: 1
        }
      }
    ]);
    
    timeDistribution = timeResults;
    
    // 2. 按部门分布统计
    const departmentResults = await Suggestion.aggregate([
      { $match: queryConditions },
      {
        $lookup: {
          from: 'users',
          localField: 'submitter',
          foreignField: '_id',
          as: 'submitterInfo'
        }
      },
      { $unwind: '$submitterInfo' },
      {
        $group: {
          _id: '$submitterInfo.department',
          value: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          name: '$_id',
          value: 1
        }
      }
    ]);
    
    // 3. 按班组分布统计
    const teamResults = await Suggestion.aggregate([
      { $match: queryConditions },
      {
        $group: {
          _id: '$team',
          value: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          name: '$_id',
          value: 1
        }
      }
    ]);
    
    // 4. 按状态分布统计
    const statusResults = await Suggestion.aggregate([
      { $match: queryConditions },
      {
        $group: {
          _id: '$status',
          value: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          name: { $literal: "$_id" },
          value: 1
        }
      }
    ]);
    
    // 将状态代码映射为可读名称
    const statusDistribution = statusResults.map(item => ({
      name: IMPLEMENTATION_STATUS[item.name] || item.name,
      value: item.value
    }));
    
    // 5. 按类型分布统计
    const typeResults = await Suggestion.aggregate([
      { $match: queryConditions },
      {
        $group: {
          _id: '$type',
          value: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          name: { $literal: "$_id" },
          value: 1
        }
      }
    ]);
    
    // 将类型代码映射为可读名称
    const typeDistribution = typeResults.map(item => ({
      name: SUGGESTION_TYPES[item.name] || item.name,
      value: item.value
    }));
    
    // 6. 获取贡献排行榜
    const contributorsResults = await Suggestion.aggregate([
      { $match: queryConditions },
      {
        $lookup: {
          from: 'users',
          localField: 'submitter',
          foreignField: '_id',
          as: 'submitterInfo'
        }
      },
      { $unwind: '$submitterInfo' },
      {
        $group: {
          _id: {
            submitterId: '$submitter',
            submitterName: '$submitterInfo.name',
            team: '$team'
          },
          totalCount: { $sum: 1 },
          adoptedCount: {
            $sum: {
              $cond: [
                { $in: ['$status', ['IMPLEMENTING', 'COMPLETED']] },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          id: '$_id.submitterId',
          name: '$_id.submitterName',
          team: '$_id.team',
          count: '$totalCount',
          adoptionRate: {
            $multiply: [
              { $cond: [{ $eq: ['$totalCount', 0] }, 0, { $divide: ['$adoptedCount', '$totalCount'] }] },
              100
            ]
          }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);
    
    // 返回完整的统计数据
    res.json({
      success: true,
      timeDistribution,
      departmentDistribution: departmentResults,
      teamDistribution: teamResults,
      statusDistribution,
      typeDistribution,
      topContributors: contributorsResults
    });
    
  } catch (error) {
    console.error('获取统计数据失败:', error);
    res.status(500).json({ msg: '服务器错误' });
  }
});

// @route   GET api/reports/dashboard
// @desc    获取仪表盘概览数据
// @access  Private
router.get('/dashboard', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    
    let queryConditions = {};
    
    if (user.role === ROLES.TEAM_MEMBER) {
      queryConditions.submitter = userId;
    } else if (user.role === ROLES.SHIFT_SUPERVISOR) {
      queryConditions.team = user.team;
    } else if (user.role === ROLES.SAFETY_ADMIN) { 
      queryConditions.type = 'SAFETY';
    } else if (user.role === ROLES.OPERATION_ADMIN) {
      queryConditions.type = { $ne: 'SAFETY' };
    }
    
    console.log(`[DEBUG] Dashboard - User role: ${user.role}, Query conditions for aggregation: ${JSON.stringify(queryConditions)}`);
    
    const statusCountsAggregation = await Suggestion.aggregate([
      { $match: queryConditions },
      {
        $project: {
          _id: 0,
          currentDisplayStatus: {
            $switch: {
              branches: [
                { case: { $eq: ['$implementationStatus', 'COMPLETED'] }, then: 'COMPLETED' },
                { case: { $eq: ['$implementationStatus', 'CANCELLED'] }, then: 'CANCELLED_IMPL' },
                { case: { $eq: ['$implementationStatus', 'IN_PROGRESS'] }, then: 'IMPLEMENTING' },
                { case: { $eq: ['$implementationStatus', 'DELAYED'] }, then: 'IMPLEMENTING' },
                { case: { $eq: ['$implementationStatus', 'CONTACTING'] }, then: 'IMPLEMENTING' },
                
                { case: { $eq: ['$reviewStatus', 'REJECTED'] }, then: 'REJECTED' },
                { case: { $eq: ['$reviewStatus', 'WITHDRAWN'] }, then: 'WITHDRAWN' },
                { case: { $eq: ['$reviewStatus', 'PENDING_SECOND_REVIEW'] }, then: 'PENDING_SECOND_REVIEW' },
                { case: { $eq: ['$reviewStatus', 'PENDING_FIRST_REVIEW'] }, then: 'PENDING_FIRST_REVIEW' },
                
                {
                  case: {
                    $and: [
                      { $eq: ['$reviewStatus', 'APPROVED'] },
                      { $or: [
                          { $eq: ['$implementationStatus', 'NOT_IMPLEMENTED'] },
                          { $eq: ['$implementationStatus', 'NOT_STARTED'] },
                          { $eq: ['$implementationStatus', null] },
                          { $eq: ['$implementationStatus', ''] }  
                        ]
                      }
                    ]
                  },
                  then: 'NOT_IMPLEMENTED'
                }
              ],
              default: 'UNKNOWN'
            }
          }
        }
      },
      {
        $group: {
          _id: '$currentDisplayStatus',
          count: { $sum: 1 }
        }
      }
    ]);
    
    const statusCountMap = {};
    let unknownCount = 0;
    statusCountsAggregation.forEach(item => {
      if (item._id) {
        if (item._id === 'UNKNOWN') {
          unknownCount += item.count;
        } else {
          statusCountMap[item._id] = item.count;
        }
      }
    });
    console.log(`[DEBUG] Dashboard - Status Count Map: ${JSON.stringify(statusCountMap)}`);
    console.log(`[DEBUG] Dashboard - Number of UNKNOWN status suggestions: ${unknownCount}`);
    
    const recentSuggestions = await Suggestion.find(queryConditions)
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('submitter', 'name team')
      .populate('firstReview.reviewer', 'name')
      .populate('secondReview.reviewer', 'name');
      
    let pendingReviewFilter = {};
    
    if (user.role === ROLES.TEAM_MEMBER) { 
      pendingReviewFilter = { _id: new mongoose.Types.ObjectId() }; 
    } else if (user.role === ROLES.SHIFT_SUPERVISOR) { 
      const teamCondition = { team: user.team }; 
      const pendingReviewStatuses = ['PENDING_FIRST_REVIEW'];
      pendingReviewFilter = {
        $and: [
          teamCondition,
          { reviewStatus: { $in: pendingReviewStatuses } } 
        ]
      };
    } else if (user.role === ROLES.SAFETY_ADMIN) { 
      const pendingReviewStatuses = ['PENDING_SECOND_REVIEW'];
      pendingReviewFilter = {
        $and: [
          { type: 'SAFETY' },
          { reviewStatus: { $in: pendingReviewStatuses } } 
        ]
      };
    } else if (user.role === ROLES.OPERATION_ADMIN) {
      const pendingReviewStatuses = ['PENDING_SECOND_REVIEW'];
      pendingReviewFilter = {
        $and: [
          { type: { $ne: 'SAFETY' } },
          { reviewStatus: { $in: pendingReviewStatuses } } 
        ]
      };
    } else { 
      const pendingReviewStatuses = ['PENDING_FIRST_REVIEW', 'PENDING_SECOND_REVIEW'];
      pendingReviewFilter = {
        reviewStatus: { $in: pendingReviewStatuses } 
      };
    }
    
    const pendingReviewCount = await Suggestion.countDocuments(pendingReviewFilter);
    
    const dashboardData = {
      suggestionCounts: {
        total: Object.values(statusCountMap).reduce((acc, count) => acc + count, 0),
        pending: statusCountMap['PENDING_FIRST_REVIEW'] || 0,
        underReview: statusCountMap['PENDING_SECOND_REVIEW'] || 0,
        implementing: statusCountMap['IMPLEMENTING'] || 0,
        completed: statusCountMap['COMPLETED'] || 0,
        rejected: (statusCountMap['REJECTED'] || 0) + (statusCountMap['CANCELLED_IMPL'] || 0), 
        notImplemented: statusCountMap['NOT_IMPLEMENTED'] || 0,
        withdrawn: statusCountMap['WITHDRAWN'] || 0
      },
      recentSuggestions,
      pendingReviewCount
    };
    
    res.json(dashboardData);
    
  } catch (error) {
    console.error('获取仪表盘数据失败:', error);
    res.status(500).json({ msg: '服务器错误', error: error.message });
  }
});

module.exports = router; 