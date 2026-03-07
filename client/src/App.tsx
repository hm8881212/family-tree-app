import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import DashboardPage from './pages/DashboardPage';
import NewFamilyPage from './pages/NewFamilyPage';
import FamilyPage from './pages/FamilyPage';
import FamilyAdminPage from './pages/FamilyAdminPage';
import SuperAdminPage from './pages/SuperAdminPage';
import PersonPage from './pages/PersonPage';
import BootstrapPage from './pages/BootstrapPage';
import ProtectedRoute from './components/ProtectedRoute';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/setup" element={<BootstrapPage />} />
          <Route path="/verify-email/:token" element={<VerifyEmailPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password/:token" element={<ResetPasswordPage />} />

          {/* Protected routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/families/new" element={<NewFamilyPage />} />
            <Route path="/families/:id" element={<FamilyPage />} />
            <Route path="/families/:id/admin" element={<FamilyAdminPage />} />
            <Route path="/superadmin" element={<SuperAdminPage />} />
            <Route path="/families/:familyId/persons/:personId" element={<PersonPage />} />
          </Route>

          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
