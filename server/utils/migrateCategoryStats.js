import mongoose from 'mongoose';
import UserStats from '../models/UserStats.js';

export const migrateCategoryStats = async () => {
  try {
    console.log('Starting category stats migration...');
    
    const userStats = await UserStats.find({});
    let updatedCount = 0;
    
    for (const stat of userStats) {
      let needsUpdate = false;
      
      // Check if any dailyStats entries are missing categoryStats
      for (const dailyStat of stat.dailyStats) {
        if (!dailyStat.categoryStats) {
          dailyStat.categoryStats = new Map();
          needsUpdate = true;
        }
      }
      
      if (needsUpdate) {
        await stat.save();
        updatedCount++;
        console.log(`Updated user stats for user: ${stat.user}`);
      }
    }
    
    console.log(`Migration completed. Updated ${updatedCount} user stats documents.`);
  } catch (error) {
    console.error('Error during category stats migration:', error);
  }
};

// Run migration if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const { default: mongoose } = await import('mongoose');
  
  // Connect to MongoDB (you'll need to set up your connection string)
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/your-database';
  
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');
    
    await migrateCategoryStats();
    
    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
} 