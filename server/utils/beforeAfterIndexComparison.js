/**
 * ============================================
 * SECTION 12: Before/After Index Comparison
 * ============================================
 * 
 * This is your most valuable MongoDB experiment.
 * 
 * Runs the exact same query:
 * 1. WITHOUT indexes (drops them first)
 * 2. WITH indexes (recreates them)
 * 
 * Measures:
 * - executionTimeMillis
 * - totalDocsExamined
 * - executionStage (COLLSCAN vs IXSCAN)
 * 
 * Shows real before/after performance impact.
 * 
 * Run with:
 *   node utils/beforeAfterIndexComparison.js
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
 * Create sample data (10,000 tasks for meaningful results)
 */
async function createSampleData() {
  console.log('\n🔄 Creating 10,000 sample tasks for realistic testing...');
  
  try {
    const count = await Task.countDocuments();
    if (count === 0) {
      const userIds = ['user1', 'user2', 'user3', 'user4', 'user5'];
      const tasks = [];
      const batchSize = 1000;

      for (let i = 0; i < 10000; i++) {
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

        if ((i + 1) % batchSize === 0) {
          await Task.insertMany(tasks);
          console.log(`  ✓ Inserted ${(i + 1).toLocaleString()} tasks...`);
          tasks.length = 0;
        }
      }

      if (tasks.length > 0) {
        await Task.insertMany(tasks);
      }
      console.log('✅ Created 10,000 sample tasks');
    } else {
      console.log(`✅ Using existing ${count.toLocaleString()} tasks`);
    }
  } catch (error) {
    console.error('❌ Error creating sample data:', error.message);
    throw error;
  }
}

/**
 * Drop all indexes except _id
 */
async function dropAllIndexes() {
  console.log('\n⚠️  Dropping all indexes (keeping only _id)...');
  try {
    // Get all indexes
    const indexes = await Task.collection.getIndexes();
    
    // Drop each index except _id
    for (const indexName in indexes) {
      if (indexName !== '_id_') {
        await Task.collection.dropIndex(indexName);
        console.log(`  ✓ Dropped index: ${indexName}`);
      }
    }
    
    console.log('✅ All indexes dropped (except _id)');
  } catch (error) {
    console.error('❌ Error dropping indexes:', error.message);
    throw error;
  }
}

/**
 * Recreate all indexes
 */
async function createAllIndexes() {
  console.log('\n✨ Recreating all indexes...');
  try {
    // These match the indexes in Task.js
    await Task.collection.createIndex({ user: 1, dueDate: 1 });
    console.log('  ✓ Created index: { user: 1, dueDate: 1 }');

    await Task.collection.createIndex({ user: 1, dueDate: 1, completed: 1 });
    console.log('  ✓ Created index: { user: 1, dueDate: 1, completed: 1 }');

    await Task.collection.createIndex({ user: 1, completed: 1, completedAt: 1 });
    console.log('  ✓ Created index: { user: 1, completed: 1, completedAt: 1 }');

    await Task.collection.createIndex({ user: 1, completed: 1, createdAt: -1 });
    console.log('  ✓ Created index: { user: 1, completed: 1, createdAt: -1 }');

    await Task.collection.createIndex({ user: 1 });
    console.log('  ✓ Created index: { user: 1 }');

    console.log('✅ All indexes recreated');
  } catch (error) {
    console.error('❌ Error creating indexes:', error.message);
    throw error;
  }
}

/**
 * Measure a single query
 */
