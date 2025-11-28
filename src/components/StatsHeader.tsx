export function StatsHeader({ username, budget, spent, remaining }: any) {
    const percent = Math.min((spent / budget) * 100, 100)
    
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center font-bold text-xl">
            {username[0].toUpperCase()}
          </div>
          <div>
            <h2 className="text-xl font-bold">{username}</h2>
            <div className="text-sm text-gray-400">Ваша команда</div>
          </div>
        </div>
  
        <div className="flex-1 w-full max-w-xl">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-400">Бюджет: {spent} / {budget}</span>
            <span className={remaining < 0 ? 'text-red-500' : 'text-green-400'}>
              Осталось: {remaining}
            </span>
          </div>
          <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-500 ${remaining < 20 ? 'bg-red-500' : 'bg-blue-500'}`} 
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      </div>
    )
  }