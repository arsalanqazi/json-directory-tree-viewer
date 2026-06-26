import { StrictMode, Component, ErrorInfo, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Error Boundary: catches any runtime render errors and displays them
// instead of a blank white screen. Helps with debugging.
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    (this as any).state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    (this as any).setState({ errorInfo });
    console.error('[App Error Boundary] Caught render error:', error, errorInfo);
  }

  render() {
    const state = (this as any).state;
    if (state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          background: '#0a0a0a',
          color: '#f1f1f1',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'monospace',
          padding: '2rem',
          boxSizing: 'border-box',
        }}>
          <div style={{ maxWidth: '720px', width: '100%' }}>
            <div style={{ color: '#f87171', fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
              ⚠️ Application Error
            </div>
            <div style={{ color: '#fbbf24', fontSize: '0.85rem', marginBottom: '1rem' }}>
              The app crashed during render. Details below:
            </div>

            <div style={{
              background: '#1c1c1c',
              border: '1px solid #3f3f3f',
              borderRadius: '6px',
              padding: '1rem',
              marginBottom: '1rem',
              overflowX: 'auto',
            }}>
              <div style={{ color: '#f87171', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                {state.error?.name}: {state.error?.message}
              </div>
              <pre style={{ color: '#a3a3a3', fontSize: '0.75rem', margin: 0, whiteSpace: 'pre-wrap' }}>
                {state.error?.stack}
              </pre>
            </div>

            {state.errorInfo && (
              <div style={{
                background: '#1c1c1c',
                border: '1px solid #3f3f3f',
                borderRadius: '6px',
                padding: '1rem',
                marginBottom: '1rem',
                overflowX: 'auto',
              }}>
                <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                  Component Stack:
                </div>
                <pre style={{ color: '#64748b', fontSize: '0.7rem', margin: 0, whiteSpace: 'pre-wrap' }}>
                  {state.errorInfo.componentStack}
                </pre>
              </div>
            )}

            <button
              onClick={() => {
                (this as any).setState({ hasError: false, error: null, errorInfo: null });
                window.location.reload();
              }}
              style={{
                padding: '0.5rem 1.25rem',
                background: '#10b981',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontFamily: 'monospace',
                outline: 'none',
              }}
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
