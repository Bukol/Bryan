import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/Login';
import PMDashboard from './components/PMDashboard';
import PICDashboard from './components/PICDashboard';

function AppContent() {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {user?.role === 'PM' ? <PMDashboard /> : <PICDashboard />}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
