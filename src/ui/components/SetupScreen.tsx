import { useState } from 'react';

interface SetupScreenProps {
  onConnect: (repoPath: string, appUrl: string) => void;
  loading: boolean;
  error: string | null;
}

export default function SetupScreen({ onConnect, loading, error }: SetupScreenProps) {
  const [repoPath, setRepoPath] = useState('');
  const [appUrl, setAppUrl] = useState('http://localhost:3000');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoPath.trim() || !appUrl.trim()) return;
    onConnect(repoPath.trim(), appUrl.trim());
  };

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-[#f5f5f5]">
      <div style={{ width: 420 }}>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#171717', marginBottom: 6 }}>xmap</h1>
          <p style={{ fontSize: 14, color: '#737373', fontWeight: 470, lineHeight: 1.5 }}>
            Visualize your app's experience map. Point at your project repo and running dev server.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 550, color: '#404040', marginBottom: 6 }}>
              Project path
            </label>
            <input
              type="text"
              value={repoPath}
              onChange={(e) => setRepoPath(e.target.value)}
              placeholder="/Users/you/projects/my-app"
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: 14,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                border: '1px solid #e5e5e5',
                borderRadius: 8,
                outline: 'none',
                background: '#fff',
                color: '#171717',
              }}
              onFocus={(e) => e.target.style.borderColor = '#a3a3a3'}
              onBlur={(e) => e.target.style.borderColor = '#e5e5e5'}
              autoFocus
            />
            <p style={{ fontSize: 12, color: '#a3a3a3', marginTop: 4 }}>
              Absolute path to your project's root directory
            </p>
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 550, color: '#404040', marginBottom: 6 }}>
              App URL
            </label>
            <input
              type="text"
              value={appUrl}
              onChange={(e) => setAppUrl(e.target.value)}
              placeholder="http://localhost:3000"
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: 14,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                border: '1px solid #e5e5e5',
                borderRadius: 8,
                outline: 'none',
                background: '#fff',
                color: '#171717',
              }}
              onFocus={(e) => e.target.style.borderColor = '#a3a3a3'}
              onBlur={(e) => e.target.style.borderColor = '#e5e5e5'}
            />
            <p style={{ fontSize: 12, color: '#a3a3a3', marginTop: 4 }}>
              Where your dev server is running (for live iframes)
            </p>
          </div>

          {error && (
            <div style={{
              padding: '10px 12px',
              fontSize: 13,
              color: '#dc2626',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: 8,
              marginBottom: 16,
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !repoPath.trim()}
            style={{
              width: '100%',
              padding: '10px 16px',
              fontSize: 14,
              fontWeight: 600,
              color: '#fff',
              background: loading ? '#a3a3a3' : '#171717',
              border: 'none',
              borderRadius: 8,
              cursor: loading ? 'wait' : 'pointer',
              transition: 'background 150ms',
            }}
            onMouseEnter={(e) => { if (!loading) (e.target as HTMLButtonElement).style.background = '#404040'; }}
            onMouseLeave={(e) => { if (!loading) (e.target as HTMLButtonElement).style.background = '#171717'; }}
          >
            {loading ? 'Discovering routes...' : 'Discover & Map'}
          </button>
        </form>
      </div>
    </div>
  );
}
