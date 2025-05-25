const express = require('express');
const router = express.Router();
const statisticsController = require('../controllers/statisticsController');
const auth = require('../middleware/auth');
const { checkOnlyShiftSupervisorRole, checkTeamAccess } = require('../middleware/admin');

// 获取部门统计数据
router.get('/department-stats', auth, statisticsController.getDepartmentStats);

// 获取部门趋势数据
router.get('/department-trends', auth, statisticsController.getDepartmentTrends);

// 获取班组内部统计数据 - 只允许值班主任访问自己班组的数据
router.get('/team-internal-stats', auth, checkOnlyShiftSupervisorRole, (req, res) => {
  const team = req.query.team;
  
  // 只允许值班主任查看自己班组的数据
  if (req.user.team !== team) {
    return res.status(403).json({ 
      success: false,
      message: '没有权限访问该班组数据'
    });
  }
  
  statisticsController.getTeamInternalStats(req, res);
});

// 添加一个健康检查端点，用于调试
router.get('/status', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Statistics API is working',
    time: new Date().toISOString()
  });
});

module.exports = router; 