import api from './api';
import axios from 'axios';

// 服务器API基础URL
const API_URL = 'http://localhost:5000/api';

export const userService = {
  // 获取用户列表
  getUsers: async (params = { page: 1, limit: 10 }) => {
    try {
      console.log('获取用户列表参数:', params);
      
      // 将 params 对象转换为查询字符串
      const queryString = new URLSearchParams(params).toString();
      console.log('userService.getUsers - queryString:', queryString);
      
      const response = await api.get(`/users?${queryString}`);
      console.log('获取用户列表原始响应:', response);
      
      // 分析响应结构并适配成统一的格式：{ data: [...], pagination: {...} }
      let result = {
        data: [],
        pagination: {
          current: parseInt(params.page) || 1,
          pageSize: parseInt(params.limit) || 10,
          total: 0
        }
      };
      
      // 1. 检查后端直接返回的 users 和 pagination 格式
      if (response && response.data && Array.isArray(response.data.users)) {
        console.log('格式1: response.data = { users: [...], pagination: {...} }');
        result.data = response.data.users;
        if (response.data.pagination) {
          result.pagination = {
            current: parseInt(response.data.pagination.current) || result.pagination.current,
            pageSize: parseInt(response.data.pagination.pageSize) || result.pagination.pageSize,
            total: parseInt(response.data.pagination.total) || result.pagination.total
          };
        }
      } 
      // 2. 检查直接返回数组的格式
      else if (response && Array.isArray(response.data)) {
        console.log('格式2: response.data = [...]');
        result.data = response.data;
        result.pagination.total = response.data.length; // 直接返回数组时，总数就是数组长度
      }
      // 3. 检查嵌套数据的格式
      else if (response && response.data && response.data.data && Array.isArray(response.data.data)) {
        console.log('格式3: response.data.data = [...]');
        result.data = response.data.data;
        if (response.data.pagination) {
          result.pagination = {
            current: parseInt(response.data.pagination.current) || result.pagination.current,
            pageSize: parseInt(response.data.pagination.pageSize) || result.pagination.pageSize,
            total: parseInt(response.data.pagination.total) || result.pagination.total
          };
        } else {
          result.pagination.total = response.data.data.length; // 没有分页信息时，总数为数组长度
        }
      } 
      // 4. 处理其他可能的格式
      else {
        console.warn('userService.getUsers - 未知响应结构:', response);
        // 尝试从响应中提取有用信息
        if (response && typeof response === 'object') {
          // 尝试找到第一个数组类型的属性作为数据
          const arrayProp = Object.entries(response).find(([_, value]) => Array.isArray(value));
          if (arrayProp) {
            console.log(`找到可能的数据数组: ${arrayProp[0]}`);
            result.data = arrayProp[1];
            result.pagination.total = arrayProp[1].length;
          }
          
          // 尝试找到分页信息
          const paginationProp = Object.entries(response).find(([key, value]) => 
            typeof value === 'object' && 
            value !== null && 
            (key === 'pagination' || key === 'page' || key === 'paging')
          );
          
          if (paginationProp) {
            console.log(`找到可能的分页信息: ${paginationProp[0]}`);
            const paginationData = paginationProp[1];
            result.pagination = {
              current: parseInt(paginationData.current || paginationData.page || paginationData.currentPage || 1),
              pageSize: parseInt(paginationData.pageSize || paginationData.limit || paginationData.size || 10),
              total: parseInt(paginationData.total || paginationData.totalCount || paginationData.totalItems || 0)
            };
          }
        }
      }
      
      console.log('userService.getUsers - 处理后的结果:', result);
      return result;
    } catch (error) {
      console.error('获取用户列表失败:', error);
      throw error;
    }
  },

  // 创建新用户
  createUser: async (userData) => {
    try {
      console.log('发送创建用户请求:', userData);
      const response = await api.post('/users', userData);
      console.log('创建用户响应:', response.data);
      return response.data;
    } catch (error) {
      console.error('创建用户失败:', error);
      if (error.response && error.response.data) {
        throw error.response.data;
      }
      throw error;
    }
  },

  // 更新用户信息
  updateUser: async (id, userData) => {
    try {
      console.log('发送更新用户请求 - 原始数据:', userData);
      
      // 获取后端枚举常量
      const ROLES = {
        'DEPARTMENT_MANAGER': '部门经理',
        'SHIFT_SUPERVISOR': '值班主任',
        'SAFETY_ADMIN': '安全科管理人员',
        'OPERATION_ADMIN': '运行科管理人员',
        'TEAM_MEMBER': '班组人员'
      };
      
      const TEAMS = {
        'TEAM_A': '甲班',
        'TEAM_B': '乙班',
        'TEAM_C': '丙班',
        'TEAM_D': '丁班',
        'NONE': '无班组'
      };
      
      // 转换角色和班组为中文值
      const processedData = {
        ...userData,
        role: ROLES[userData.role] || userData.role,
        team: TEAMS[userData.team] || userData.team,
        department: userData.department === 'PRODUCTION' ? '生产调度部' : userData.department
      };
      
      console.log('发送更新用户请求 - 处理后数据:', processedData);
      
      const response = await api.put(`/users/${id}`, processedData);
      console.log('更新用户响应:', response.data);
      return response.data;
    } catch (error) {
      console.error('更新用户失败:', error);
      console.error('错误详情:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      });
      throw error;
    }
  },

  // 删除用户
  deleteUser: async (id) => {
    try {
      console.log('发送删除用户请求:', { id });
      const response = await api.delete(`/users/${id}`);
      console.log('删除用户响应:', response.data);
      return response.data;
    } catch (error) {
      console.error('删除用户失败:', error);
      if (error.response && error.response.data) {
        throw error.response.data;
      }
      throw error;
    }
  },

  // 重置用户密码
  resetPassword: async (id, newPassword) => {
    try {
      console.log('发送重置密码请求:', { id, passwordLength: newPassword?.length });
      const response = await api.put(`/users/${id}/password`, { 
        password: newPassword 
      });
      console.log('重置密码响应:', response.data);
      return response.data;
    } catch (error) {
      console.error('重置密码失败:', error);
      if (error.response && error.response.data) {
        throw error.response.data;
      }
      throw error;
    }
  },

  // 修改当前用户密码
  changePassword: async (currentPassword, newPassword) => {
    try {
      const response = await api.put('/users/change-password', { 
        currentPassword, 
        newPassword 
      });
      return response.data;
    } catch (error) {
      console.error('修改密码失败:', error);
      if (error.response && error.response.data) {
        throw error.response.data;
      }
      throw error;
    }
  }
}; 