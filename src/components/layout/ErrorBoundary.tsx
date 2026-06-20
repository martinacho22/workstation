import { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          background: '#0a0a0f',
          color: '#e2e2f0',
          fontFamily: 'Inter, system-ui, sans-serif',
          padding: 40,
          textAlign: 'center',
          gap: 16,
        }}>
          <div style={{ fontSize: 32, opacity: 0.3, marginBottom: 8 }}>⚠</div>
          <h1 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Something went wrong</h1>
          <p style={{ fontSize: 12, color: '#6b6b8a', maxWidth: 400, lineHeight: 1.5 }}>
            An unexpected error occurred. The store and canvas state are preserved in localStorage.
          </p>
          {this.state.error && (
            <pre style={{
              fontSize: 11,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 8,
              padding: '12px 16px',
              maxWidth: 500,
              overflow: 'auto',
              color: '#6b6b8a',
              textAlign: 'left',
              lineHeight: 1.5,
            }}>
              {this.state.error.message}
            </pre>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button
              onClick={this.handleReset}
              style={{
                background: 'rgba(0,255,136,0.1)',
                border: '1px solid rgba(0,255,136,0.2)',
                color: '#00ff88',
                padding: '8px 20px',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Try again
            </button>
            <button
              onClick={this.handleReload}
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#8888aa',
                padding: '8px 20px',
                borderRadius: 8,
                fontSize: 13,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Reload app
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
