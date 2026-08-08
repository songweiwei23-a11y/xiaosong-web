import { Loader2 } from 'lucide-react'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  text?: string
  fullScreen?: boolean
}

export function LoadingSpinner({ 
  size = 'md', 
  text = '加载中...',
  fullScreen = false 
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  }

  const content = (
    <div className="flex flex-col items-center justify-center gap-3">
      <Loader2 className={`${sizeClasses[size]} animate-spin text-blue-600`} />
      {text && (
        <p className="text-sm text-gray-600">{text}</p>
      )}
    </div>
  )

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-white bg-opacity-90 flex items-center justify-center z-50">
        {content}
      </div>
    )
  }

  return content
}

interface GeneratingOverlayProps {
  isGenerating: boolean
  text?: string
  progress?: number
}

export function GeneratingOverlay({ 
  isGenerating, 
  text = 'AI 正在生成中...',
  progress 
}: GeneratingOverlayProps) {
  if (!isGenerating) return null

  return (
    <div className="absolute inset-0 bg-white bg-opacity-95 flex flex-col items-center justify-center gap-4 rounded-lg z-10">
      <div className="relative">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
        {progress !== undefined && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-semibold text-blue-600">
              {progress}%
            </span>
          </div>
        )}
      </div>
      <div className="text-center">
        <p className="text-lg font-medium text-gray-900">{text}</p>
        <p className="text-sm text-gray-500 mt-1">请稍候，这可能需要几秒钟</p>
      </div>
      {progress !== undefined && (
        <div className="w-64 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className="h-full bg-blue-600 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  )
}

export function LoadingDots() {
  return (
    <div className="flex gap-1">
      <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
      <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
      <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
    </div>
  )
}
