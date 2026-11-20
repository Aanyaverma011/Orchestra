import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { LiveProvider } from './context/LiveContext';
import Shell from './components/Shell';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Overview from './pages/Overview';
import Jobs from './pages/Jobs';
import CreateJob from './pages/CreateJob';
import Schedules from './pages/Schedules';
import DeadLetter from './pages/DeadLetter';
import Workers from './pages/Workers';
import Settings from './pages/Settings';
import Info, { INFO_PAGES } from './pages/Info';

function Protected({ children, admin = false }) {
  const { user, loading, isAdmin } = useAuth();
  if (loading) return <div style={{ padding: 40 }} className="muted">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (admin && !isAdmin) return <Navigate to="/app" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      {INFO_PAGES.map((p) => <Route key={p} path={`/${p}`} element={<Info page={p} />} />)}
      <Route
        path="/app"
        element={
          <Protected>
            <LiveProvider>
              <Shell />
            </LiveProvider>
          </Protected>
        }
      >
        <Route index element={<Overview />} />
        <Route path="jobs" element={<Jobs />} />
        <Route path="jobs/new" element={<CreateJob />} />
        <Route path="schedules" element={<Schedules />} />
        <Route path="dead-letter" element={<Protected admin><DeadLetter /></Protected>} />
        <Route path="workers" element={<Protected admin><Workers /></Protected>} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
