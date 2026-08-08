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
      container: 'bg-green-50 border-green-200',
      icon: 'text-green-600',
      title: 'text-green-900',
      message: 'text-green-700',
      Icon: CheckCircle,
    },
    error: {
      container: 'bg-red-50 border-red-200',
      icon: 'text-red-600',
      title: 'text-red-900',
      message: 'text-red-700',
      Icon: XCircle,
    },
    warning: {
      container: 'bg-yellow-50 border-yellow-200',
      icon: 'text-yellow-600',
      title: 'text-yellow-900',
      message: 'text-yellow-700',
      Icon: AlertCircle,
    },
    info: {
      container: 'bg-blue-50 border-blue-200',
      icon: 'text-blue-600',
      title: 'text-blue-900',
      message: 'text-blue-700',
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
            className="text-gray-400 hover:text-gray-600 transition-colors"
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
