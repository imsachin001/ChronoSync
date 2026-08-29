/**
 * ============================================
 * SECTION 11: Scale Performance Testing
 * ============================================
 * 
 * Tests the same queries with progressively larger datasets:
 * - 5,000 tasks
 * - 10,000 tasks
 * - 50,000 tasks
 * - 100,000 tasks
 * 
 * Shows how query performance changes as data volume increases.
 * 
 * Run with:
 *   node utils/scalePerformanceTest.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Task from '../models/Task.js';

dotenv.config();

async function connectDB() {
  try {
    const mongoURI = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!mongoURI) {
      throw new Error('MONGODB_URI or MONGO_URI environment variable not set');
    }
    await mongoose.connect(mongoURI);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    process.exit(1);
  }
}

/**
 * Create sample data at specified scale
 */
async function createSampleData(numTasks) {
  console.log(`\n🔄 Creating ${numTasks.toLocaleString()} sample tasks...`);
  
  try {
    // Clear existing data
    await Task.deleteMany({});
    
    // Create test users
    const userIds = ['user1', 'user2', 'user3', 'user4', 'user5'];
    
    // Batch insert for efficiency (insert in chunks of 1000)
    const batchSize = 1000;
    const tasks = [];
    
    for (let i = 0; i < numTasks; i++) {
      const userId = userIds[i % userIds.length];
      const daysOffset = Math.floor(Math.random() * 60) - 30;
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + daysOffset);
      
      tasks.push({
        title: `Task ${i}`,
        description: `Description for task ${i}`,
        dueDate,
        dueTime: '12:00',
        priority: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
        category: ['work', 'personal', 'health'][Math.floor(Math.random() * 3)],
        tags: [`tag${Math.floor(Math.random() * 5)}`],
        estimatedTime: '1h',
        completed: Math.random() > 0.7,
        completedAt: Math.random() > 0.7 ? new Date() : null,
        user: userId,
        overdueNotificationSent: false,
        lastNotificationSent: null,
        createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000)
      });
      
      // Insert in batches
      if ((i + 1) % batchSize === 0) {
        await Task.insertMany(tasks);
        console.log(`  ✓ Inserted ${(i + 1).toLocaleString()} tasks...`);
        tasks.length = 0;
      }
    }
    
    // Insert remaining tasks
    if (tasks.length > 0) {
      await Task.insertMany(tasks);
    }
    
    console.log(`✅ Successfully created ${numTasks.toLocaleString()} tasks`);
  } catch (error) {
    console.error('❌ Error creating sample data:', error.message);
    throw error;
  }
}

/**
 * Run a single query and measure performance
 */
async function measureQuery(description, queryFilter, sortOption = null) {
  try {
    let query = Task.find(queryFilter);
    if (sortOption) {
      query = query.sort(sortOption);
    }

    const explanation = await query.explain('executionStats');

    const executionTime = explanation.executionStats.executionTimeMillis;
    const totalDocsExamined = explanation.executionStats.totalDocsExamined;
    const totalKeysExamined = explanation.executionStats.totalKeysExamined;
    const stage = explanation.executionStats.executionStages.stage;

    const isIndexUsed = stage === 'IXSCAN' || 
                        (explanation.executionStats.executionStages.inputStage?.stage === 'IXSCAN');

    return {
      description,
      executionTime,
      totalDocsExamined,
      totalKeysExamined,
      stage: isIndexUsed ? 'IXSCAN' : 'COLLSCAN',
      isIndexUsed
    };
  } catch (error) {
    console.error(`❌ Error measuring query: ${error.message}`);
    return null;
  }
}

/**
 * Test all queries at a specific scale
 */
