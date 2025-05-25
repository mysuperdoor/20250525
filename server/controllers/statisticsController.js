const { Suggestion } = require('../models/Suggestion');
const { User } = require('../models/User');
const mongoose = require('mongoose');

// 获取部门统计数据
exports.getDepartmentStats = async (req, res) => {
    try {
        // 获取查询参数
        const { startDate, endDate } = req.query;
        
        // 构建时间过滤条件
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

        // 聚合查询
        const departmentStats = await Suggestion.aggregate([
            { $match: dateFilter },
            {
                $group: {
                    _id: '$team',
                    totalSubmissions: { $sum: 1 },
                    approvedCount: {
                        $sum: {
                            $cond: [
                                { $in: ['$status', ['已批准', '已通过', '实施中', '已完成']] },
                                1,
                                0
                            ]
                        }
                    },
                    implementedCount: {
                        $sum: {
                            $cond: [
                                { $in: ['$status', ['已完成']] },
                                1,
                                0
                            ]
                        }
                    },
                    totalScore: { $sum: '$score' },
                    userCount: { $addToSet: '$submitter' }
                }
            },
            {
                $project: {
                    _id: 0,
                    team: '$_id',
                    totalSubmissions: 1,
                    approvalRate: {
                        $multiply: [
                            { $cond: [{ $eq: ['$totalSubmissions', 0] }, 0, { $divide: ['$approvedCount', '$totalSubmissions'] }] },
                            100
                        ]
                    },
                    implementationRate: {
                        $multiply: [
                            { $cond: [{ $eq: ['$approvedCount', 0] }, 0, { $divide: ['$implementedCount', '$approvedCount'] }] },
                            100
                        ]
                    },
                    userCount: { $size: '$userCount' },
                    totalScore: 1,
                    perCapitaSubmissions: {
                        $cond: [
                            { $eq: [{ $size: '$userCount' }, 0] },
                            0,
                            { $divide: ['$totalSubmissions', { $size: '$userCount' }] }
                        ]
                    }
                }
            },
            { $sort: { team: 1 } }
        ]);

        res.json({
            success: true,
            data: departmentStats
        });
    } catch (error) {
        console.error('获取部门统计数据失败:', error);
        res.status(500).json({
            success: false,
            message: '服务器错误'
        });
    }
};

// 获取班组内部统计数据（按员工统计）
exports.getTeamInternalStats = async (req, res) => {
    try {
        // 获取查询参数
        const { team, startDate, endDate } = req.query;
        
        if (!team) {
            return res.status(400).json({
                success: false,
                message: '缺少班组参数'
            });
        }
        
        // 构建时间过滤条件
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
        
        // 构建班组过滤条件
        const teamFilter = { team };
        
        // 合并过滤条件
        const filter = { ...dateFilter, ...teamFilter };

        // 1. 获取该班组的所有用户
        const teamUsers = await User.find({ team, active: true }).select('_id name');
        
        if (!teamUsers || teamUsers.length === 0) {
            return res.json({
                success: true,
                data: [],
                message: '该班组没有活跃用户'
            });
        }
        
        // 创建用户ID到姓名的映射
        const userIdToName = {};
        teamUsers.forEach(user => {
            userIdToName[user._id.toString()] = user.name;
        });
        
        // 2. 聚合查询每个用户的建议统计
        const userStats = await Suggestion.aggregate([
            { $match: filter },
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
                    },
                    totalSubmissions: { $sum: 1 },
                    approvedCount: {
                        $sum: {
                            $cond: [
                                { $in: ['$status', ['已批准', '已通过', '实施中', '已完成']] },
                                1,
                                0
                            ]
                        }
                    },
                    implementedCount: {
                        $sum: {
                            $cond: [
                                { $in: ['$status', ['已完成']] },
                                1,
                                0
                            ]
                        }
                    },
                    totalScore: { $sum: { $ifNull: ['$score', 0] } }
                }
            },
            {
                $project: {
                    _id: 0,
                    userId: '$_id.submitterId',
                    name: '$_id.submitterName',
                    totalSubmissions: 1,
                    approvalRate: {
                        $multiply: [
                            { $cond: [{ $eq: ['$totalSubmissions', 0] }, 0, { $divide: ['$approvedCount', '$totalSubmissions'] }] },
                            100
                        ]
                    },
                    implementationRate: {
                        $multiply: [
                            { $cond: [{ $eq: ['$approvedCount', 0] }, 0, { $divide: ['$implementedCount', '$approvedCount'] }] },
                            100
                        ]
                    },
                    totalScore: 1
                }
            },
            { $sort: { totalSubmissions: -1 } }
        ]);
        
        // 3. 添加没有提交过建议的用户
        const userIdsWithStats = userStats.map(stat => stat.userId.toString());
        const usersWithoutStats = teamUsers.filter(user => !userIdsWithStats.includes(user._id.toString()));
        
        // 将这些用户添加到结果中
        const additionalUserStats = usersWithoutStats.map(user => ({
            userId: user._id,
            name: user.name,
            totalSubmissions: 0,
            approvalRate: 0,
            implementationRate: 0,
            totalScore: 0
        }));
        
        // 合并结果
        const allUserStats = [...userStats, ...additionalUserStats];

        res.json({
            success: true,
            data: allUserStats
        });
    } catch (error) {
        console.error('获取班组内部统计数据失败:', error);
        res.status(500).json({
            success: false,
            message: '服务器错误'
        });
    }
};

