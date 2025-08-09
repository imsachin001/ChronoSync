import ProductivityScore from '../models/ProductivityScore.js';

// Get the start and end of the current week (Monday to Sunday)
export const getCurrentWeekRange = () => {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay() + 1); // Monday
  startOfWeek.setHours(0, 0, 0, 0);
  
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6); // Sunday
  endOfWeek.setHours(23, 59, 59, 999);
  
  return { startOfWeek, endOfWeek };
};

// Get or create productivity score record for current week
export const getOrCreateProductivityScore = async (userId) => {
  const { startOfWeek, endOfWeek } = getCurrentWeekRange();
  
  let productivityScore = await ProductivityScore.findOne({
    user: userId,
    weekStart: startOfWeek
  });
  
  if (!productivityScore) {
    productivityScore = new ProductivityScore({
      user: userId,
      weekStart: startOfWeek,
      weekEnd: endOfWeek,
      dailyScores: {
        Monday: { completed: 0, total: 0 },
        Tuesday: { completed: 0, total: 0 },
        Wednesday: { completed: 0, total: 0 },
        Thursday: { completed: 0, total: 0 },
        Friday: { completed: 0, total: 0 },
        Saturday: { completed: 0, total: 0 },
        Sunday: { completed: 0, total: 0 }
      }
    });
    await productivityScore.save();
  }
  
  return productivityScore;
};

// Update productivity score when a task is created
export const updateProductivityOnTaskCreate = async (userId, task) => {
  try {
    const productivityScore = await getOrCreateProductivityScore(userId);
    const taskDate = new Date(task.dueDate);
    const dayIndex = taskDate.getDay();
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = daysOfWeek[dayIndex];
    
    // Increment total tasks for the day
    productivityScore.dailyScores[dayName].total += 1;
    await productivityScore.save();
    
    console.log(`Updated productivity score for ${dayName}: +1 total task`);
  } catch (error) {
    console.error('Error updating productivity score on task create:', error);
  }
};

// Update productivity score when a task is completed
export const updateProductivityOnTaskComplete = async (userId, task, wasCompleted) => {
  try {
    const productivityScore = await getOrCreateProductivityScore(userId);
    const taskDate = new Date(task.dueDate);
    const dayIndex = taskDate.getDay();
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = daysOfWeek[dayIndex];
    
    if (wasCompleted) {
      // Task was completed
      productivityScore.dailyScores[dayName].completed += 1;
      console.log(`Updated productivity score for ${dayName}: +1 completed task`);
    } else {
      // Task was uncompleted
      productivityScore.dailyScores[dayName].completed = Math.max(0, productivityScore.dailyScores[dayName].completed - 1);
      console.log(`Updated productivity score for ${dayName}: -1 completed task`);
    }
    
    await productivityScore.save();
  } catch (error) {
    console.error('Error updating productivity score on task complete:', error);
  }
};

// Get productivity score data for the current week
export const getProductivityScoreData = async (userId) => {
  try {
    const productivityScore = await getOrCreateProductivityScore(userId);
    const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    
    const productivityData = daysOfWeek.map(day => {
      const dayData = productivityScore.dailyScores[day];
      return {
        day,
        completed: dayData.completed,
        total: dayData.total,
        score: dayData.total > 0 ? Math.min(100, Math.round((dayData.completed / dayData.total) * 100)) : 0
      };
    });
    
    return productivityData;
  } catch (error) {
    console.error('Error getting productivity score data:', error);
    throw error;
  }
}; 