async function testAtScale(numTasks) {
  console.log(`\n${'='.repeat(90)}`);
  console.log(`📊 SCALE TEST: ${numTasks.toLocaleString()} Tasks`);
  console.log('='.repeat(90));

  await createSampleData(numTasks);

  // Get index info
  const indexes = await Task.collection.getIndexes();
  console.log(`\n🔍 Active Indexes: ${Object.keys(indexes).length}`);

  const results = [];

  // Query 1: Get all tasks for user
  console.log(`\n📈 Running queries...`);
  results.push(await measureQuery(
    'Get all tasks for user (sorted by dueDate)',
    { user: 'user1' },
    { dueDate: 1 }
  ));

  // Query 2: Overdue tasks
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  results.push(await measureQuery(
    'Find overdue tasks (dueDate ≤ today)',
    {
      user: 'user1',
      dueDate: { $lte: today },
      completed: false
    }
  ));

  // Query 3: Upcoming tasks
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  results.push(await measureQuery(
    'Find upcoming tasks (next 7 days)',
    {
      user: 'user1',
      dueDate: { $gte: today, $lte: nextWeek },
      completed: false
    }
  ));

  // Query 4: Completed tasks
  results.push(await measureQuery(
    'Find completed tasks (sorted by completedAt)',
    { user: 'user1', completed: true },
    { completedAt: -1 }
  ));

  // Print results for this scale
  console.log(`\n📋 Results for ${numTasks.toLocaleString()} tasks:\n`);
  console.log('┌─────────────────────────────────────────┬──────────┬──────────────┬────────────────┐');
  console.log('│ Query                                   │ Time(ms) │ Docs Scanned │ Index Used     │');
  console.log('├─────────────────────────────────────────┼──────────┼──────────────┼────────────────┤');

  results.forEach(result => {
    if (result) {
      const desc = result.description.substring(0, 38).padEnd(38);
      const time = String(result.executionTime).padStart(7);
      const docs = String(result.totalDocsExamined).padStart(11);
      const indexUsed = result.isIndexUsed ? '✅ IXSCAN' : '❌ COLLSCAN';
      console.log(`│ ${desc} │ ${time} │ ${docs} │ ${indexUsed.padEnd(13)} │`);
    }
  });
  console.log('└─────────────────────────────────────────┴──────────┴──────────────┴────────────────┘');

  return results;
}

/**
 * Main function
 */
async function runScaleTests() {
  await connectDB();

  // Test at different scales
  const scales = [5000, 10000, 50000, 100000];
  const allResults = {};

  for (const scale of scales) {
    allResults[scale] = await testAtScale(scale);
  }

  // Summary Report
  console.log(`\n${'='.repeat(90)}`);
  console.log('📊 SCALE TEST SUMMARY - All Dataset Sizes');
  console.log('='.repeat(90));

  console.log('\n📈 Execution Time Trend:\n');
  console.log('┌─────────────┬────────────┬────────────┬────────────┬────────────┐');
  console.log('│ Query       │ 5K Tasks   │ 10K Tasks  │ 50K Tasks  │ 100K Tasks │');
  console.log('├─────────────┼────────────┼────────────┼────────────┼────────────┤');

  const queryNames = [
    'All Tasks',
    'Overdue',
    'Upcoming',
    'Completed'
  ];

  queryNames.forEach((name, idx) => {
    const times = scales.map(scale => {
      const result = allResults[scale][idx];
      return result ? String(result.executionTime).padStart(9) : 'N/A';
    });
    console.log(`│ ${name.padEnd(11)} │${times.join(' │')} │`);
  });

  console.log('└─────────────┴────────────┴────────────┴────────────┴────────────┘');

  console.log('\n📊 Docs Examined Trend:\n');
  console.log('┌─────────────┬────────────┬────────────┬────────────┬────────────┐');
  console.log('│ Query       │ 5K Tasks   │ 10K Tasks  │ 50K Tasks  │ 100K Tasks │');
  console.log('├─────────────┼────────────┼────────────┼────────────┼────────────┤');

  queryNames.forEach((name, idx) => {
    const docs = scales.map(scale => {
      const result = allResults[scale][idx];
      if (result) {
        const docsStr = result.totalDocsExamined.toString().padStart(7);
        return docsStr;
      }
      return 'N/A';
    });
    console.log(`│ ${name.padEnd(11)} │${docs.join(' │')} │`);
  });

  console.log('└─────────────┴────────────┴────────────┴────────────┴────────────┘');

  // Key Insights
  console.log('\n💡 Key Insights:\n');
  
  allResults[5000].forEach((result, idx) => {
    if (result) {
      const timeGrowth5to100 = ((allResults[100000][idx].executionTime - result.executionTime) / result.executionTime * 100).toFixed(1);
      const docsGrowth5to100 = ((allResults[100000][idx].totalDocsExamined - result.totalDocsExamined) / result.totalDocsExamined * 100).toFixed(1);
      
      console.log(`✓ "${result.description.substring(0, 30)}..."`);
      console.log(`  Time growth (5K→100K):  ${timeGrowth5to100}%`);
      console.log(`  Docs growth (5K→100K):  ${docsGrowth5to100}%`);
      console.log(`  Remains IXSCAN:         ${result.isIndexUsed ? '✅ Yes' : '❌ No'}`);
      console.log('');
    }
  });

  console.log('✅ Scale performance analysis complete!\n');

  // Clean up
  await mongoose.connection.close();
}

runScaleTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
