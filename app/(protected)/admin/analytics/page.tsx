'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface ChatEntry {
  id: string
  timestamp: string
  question: string
  answer: string
  hour: number
  date: string
  userId?: string
  location?: string
  device?: string
  deviceType?: string
  os?: string
  browser?: string
}

interface HourlyStat {
  hour: number
  count: number
}

interface DateStat {
  date: string
  count: number
}

interface UserStat {
  userId: string
  count: number
  firstSeen: string
  lastSeen: string
  location?: string
  device?: string
}

interface DeviceStat {
  device: string
  count: number
}

interface LocationStat {
  location: string
  count: number
}

export default function AnalyticsPage() {
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [entries, setEntries] = useState<ChatEntry[]>([])
  const [hourlyStats, setHourlyStats] = useState<HourlyStat[]>([])
  const [dateStats, setDateStats] = useState<DateStat[]>([])
  const [userStats, setUserStats] = useState<UserStat[]>([])
  const [deviceStats, setDeviceStats] = useState<DeviceStat[]>([])
  const [locationStats, setLocationStats] = useState<LocationStat[]>([])
  const [total, setTotal] = useState(0)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedHour, setSelectedHour] = useState<number | null>(null)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [selectedEntries, setSelectedEntries] = useState<ChatEntry[]>([])
  const [showModal, setShowModal] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const checkAuth = () => {
      const savedAuth = localStorage.getItem('admin_authenticated')
      if (savedAuth === 'true') {
        setIsAuthenticated(true)
        loadAnalytics()
      }
      setIsCheckingAuth(false)
    }
    checkAuth()
  }, [])

  const loadAnalytics = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/admin/analytics')
      if (response.ok) {
        const data = await response.json()
        setEntries(data.entries || [])
        setHourlyStats(data.hourlyStats || [])
        setDateStats(data.dateStats || [])
        setUserStats(data.userStats || [])
        setDeviceStats(data.deviceStats || [])
        setLocationStats(data.locationStats || [])
        setTotal(data.total || 0)
      }
    } catch (error) {
      console.error('Error loading analytics:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDateClick = async (date: string) => {
    setSelectedDate(date)
    setSelectedHour(null)
    try {
      const response = await fetch(`/api/admin/analytics?date=${date}`)
      if (response.ok) {
        const data = await response.json()
        setSelectedEntries(data.entries || [])
        setShowModal(true)
      }
    } catch (error) {
      console.error('Error loading date details:', error)
    }
  }

  const handleHourClick = async (hour: number) => {
    setSelectedHour(hour)
    setSelectedDate(null)
    try {
      const response = await fetch(`/api/admin/analytics?hour=${hour}`)
      if (response.ok) {
        const data = await response.json()
        setSelectedEntries(data.entries || [])
        setShowModal(true)
      }
    } catch (error) {
      console.error('Error loading hour details:', error)
    }
  }

  const handleLineClick = (hour: number) => {
    handleHourClick(hour)
  }

  const handleUserClick = async (userId: string) => {
    setSelectedUserId(userId)
    setSelectedDate(null)
    setSelectedHour(null)
    try {
      const response = await fetch('/api/admin/analytics')
      if (response.ok) {
        const data = await response.json()
        const userEntries = (data.entries || []).filter((e: ChatEntry) => e.userId === userId)
        setSelectedEntries(userEntries)
        setShowModal(true)
      }
    } catch (error) {
      console.error('Error loading user details:', error)
    }
  }

  const exportToCSV = () => {
    const headers = ['ID', 'Timestamp', 'Date', 'Hour', 'User ID', 'Location', 'Device', 'OS', 'Browser', 'Question', 'Answer']
    const rows = entries.map(entry => [
      entry.id,
      entry.timestamp,
      entry.date,
      entry.hour.toString(),
      entry.userId || 'unknown',
      entry.location || 'unknown',
      entry.deviceType || 'unknown',
      entry.os || 'unknown',
      entry.browser || 'unknown',
      `"${entry.question.replace(/"/g, '""')}"`,
      `"${entry.answer.replace(/"/g, '""')}"`
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `chat-analytics-${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (isCheckingAuth) {
    return <div className="min-h-screen flex items-center justify-center text-white">Loading...</div>
  }

  if (!isAuthenticated) {
    router.push('/admin')
    return null
  }

  const maxCount = Math.max(...hourlyStats.map(s => s.count), 1)
  const chartHeight = 300

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8" style={{ paddingTop: '120px' }}>
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
          <div className="flex gap-4">
            <button
              onClick={() => router.push('/admin')}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
            >
              Back to Admin
            </button>
            <button
              onClick={exportToCSV}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded transition-colors"
            >
              Export CSV
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12">Loading analytics...</div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-gray-800 p-6 rounded-lg">
                <div className="text-gray-400 text-sm mb-2">Total Questions</div>
                <div className="text-3xl font-bold">{total}</div>
              </div>
              <div className="bg-gray-800 p-6 rounded-lg">
                <div className="text-gray-400 text-sm mb-2">Today</div>
                <div className="text-3xl font-bold">
                  {entries.filter(e => e.date === new Date().toISOString().split('T')[0]).length}
                </div>
              </div>
              <div className="bg-gray-800 p-6 rounded-lg">
                <div className="text-gray-400 text-sm mb-2">This Hour</div>
                <div className="text-3xl font-bold">
                  {entries.filter(e => {
                    const now = new Date()
                    return e.date === now.toISOString().split('T')[0] && e.hour === now.getHours()
                  }).length}
                </div>
              </div>
            </div>

            {/* 시간별 라인 그래프 */}
            <div className="bg-gray-800 p-6 rounded-lg mb-8">
              <h2 className="text-xl font-bold mb-4">Questions by Hour (24h)</h2>
              <div className="relative" style={{ height: `${chartHeight}px`, padding: '0 20px' }}>
                <svg width="100%" height={chartHeight} className="overflow-visible">
                  {/* 그리드 라인 */}
                  {Array.from({ length: 5 }).map((_, i) => {
                    const y = (chartHeight / 4) * i
                    return (
                      <line
                        key={i}
                        x1="0"
                        y1={y}
                        x2="100%"
                        y2={y}
                        stroke="rgba(255,255,255,0.1)"
                        strokeWidth="1"
                      />
                    )
                  })}
                  
                  {/* Y축 레이블 */}
                  {Array.from({ length: 5 }).map((_, i) => {
                    const value = Math.round((maxCount / 4) * (4 - i))
                    const y = (chartHeight / 4) * i
                    return (
                      <text
                        key={i}
                        x="0"
                        y={y + 4}
                        fontSize="11"
                        fill="rgba(255,255,255,0.5)"
                        textAnchor="start"
                      >
                        {value}
                      </text>
                    )
                  })}
                  
                  {/* 라인 그래프 */}
                  <polyline
                    points={hourlyStats.map((stat, index) => {
                      const x = 20 + ((index / 23) * (100 - 40))
                      const y = chartHeight - (stat.count / maxCount) * (chartHeight - 40) - 20
                      return `${x},${y}`
                    }).join(' ')}
                    fill="none"
                    stroke="#DB6930"
                    strokeWidth="2.5"
                    className="cursor-pointer"
                  />
                  
                  {/* 포인트 및 클릭 영역 */}
                  {hourlyStats.map((stat, index) => {
                    const x = 20 + ((index / 23) * (100 - 40))
                    const y = chartHeight - (stat.count / maxCount) * (chartHeight - 40) - 20
                    // 2시간 간격으로만 레이블 표시 (0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22)
                    const showLabel = stat.hour % 2 === 0
                    return (
                      <g key={index}>
                        <circle
                          cx={x}
                          cy={y}
                          r="6"
                          fill="#DB6930"
                          className="cursor-pointer hover:r-8 transition-all"
                          onClick={() => handleLineClick(stat.hour)}
                          style={{ transition: 'r 0.2s' }}
                        />
                        {showLabel && (
                          <text
                            x={x}
                            y={chartHeight - 5}
                            textAnchor="middle"
                            fontSize="11"
                            fill="rgba(255,255,255,0.7)"
                          >
                            {stat.hour}:00
                          </text>
                        )}
                        {stat.count > 0 && (
                          <text
                            x={x}
                            y={y - 12}
                            textAnchor="middle"
                            fontSize="10"
                            fill="#DB6930"
                            fontWeight="bold"
                          >
                            {stat.count}
                          </text>
                        )}
                      </g>
                    )
                  })}
                </svg>
              </div>
            </div>

            {/* 날짜별 라인 그래프 */}
            {dateStats.length > 0 && (
              <div className="bg-gray-800 p-6 rounded-lg mb-8">
                <h2 className="text-xl font-bold mb-4">Questions by Date (Last 30 Days)</h2>
                <div className="relative" style={{ height: `${chartHeight}px`, padding: '0 20px' }}>
                  <svg width="100%" height={chartHeight} className="overflow-visible">
                    {(() => {
                      const maxDateCount = Math.max(...dateStats.map(s => s.count), 1)
                      const dateCount = dateStats.length
                      
                      return (
                        <>
                          {/* 그리드 라인 */}
                          {Array.from({ length: 5 }).map((_, i) => {
                            const y = (chartHeight / 4) * i
                            return (
                              <line
                                key={i}
                                x1="0"
                                y1={y}
                                x2="100%"
                                y2={y}
                                stroke="rgba(255,255,255,0.1)"
                                strokeWidth="1"
                              />
                            )
                          })}
                          
                          {/* Y축 레이블 */}
                          {Array.from({ length: 5 }).map((_, i) => {
                            const value = Math.round((maxDateCount / 4) * (4 - i))
                            const y = (chartHeight / 4) * i
                            return (
                              <text
                                key={i}
                                x="0"
                                y={y + 4}
                                fontSize="11"
                                fill="rgba(255,255,255,0.5)"
                                textAnchor="start"
                              >
                                {value}
                              </text>
                            )
                          })}
                          
                          {/* 라인 그래프 */}
                          <polyline
                            points={dateStats.map((stat, index) => {
                              const x = 20 + ((index / (dateCount - 1 || 1)) * (100 - 40))
                              const y = chartHeight - (stat.count / maxDateCount) * (chartHeight - 40) - 20
                              return `${x},${y}`
                            }).join(' ')}
                            fill="none"
                            stroke="#DB6930"
                            strokeWidth="2.5"
                            className="cursor-pointer"
                          />
                          
                          {/* 포인트 및 클릭 영역 */}
                          {dateStats.map((stat, index) => {
                            const x = 20 + ((index / (dateCount - 1 || 1)) * (100 - 40))
                            const y = chartHeight - (stat.count / maxDateCount) * (chartHeight - 40) - 20
                            const dateLabel = new Date(stat.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                            return (
                              <g key={index}>
                                <circle
                                  cx={x}
                                  cy={y}
                                  r="5"
                                  fill="#DB6930"
                                  className="cursor-pointer hover:r-7 transition-all"
                                  onClick={() => handleDateClick(stat.date)}
                                  style={{ transition: 'r 0.2s' }}
                                />
                                {index % Math.ceil(dateCount / 10) === 0 && (
                                  <text
                                    x={x}
                                    y={chartHeight - 5}
                                    textAnchor="middle"
                                    fontSize="10"
                                    fill="rgba(255,255,255,0.6)"
                                    transform={`rotate(-45 ${x} ${chartHeight - 5})`}
                                  >
                                    {dateLabel}
                                  </text>
                                )}
                                {stat.count > 0 && (
                                  <text
                                    x={x}
                                    y={y - 12}
                                    textAnchor="middle"
                                    fontSize="10"
                                    fill="#DB6930"
                                    fontWeight="bold"
                                  >
                                    {stat.count}
                                  </text>
                                )}
                              </g>
                            )
                          })}
                        </>
                      )
                    })()}
                  </svg>
                </div>
              </div>
            )}

            {/* 사용자별 통계 */}
            <div className="bg-gray-800 p-6 rounded-lg mb-8">
              <h2 className="text-xl font-bold mb-4">Users ({userStats.length})</h2>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {userStats.slice(0, 10).map((user) => (
                  <div
                    key={user.userId}
                    className="bg-gray-700 p-4 rounded cursor-pointer hover:bg-gray-600 transition-colors"
                    onClick={() => handleUserClick(user.userId)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="text-sm font-mono text-gray-300">{user.userId.substring(0, 20)}...</div>
                      <div className="text-sm text-gray-400">{user.count} messages</div>
                    </div>
                    <div className="text-xs text-gray-500">
                      {user.location && <span className="mr-3">📍 {user.location}</span>}
                      {user.device && <span>📱 {user.device}</span>}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      First: {new Date(user.firstSeen).toLocaleString()} | 
                      Last: {new Date(user.lastSeen).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 디바이스별 파이 그래프 */}
            {deviceStats.length > 0 && (
              <div className="bg-gray-800 p-6 rounded-lg mb-8">
                <h2 className="text-xl font-bold mb-4">Questions by Device Type</h2>
                <div className="flex items-center justify-center" style={{ height: `${chartHeight}px` }}>
                  <svg width="300" height="300" viewBox="0 0 300 300" className="overflow-visible">
                    {(() => {
                      const total = deviceStats.reduce((sum, stat) => sum + stat.count, 0)
                      const colors = ['#DB6930', '#EC7337', '#FF8C42', '#FFA366']
                      let currentAngle = -90 // 시작 각도 (12시 방향)
                      
                      return (
                        <>
                          {deviceStats.map((stat, index) => {
                            const percentage = (stat.count / total) * 100
                            const angle = (stat.count / total) * 360
                            const startAngle = currentAngle
                            const endAngle = currentAngle + angle
                            
                            // 파이 조각 경로 계산
                            const startAngleRad = (startAngle * Math.PI) / 180
                            const endAngleRad = (endAngle * Math.PI) / 180
                            const centerX = 150
                            const centerY = 150
                            const radius = 100
                            
                            const x1 = centerX + radius * Math.cos(startAngleRad)
                            const y1 = centerY + radius * Math.sin(startAngleRad)
                            const x2 = centerX + radius * Math.cos(endAngleRad)
                            const y2 = centerY + radius * Math.sin(endAngleRad)
                            
                            const largeArcFlag = angle > 180 ? 1 : 0
                            
                            const pathData = [
                              `M ${centerX} ${centerY}`,
                              `L ${x1} ${y1}`,
                              `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
                              'Z'
                            ].join(' ')
                            
                            // 레이블 위치 계산
                            const labelAngle = (startAngle + endAngle) / 2
                            const labelAngleRad = (labelAngle * Math.PI) / 180
                            const labelRadius = radius * 0.7
                            const labelX = centerX + labelRadius * Math.cos(labelAngleRad)
                            const labelY = centerY + labelRadius * Math.sin(labelAngleRad)
                            
                            currentAngle = endAngle
                            
                            return (
                              <g key={index}>
                                <path
                                  d={pathData}
                                  fill={colors[index % colors.length]}
                                  className="cursor-pointer hover:opacity-80 transition-opacity"
                                  style={{ transition: 'opacity 0.2s' }}
                                />
                                {percentage > 5 && (
                                  <text
                                    x={labelX}
                                    y={labelY}
                                    textAnchor="middle"
                                    dominantBaseline="middle"
                                    fontSize="12"
                                    fill="white"
                                    fontWeight="bold"
                                  >
                                    {stat.device.charAt(0).toUpperCase() + stat.device.slice(1)}
                                  </text>
                                )}
                                {percentage > 10 && (
                                  <text
                                    x={labelX}
                                    y={labelY + 15}
                                    textAnchor="middle"
                                    dominantBaseline="middle"
                                    fontSize="11"
                                    fill="rgba(255,255,255,0.8)"
                                  >
                                    {percentage.toFixed(1)}%
                                  </text>
                                )}
                              </g>
                            )
                          })}
                          
                          {/* 범례 */}
                          <g transform="translate(260, 50)">
                            {deviceStats.map((stat, index) => {
                              const percentage = (stat.count / total) * 100
                              return (
                                <g key={index} transform={`translate(0, ${index * 30})`}>
                                  <rect
                                    width="12"
                                    height="12"
                                    fill={colors[index % colors.length]}
                                    rx="2"
                                  />
                                  <text
                                    x="18"
                                    y="9"
                                    fontSize="11"
                                    fill="rgba(255,255,255,0.9)"
                                    dominantBaseline="middle"
                                  >
                                    {stat.device.charAt(0).toUpperCase() + stat.device.slice(1)} ({stat.count})
                                  </text>
                                </g>
                              )
                            })}
                          </g>
                        </>
                      )
                    })()}
                  </svg>
                </div>
              </div>
            )}

            {/* 위치별 바 그래프 */}
            {locationStats.length > 0 && (
              <div className="bg-gray-800 p-6 rounded-lg mb-8">
                <h2 className="text-xl font-bold mb-4">Questions by Location</h2>
                <div className="relative" style={{ height: `${Math.max(chartHeight, locationStats.length * 40)}px`, padding: '0 60px 0 20px' }}>
                  <svg width="100%" height={Math.max(chartHeight, locationStats.length * 40)} className="overflow-visible">
                    {(() => {
                      const maxLocationCount = Math.max(...locationStats.map(s => s.count), 1)
                      const barHeight = 30
                      const barSpacing = 10
                      const chartWidth = 100 - 20 // percentage
                      
                      return (
                        <>
                          {/* 그리드 라인 */}
                          {Array.from({ length: 5 }).map((_, i) => {
                            const y = ((Math.max(chartHeight, locationStats.length * 40) - 40) / 4) * i + 20
                            return (
                              <line
                                key={i}
                                x1="20%"
                                y1={y}
                                x2="100%"
                                y2={y}
                                stroke="rgba(255,255,255,0.1)"
                                strokeWidth="1"
                              />
                            )
                          })}
                          
                          {/* Y축 레이블 */}
                          {Array.from({ length: 5 }).map((_, i) => {
                            const value = Math.round((maxLocationCount / 4) * (4 - i))
                            const y = ((Math.max(chartHeight, locationStats.length * 40) - 40) / 4) * i + 20
                            return (
                              <text
                                key={i}
                                x="18%"
                                y={y + 4}
                                fontSize="11"
                                fill="rgba(255,255,255,0.5)"
                                textAnchor="end"
                              >
                                {value}
                              </text>
                            )
                          })}
                          
                          {/* 바 그래프 */}
                          {locationStats.map((stat, index) => {
                            const barWidth = (stat.count / maxLocationCount) * chartWidth
                            const y = index * (barHeight + barSpacing) + 20
                            const barX = 20 // percentage
                            
                            return (
                              <g key={index}>
                                {/* 바 */}
                                <rect
                                  x={`${barX}%`}
                                  y={y}
                                  width={`${barWidth}%`}
                                  height={barHeight}
                                  fill="#DB6930"
                                  rx="4"
                                  className="cursor-pointer hover:opacity-80 transition-opacity"
                                  style={{ transition: 'opacity 0.2s' }}
                                />
                                
                                {/* 위치 레이블 */}
                                <text
                                  x={`${barX - 2}%`}
                                  y={y + barHeight / 2}
                                  fontSize="11"
                                  fill="rgba(255,255,255,0.9)"
                                  textAnchor="end"
                                  dominantBaseline="middle"
                                >
                                  {stat.location.length > 20 ? stat.location.substring(0, 17) + '...' : stat.location}
                                </text>
                                
                                {/* 카운트 레이블 */}
                                {stat.count > 0 && (
                                  <text
                                    x={`${barX + barWidth + 1}%`}
                                    y={y + barHeight / 2}
                                    fontSize="11"
                                    fill="#DB6930"
                                    fontWeight="bold"
                                    dominantBaseline="middle"
                                  >
                                    {stat.count}
                                  </text>
                                )}
                              </g>
                            )
                          })}
                        </>
                      )
                    })()}
                  </svg>
                </div>
              </div>
            )}

            {/* 최근 질문 목록 */}
            <div className="bg-gray-800 p-6 rounded-lg">
              <h2 className="text-xl font-bold mb-4">Recent Questions</h2>
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {entries.slice(-20).reverse().map((entry) => (
                  <div
                    key={entry.id}
                    className="bg-gray-700 p-4 rounded cursor-pointer hover:bg-gray-600 transition-colors"
                    onClick={() => {
                      setSelectedEntries([entry])
                      setShowModal(true)
                    }}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="text-sm text-gray-400">
                        {new Date(entry.timestamp).toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-500">
                        {entry.deviceType && <span className="mr-2">📱 {entry.deviceType}</span>}
                        {entry.location && <span>📍 {entry.location}</span>}
                      </div>
                    </div>
                    <div className="font-medium mb-1">{entry.question}</div>
                    {entry.userId && (
                      <div className="text-xs text-gray-500 font-mono mt-1">
                        User: {entry.userId.substring(0, 15)}...
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* 상세 내역 모달 */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">
                  {selectedDate ? `Questions on ${selectedDate}` : 
                   selectedHour !== null ? `Questions at ${selectedHour}:00` : 
                   selectedUserId ? `Messages from User: ${selectedUserId.substring(0, 20)}...` :
                   'Question Details'}
                </h2>
                <button
                  onClick={() => {
                    setShowModal(false)
                    setSelectedEntries([])
                    setSelectedDate(null)
                    setSelectedHour(null)
                    setSelectedUserId(null)
                  }}
                  className="text-gray-400 hover:text-white"
                >
                  ✕
                </button>
              </div>
              <div className="space-y-4">
                {selectedEntries.map((entry) => (
                  <div key={entry.id} className="bg-gray-700 p-4 rounded">
                    <div className="flex justify-between items-start mb-2">
                      <div className="text-sm text-gray-400">
                        {new Date(entry.timestamp).toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-500">
                        {entry.deviceType && <span className="mr-2">📱 {entry.deviceType}</span>}
                        {entry.os && <span className="mr-2">💻 {entry.os}</span>}
                        {entry.browser && <span className="mr-2">🌐 {entry.browser}</span>}
                        {entry.location && <span>📍 {entry.location}</span>}
                      </div>
                    </div>
                    {entry.userId && (
                      <div className="text-xs text-gray-500 font-mono mb-2">
                        User ID: {entry.userId}
                      </div>
                    )}
                    <div className="mb-2">
                      <div className="text-gray-400 text-sm mb-1">Question:</div>
                      <div className="font-medium">{entry.question}</div>
                    </div>
                    <div>
                      <div className="text-gray-400 text-sm mb-1">Answer:</div>
                      <div className="text-gray-300 whitespace-pre-wrap">{entry.answer.substring(0, 500)}{entry.answer.length > 500 ? '...' : ''}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
