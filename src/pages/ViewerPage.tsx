import { useParams, Outlet } from 'react-router-dom';
import { setViewerToken } from '../api/client';
import { ViewerAuthProvider } from '../context/AuthContext';
import ViewerModeContext from '../context/ViewerModeContext';

const VIEW_TOKEN_PARAM_REGEX = /^[0-9a-f]{64}$/;

export default function ViewerPage() {
  const { token } = useParams<{ token: string }>();
  const isValid = !!token && VIEW_TOKEN_PARAM_REGEX.test(token);

  // Set synchronously so every API call from child components carries the header.
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

  // Viewer uses the real router (outer BrowserRouter) — no nested MemoryRouter.
  // Child routes under /view/:token/* are declared in App.tsx.
  return (
    <ViewerModeContext.Provider value={true}>
      <ViewerAuthProvider>
        <Outlet />
      </ViewerAuthProvider>
    </ViewerModeContext.Provider>
  );
}
