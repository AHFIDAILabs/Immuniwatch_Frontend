import { useParams, MemoryRouter, Routes, Route, Navigate } from 'react-router-dom';
import { setViewerToken } from '../api/client';
import { ViewerAuthProvider } from '../context/AuthContext';
import ViewerModeContext from '../context/ViewerModeContext';
import { Layout } from '../components/Layout';

import Dashboard from './Dashboard';
import Posts from './Posts';
import HITLQueue from './HITLQueue';
import Alerts from './Alerts';
import ModelHealth from './ModelHealth';
import KnowledgeBase from './KnowledgeBase';
import Users from './Users';
import AuditLog from './AuditLog';
import TrendAnalysis from './TrendAnalysis';
import ResponseDispatch from './ResponseDispatch';
import IngestionPipeline from './IngestionPipeline';
import Settings from './Settings';
import GeoSurge from './GeoSurge';

const VIEW_TOKEN_PARAM_REGEX = /^[0-9a-f]{64}$/;

export default function ViewerPage() {
  const { token } = useParams<{ token: string }>();

  const isValid = !!token && VIEW_TOKEN_PARAM_REGEX.test(token);

  // Set the token synchronously in the render phase so every API call from
  // child components (Layout, page queries) already carries X-View-Token on
  // the very first request — no useEffect delay.
  if (isValid) setViewerToken(token!);

  if (!isValid) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f4f4' }}>
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🔒</div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f2626', marginBottom: '0.5rem' }}>Invalid or expired link</h1>
          <p style={{ color: '#4a6060', fontSize: '0.875rem' }}>This view-only link is not recognised.</p>
        </div>
      </div>
    );
  }

  // Render the full dashboard inside MemoryRouter so navigation stays
  // internal (browser URL stays at /view/:token) and all NavLinks work.
  return (
    <ViewerModeContext.Provider value={true}>
      <ViewerAuthProvider>
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/dashboard"     element={<Dashboard />} />
              <Route path="/posts"         element={<Posts />} />
              <Route path="/hitl"          element={<HITLQueue />} />
              <Route path="/knowledge-base" element={<KnowledgeBase />} />
              <Route path="/dispatch"      element={<ResponseDispatch />} />
              <Route path="/trends"        element={<TrendAnalysis />} />
              <Route path="/alerts"        element={<Alerts />} />
              <Route path="/model-health"  element={<ModelHealth />} />
              <Route path="/ingestion"     element={<IngestionPipeline />} />
              <Route path="/geo-surge"     element={<GeoSurge />} />
              <Route path="/users"         element={<Users />} />
              <Route path="/audit-log"     element={<AuditLog />} />
              <Route path="/settings"      element={<Settings />} />
              <Route path="*"              element={<Navigate to="/dashboard" replace />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </ViewerAuthProvider>
    </ViewerModeContext.Provider>
  );
}
