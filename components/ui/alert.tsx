import { AlertCircle, CheckCircle, Info, XCircle } from 'lucide-react'

interface AlertProps {
  type: 'success' | 'error' | 'warning' | 'info'
  title?: string
  message: string
  onClose?: () => void
}

export function Alert({ type, title, message, onClose }: AlertProps) {
  const styles = {
    success: {
      container: 'bg-emerald-500/10 border-green-500/50/25',
      icon: 'text-green-500',
      title: 'text-green-500',
      message: 'text-green-500',
      Icon: CheckCircle,
    },
    error: {
      container: 'bg-destructive/10 border-destructive/25',
      icon: 'text-destructive',
      title: 'text-destructive',
      message: 'text-destructive',
      Icon: XCircle,
    },
    warning: {
      container: 'bg-amber-500/10 border-yellow-500/50/25',
      icon: 'text-yellow-500',
      title: 'text-yellow-500',
      message: 'text-yellow-500',
      Icon: AlertCircle,
    },
    info: {
      container: 'bg-primary/10 border-primary/20',
      icon: 'text-primary',
      title: 'text-primary',
      message: 'text-primary',
      Icon: Info,
    },
  }

  const style = styles[type]
  const IconComponent = style.Icon

  return (
    <div className={`rounded-lg border p-4 ${style.container}`}>
      <div className="flex items-start gap-3">
        <IconComponent className={`w-5 h-5 flex-shrink-0 mt-0.5 ${style.icon}`} />
        <div className="flex-1">
          {title && (
            <h3 className={`font-semibold mb-1 ${style.title}`}>{title}</h3>
          )}
          <p className={`text-sm ${style.message}`}>{message}</p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-muted-foreground transition-colors"
          >
            <XCircle className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  )
}

interface ToastProps extends AlertProps {
  duration?: number
}

export function Toast({ type, title, message, duration = 3000, onClose }: ToastProps) {
  return (
    <div className="fixed top-4 right-4 z-50 animate-slide-in-right">
      <Alert type={type} title={title} message={message} onClose={onClose} />
    </div>
  )
}
