import { Component, type ReactNode, type ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
    children: ReactNode;
    fallbackTitle?: string;
    onReset?: () => void;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class SectionErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('SectionErrorBoundary caught an error:', error, errorInfo);
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null });
        this.props.onReset?.();
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-center my-3">
                    <AlertTriangle className="w-5 h-5 text-rose-500 mx-auto mb-1.5" />
                    <p className="text-xs font-bold text-rose-800 mb-1">
                        {this.props.fallbackTitle || 'Error en esta sección'}
                    </p>
                    <p className="text-[10px] text-rose-600 mb-2 font-mono break-all">
                        {this.state.error?.message || 'Error inesperado'}
                    </p>
                    <button
                        type="button"
                        onClick={this.handleReset}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-colors"
                    >
                        <RefreshCw className="w-3 h-3" /> Reintentar
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}
