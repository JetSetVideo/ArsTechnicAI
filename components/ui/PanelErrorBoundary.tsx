import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { bus } from '@/lib/events/bus';
import styles from './PanelErrorBoundary.module.css';

interface Props {
  panelName: string;
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class PanelErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[PanelErrorBoundary:${this.props.panelName}]`, error, info.componentStack);
    bus.emit('error:panel', {
      panelName: this.props.panelName,
      error: error.message,
      stack: info.componentStack ?? undefined,
    });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          id={`panel-error-boundary-${this.props.panelName.toLowerCase().replace(/\s+/g, '-')}`}
          className={styles.errorWrap}
        >
          <AlertTriangle size={22} className={styles.errorIcon} />
          <p className={styles.errorTitle}>{this.props.panelName} crashed</p>
          {this.state.error && (
            <p className={styles.errorDetail}>{this.state.error.message}</p>
          )}
          <button className={styles.reloadBtn} onClick={this.handleReset}>
            <RefreshCw size={12} />
            Reload {this.props.panelName}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
