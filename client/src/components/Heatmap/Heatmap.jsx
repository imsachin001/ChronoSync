import React from 'react'
import './Heatmap.css'

const Heatmap = ({ activityData = [] }) => {
  // Generate last 6 months of data
  const generateHeatmapData = () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    // Start date is 6 months ago
    const startDate = new Date(today)
    startDate.setMonth(today.getMonth() - 6)
    
    // Adjust start to previous Sunday
    const startDayOfWeek = startDate.getDay()
    startDate.setDate(startDate.getDate() - startDayOfWeek)
    startDate.setHours(0, 0, 0, 0)
    
    // End date is the upcoming Saturday (complete the current week)
    const endDate = new Date(today)
    const currentDayOfWeek = endDate.getDay()
    const daysUntilSaturday = 6 - currentDayOfWeek
    endDate.setDate(endDate.getDate() + daysUntilSaturday)
    endDate.setHours(23, 59, 59, 999)
    
    // Create activity map for quick lookup
    const activityMap = new Map()
    activityData.forEach(({ date, count }) => {
      activityMap.set(date, count)
    })
    
    // Generate weeks
    const weeks = []
    let currentDate = new Date(startDate)
    
    while (currentDate <= endDate) {
      const week = []
      for (let i = 0; i < 7; i++) {
        const dateStr = currentDate.toISOString().split('T')[0]
        const count = activityMap.get(dateStr) || 0
        const level = getActivityLevel(count)
        const isInFuture = currentDate > today
        
        week.push({
          date: new Date(currentDate),
          dateStr,
          count,
          level: isInFuture ? 0 : level, // Future dates = level 0
          isFuture: isInFuture
        })
        
        currentDate.setDate(currentDate.getDate() + 1)
      }
      weeks.push(week)
    }
    
    return weeks
  }
  
  const getActivityLevel = (count) => {
    if (count === 0) return 0
    if (count <= 2) return 1
    if (count <= 4) return 2
    if (count <= 6) return 3
    return 4
  }
  
  const getColorForLevel = (level) => {
    const colors = {
      0: '#EBEDF0',
      1: '#9BE9A8',
      2: '#40C463',
      3: '#30A14E',
      4: '#216E39'
    }
    return colors[level] || colors[0]
  }
  
  const getMonthLabels = (weeks) => {
    const monthLabels = []
    let lastMonth = -1
    
    weeks.forEach((week, weekIndex) => {
      const month = week[0].date.getMonth()
      if (month !== lastMonth && weekIndex > 0) {
        monthLabels.push({
          month: week[0].date.toLocaleDateString('en-US', { month: 'short' }),
          index: weekIndex
        })
        lastMonth = month
      }
    })
    
    return monthLabels
  }
  
  const weeks = generateHeatmapData()
  const monthLabels = getMonthLabels(weeks)
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  
  return (
    <div className='heatmap-container'>
      <div className='heatmap-wrapper'>
        {/* Day labels */}
        <div className='heatmap-days'>
          {dayLabels.map((day, index) => (
            <div 
              key={day} 
              className='heatmap-day-label'
              style={{ 
                gridRow: index + 2,
                visibility: index % 2 === 1 ? 'visible' : 'hidden' // Show only Mon, Wed, Fri
              }}
            >
              {day}
            </div>
          ))}
        </div>
        
        {/* Grid */}
        <div className='heatmap-grid'>
          {/* Month labels */}
          <div className='heatmap-months'>
            {monthLabels.map(({ month, index }) => (
              <div
                key={`${month}-${index}`}
                className='heatmap-month-label'
                style={{ gridColumn: index + 1 }}
              >
                {month}
              </div>
            ))}
          </div>
          
          {/* Heatmap squares */}
          <div className='heatmap-squares'>
            {weeks.map((week, weekIndex) => (
              <div key={weekIndex} className='heatmap-week'>
                {week.map((day, dayIndex) => (
                  <div
                    key={`${weekIndex}-${dayIndex}`}
                    className={`heatmap-square level-${day.level}`}
                    style={{ 
                      backgroundColor: getColorForLevel(day.level),
                      opacity: day.isFuture ? 0.3 : 1
                    }}
                    title={day.isFuture 
                      ? `${day.date.toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric', 
                          year: 'numeric' 
                        })} (future)`
                      : `${day.date.toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric', 
                          year: 'numeric' 
                        })}: ${day.count} task${day.count !== 1 ? 's' : ''}`
                    }
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Legend */}
      <div className='heatmap-legend'>
        <span className='legend-label'>Less</span>
        {[0, 1, 2, 3, 4].map(level => (
          <div 
            key={level} 
            className={`heatmap-square level-${level}`}
            style={{ backgroundColor: getColorForLevel(level) }}
          />
        ))}
        <span className='legend-label'>More</span>
      </div>
    </div>
  )
}

export default Heatmap