// 获取部门趋势数据
exports.getDepartmentTrends = async (req, res) => {
    try {
        // 获取查询参数
        const { team, period = 'month' } = req.query;
        
        // 验证参数
        if (!team) {
            return res.status(400).json({
                success: false,
                message: '缺少班组参数'
            });
        }
        
        // 根据时间周期设置时间格式
        let timeFormat;
        let timeSpan;
        
        switch (period) {
            case 'day':
                timeFormat = '%Y-%m-%d';
                timeSpan = { $dayOfYear: '$createdAt' };
                break;
            case 'week':
                timeFormat = '%Y-W%U';
                timeSpan = { $week: '$createdAt' };
                break;
            case 'month':
                timeFormat = '%Y-%m';
                timeSpan = { $month: '$createdAt' };
                break;
            case 'quarter':
                timeFormat = '%Y-Q%q';
                timeSpan = { 
                    $concat: [
                        { $toString: { $year: '$createdAt' } },
                        '-Q',
                        { $toString: { $ceil: { $divide: [{ $month: '$createdAt' }, 3] } } }
                    ]
                };
                break;
            case 'year':
                timeFormat = '%Y';
                timeSpan = { $year: '$createdAt' };
                break;
            default:
                timeFormat = '%Y-%m';
                timeSpan = { $month: '$createdAt' };
        }
        
        // 设置过去12个月的日期范围
        const endDate = new Date();
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 11);
        
        // 聚合查询
        const trends = await Suggestion.aggregate([
            {
                $match: {
                    team,
                    createdAt: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: {
                        timeSpan: timeSpan,
                        formattedDate: { $dateToString: { format: timeFormat, date: '$createdAt' } }
                    },
                    count: { $sum: 1 },
                    approvedCount: {
                        $sum: {
                            $cond: [
                                { $in: ['$status', ['已批准', '已通过', '实施中', '已完成']] },
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
                    timePeriod: '$_id.formattedDate',
                    totalCount: '$count',
                    approvedCount: 1,
                    approvalRate: {
                        $multiply: [
                            { $cond: [{ $eq: ['$count', 0] }, 0, { $divide: ['$approvedCount', '$count'] }] },
                            100
                        ]
                    }
                }
            },
            { $sort: { timePeriod: 1 } }
        ]);

        res.json({
            success: true,
            data: trends
        });
    } catch (error) {
        console.error('获取部门趋势数据失败:', error);
        res.status(500).json({
            success: false,
            message: '服务器错误'
        });
    }
}; 