import { Component, type ReactNode, type ErrorInfo } from 'react'

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
          fontFamily: "'Inter', system-ui, sans-serif",
          padding: 40,
          textAlign: 'center',
          gap: 16,
        }}>
          <div style={{ fontSize: 32, opacity: 0.3 }}>⚠</div>
          <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Something went wrong</h1>
          <p style={{ fontSize: 13, color: '#6b6b8a', maxWidth: 400, lineHeight: 1.5 }}>
            Workstation hit an unexpected error. Your projects are saved.
          </p>
          <pre style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 8,
            padding: '12px 16px',
            fontSize: 11,
            color: '#ff4466',
            maxWidth: 500,
            overflow: 'auto',
            textAlign: 'left',
            lineHeight: 1.5,
          }}>
            {this.state.error?.message ?? 'Unknown error'}
          </pre>
          <button
            onClick={this.handleReset}
            style={{
              background: '#00ff88',
              color: '#000',
              border: 'none',
              padding: '10px 24px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              marginTop: 8,
            }}
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
