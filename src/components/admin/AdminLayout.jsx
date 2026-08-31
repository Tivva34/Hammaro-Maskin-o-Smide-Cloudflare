import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from '../ProtectedRoute';

import LoginPage       from '../../pages/admin/LoginPage';
import UpdatePasswordPage from '../../pages/admin/UpdatePasswordPage';
import AdminDashboard  from '../../pages/admin/AdminDashboard';
import MachineFormPage from '../../pages/admin/MachineFormPage';
import InventoryFormPage from '../../pages/admin/InventoryFormPage';
import ProfilePage from '../../pages/admin/ProfilePage';
import GlobalAdminNotifications from './GlobalAdminNotifications';

function AdminLayout() {
  return (
    <>
      <GlobalAdminNotifications />
      <Routes>
        <Route path="login" element={<LoginPage />} />
        <Route path="update-password" element={<UpdatePasswordPage />} />
        <Route
          path=""
          element={
            <ProtectedRoute>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="maskiner/ny"
          element={
            <ProtectedRoute>
              <MachineFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="maskiner/:id"
          element={
            <ProtectedRoute>
              <MachineFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="losore/ny"
          element={
            <ProtectedRoute>
              <InventoryFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="losore/:id"
          element={
            <ProtectedRoute>
              <InventoryFormPage />
            </ProtectedRoute>
          }
        />
        {/* Catch-all inside admin → redirect to /admin */}
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </>
  );
}

export default AdminLayout;
