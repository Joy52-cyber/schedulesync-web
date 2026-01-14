export function SkeletonLine({ className = '', width = 'full' }) {
  const widthClasses = {
    full: 'w-full',
    '3/4': 'w-3/4',
    '1/2': 'w-1/2',
    '1/3': 'w-1/3',
    '1/4': 'w-1/4'
  };

  return (
    <div className={`h-4 rounded skeleton ${widthClasses[width]} ${className}`} />
  );
}

export function SkeletonCircle({ size = 'md', className = '' }) {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
    xl: 'w-20 h-20'
  };

  return (
    <div className={`rounded-full skeleton ${sizeClasses[size]} ${className}`} />
  );
}

export function SkeletonCard({ className = '' }) {
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 ${className}`}>
      <div className="flex items-center gap-3 mb-4">
        <SkeletonCircle size="md" />
        <div className="flex-1 space-y-2">
          <SkeletonLine width="1/2" />
          <SkeletonLine width="1/3" />
        </div>
      </div>
      <div className="space-y-2">
        <SkeletonLine />
        <SkeletonLine width="3/4" />
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }) {
  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex gap-4 pb-3 border-b border-gray-200 dark:border-gray-700">
        {Array.from({ length: cols }).map((_, i) => (
          <SkeletonLine key={i} width="1/4" className="h-3" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-4 py-2">
          {Array.from({ length: cols }).map((_, colIndex) => (
            <SkeletonLine
              key={colIndex}
              width={colIndex === 0 ? '1/3' : '1/4'}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonBookingCard() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl skeleton" />
        <div className="flex-1 space-y-2">
          <SkeletonLine width="3/4" />
          <SkeletonLine width="1/2" className="h-3" />
          <div className="flex gap-2 mt-3">
            <SkeletonLine width="1/4" className="h-6 rounded-full" />
            <SkeletonLine width="1/4" className="h-6 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function SkeletonEventTypeCard() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
      <div className="flex items-start justify-between mb-4">
        <div className="space-y-2 flex-1">
          <SkeletonLine width="1/2" className="h-5" />
          <SkeletonLine width="1/3" className="h-3" />
        </div>
        <div className="w-8 h-8 rounded skeleton" />
      </div>
      <div className="space-y-2">
        <SkeletonLine />
        <SkeletonLine width="3/4" />
      </div>
      <div className="flex gap-2 mt-4">
        <SkeletonLine width="1/4" className="h-8 rounded-lg" />
        <SkeletonLine width="1/4" className="h-8 rounded-lg" />
      </div>
    </div>
  );
}

export function SkeletonDashboardStats() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <div className="space-y-3">
            <SkeletonLine width="1/2" className="h-3" />
            <SkeletonLine width="1/3" className="h-8" />
            <SkeletonLine width="3/4" className="h-3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonList({ count = 3, className = '' }) {
  return (
    <div className={`space-y-4 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonBookingCard key={i} />
      ))}
    </div>
  );
}
