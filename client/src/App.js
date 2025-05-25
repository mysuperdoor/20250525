import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout/Layout';
import PrivateRoute from './components/PrivateRoute';
import DepartmentManagerRoute from './components/DepartmentManagerRoute';
import ManagerRoute from './components/ManagerRoute';
import ReviewPermissionRoute from './components/ReviewPermissionRoute';
import ShiftSupervisorRoute from './components/ShiftSupervisorRoute';

// Lazy load page components
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const SuggestionList = lazy(() => import('./pages/Suggestions/List'));
const SuggestionDetail = lazy(() => import('./pages/Suggestions/Detail'));
const NewSuggestion = lazy(() => import('./pages/Suggestions/New'));
const ReviewList = lazy(() => import('./pages/Suggestions/Review'));
const ImplementationList = lazy(() => import('./pages/Suggestions/Implementation'));
const UserManagement = lazy(() => import('./pages/Admin/components/UserManagement'));
const ChangePassword = lazy(() => import('./pages/ChangePassword'));
const Reports = lazy(() => import('./pages/Reports'));
const DepartmentPerformance = lazy(() => import('./pages/Reports/DepartmentPerformance'));
const TeamInternalReport = lazy(() => import('./pages/Reports/TeamInternalReport'));

// Simple loader component
const PageLoader = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
    加载中...
  </div>
);

const App = () => {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route path="/" element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }>
            <Route index element={<Navigate to="/dashboard" />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="suggestions/list" element={<SuggestionList />} />
            <Route path="suggestions/new" element={<NewSuggestion />} />
            <Route path="suggestions/:id" element={<SuggestionDetail />} />
            <Route path="change-password" element={<ChangePassword />} />
            
            {/* 审核和实施跟踪路由 */}
            <Route path="suggestions/review" element={
              <ReviewPermissionRoute>
                <ReviewList />
              </ReviewPermissionRoute>
            } />
            <Route path="suggestions/implementation" element={
              <ManagerRoute>
                <ImplementationList />
              </ManagerRoute>
            } />
            
            {/* 管理员路由 */}
            <Route path="users" element={
              <DepartmentManagerRoute>
                <UserManagement />
              </DepartmentManagerRoute>
            } />
            <Route path="reports" element={
              <ManagerRoute>
                <Reports />
              </ManagerRoute>
            } />
            <Route path="reports/department-performance" element={
              <ManagerRoute>
                <DepartmentPerformance />
              </ManagerRoute>
            } />
            {/* 班组内部报表路由 - 需要值班主任或更高权限 */}
            <Route path="reports/team-internal-report" element={
              <ShiftSupervisorRoute>
                <TeamInternalReport />
              </ShiftSupervisorRoute>
            } />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
};

export default App; 