async function measureSingleQuery(description, queryFilter, sortOption = null) {
  try {
    let query = Task.find(queryFilter);
    if (sortOption) {
      query = query.sort(sortOption);
    }

    const explanation = await query.explain('executionStats');

    const stats = explanation.executionStats;
    const executionTime = stats.executionTimeMillis;
    const totalDocsExamined = stats.totalDocsExamined;
    const totalKeysExamined = stats.totalKeysExamined || 0;
    const stage = stats.executionStages.stage;

    const isIndexUsed = stage === 'IXSCAN' || 
                        (stats.executionStages.inputStage?.stage === 'IXSCAN');

    return {
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
 * Run the most critical query
 */
async function testQuery() {
  // Most common query: Get all tasks for user sorted by dueDate
  const queryDescription = 'Get all tasks for user sorted by dueDate';
  const queryFilter = { user: 'user1' };
  const sortOption = { dueDate: 1 };

  console.log(`\n${'='.repeat(90)}`);
  console.log('🧪 BEFORE/AFTER INDEX COMPARISON - Most Valuable Experiment');
  console.log('='.repeat(90));

  console.log(`\n📌 Query: ${queryDescription}`);
  console.log(`   Filter: { user: "user1" }`);
  console.log(`   Sort:   { dueDate: 1 }`);

  // ============================
  // BEFORE: WITHOUT INDEXES
  // ============================
  console.log(`\n${'─'.repeat(90)}`);
  console.log('❌ PHASE 1: WITHOUT INDEXES (COLLSCAN)');
  console.log('─'.repeat(90));

  await dropAllIndexes();

  console.log('\n⏱️  Measuring query performance WITHOUT indexes...');
  const beforeResult = await measureSingleQuery(queryDescription, queryFilter, sortOption);

  if (beforeResult) {
    console.log(`\n📊 BEFORE Results:`);
    console.log(`   Execution Time:    ${beforeResult.executionTime}ms`);
    console.log(`   Documents Scanned: ${beforeResult.totalDocsExamined.toLocaleString()}`);
    console.log(`   Index Keys Used:   ${beforeResult.totalKeysExamined}`);
    console.log(`   Execution Stage:   ${beforeResult.stage} ❌ (Full collection scan)`);
  }

  // Add delay to let MongoDB settle
  await new Promise(resolve => setTimeout(resolve, 1000));

  // ============================
  // AFTER: WITH INDEXES
  // ============================
  console.log(`\n${'─'.repeat(90)}`);
  console.log('✅ PHASE 2: WITH INDEXES (IXSCAN)');
  console.log('─'.repeat(90));

  await createAllIndexes();

  console.log('\n⏱️  Measuring query performance WITH indexes...');
  // Give indexes time to be built
  await new Promise(resolve => setTimeout(resolve, 2000));

  const afterResult = await measureSingleQuery(queryDescription, queryFilter, sortOption);

  if (afterResult) {
    console.log(`\n📊 AFTER Results:`);
    console.log(`   Execution Time:    ${afterResult.executionTime}ms`);
    console.log(`   Documents Scanned: ${afterResult.totalDocsExamined.toLocaleString()}`);
    console.log(`   Index Keys Used:   ${afterResult.totalKeysExamined}`);
    console.log(`   Execution Stage:   ${afterResult.stage} ✅ (Index scan)`);
  }

  // ============================
  // COMPARISON & CALCULATION
  // ============================
  if (beforeResult && afterResult) {
    console.log(`\n${'='.repeat(90)}`);
    console.log('📈 IMPROVEMENT ANALYSIS - Section 13');
    console.log('='.repeat(90));

    // Calculate improvements
    const timeImprovement = ((beforeResult.executionTime - afterResult.executionTime) / beforeResult.executionTime * 100);
    const docsReduction = ((beforeResult.totalDocsExamined - afterResult.totalDocsExamined) / beforeResult.totalDocsExamined * 100);
    
    const timeSpeedup = (beforeResult.executionTime / afterResult.executionTime).toFixed(2);
    const docsSpeedup = (beforeResult.totalDocsExamined / afterResult.totalDocsExamined).toFixed(2);

    console.log(`\n┌─────────────────────────────┬──────────────┬──────────────┬──────────────┐`);
    console.log(`│ Metric                      │ Before       │ After        │ Improvement  │`);
    console.log(`├─────────────────────────────┼──────────────┼──────────────┼──────────────┤`);
    console.log(`│ Execution Time              │ ${String(beforeResult.executionTime).padEnd(11)} ms │ ${String(afterResult.executionTime).padEnd(11)} ms │ ${timeImprovement.toFixed(1).padEnd(11)}% │`);
    console.log(`│ Documents Examined          │ ${String(beforeResult.totalDocsExamined).padEnd(11)} │ ${String(afterResult.totalDocsExamined).padEnd(11)} │ ${docsReduction.toFixed(1).padEnd(11)}% │`);
    console.log(`│ Execution Stage             │ ${beforeResult.stage.padEnd(11)} │ ${afterResult.stage.padEnd(11)} │ Better       │`);
    console.log(`└─────────────────────────────┴──────────────┴──────────────┴──────────────┘`);

    console.log(`\n🎯 Key Findings:\n`);
    console.log(`   ⏱️  Query Speedup: ${timeSpeedup}x faster`);
    console.log(`   📄 Document Reduction: ${docsSpeedup}x fewer docs scanned`);
    console.log(`   📊 Time Saved: ${(beforeResult.executionTime - afterResult.executionTime)}ms per query`);
    
    // Calculate annual impact
    const queriesPerDay = 1000; // Conservative estimate
    const annualTimeSaved = ((beforeResult.executionTime - afterResult.executionTime) / 1000 * queriesPerDay * 365) / 3600; // Convert to hours
    console.log(`   💰 Annual Time Saved: ${annualTimeSaved.toFixed(1)} hours (at 1K queries/day)`);

    console.log(`\n✅ Official Statement:\n`);
    console.log(`   "Reduced query latency by ${timeImprovement.toFixed(1)}% - from ${beforeResult.executionTime}ms to ${afterResult.executionTime}ms"`);
    console.log(`   "Reduced documents examined by ${docsReduction.toFixed(1)}% - from ${beforeResult.totalDocsExamined.toLocaleString()} to ${afterResult.totalDocsExamined.toLocaleString()}"`);
    console.log(`   "Achieved ${timeSpeedup}x performance improvement through database indexing"`);
  }

  console.log(`\n${'='.repeat(90)}`);
  console.log('✅ Before/After comparison complete!');
  console.log('='.repeat(90));
}

/**
 * Main execution
 */
async function main() {
  await connectDB();
  await createSampleData();
  await testQuery();
  await mongoose.connection.close();
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
