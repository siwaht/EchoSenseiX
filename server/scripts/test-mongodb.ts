import { mongoDb, closeMongoDB } from '../mongodb';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testMongoDB() {
  try {
    console.log('[MongoDB Test] Testing MongoDB connection...');
    
    // Get database instance
    const db = mongoDb();
    
    // Test basic operations
    console.log('[MongoDB Test] Database name:', db.databaseName);
    
    // List collections
    const collections = await db.listCollections().toArray();
    console.log('[MongoDB Test] Available collections:', collections.map(c => c.name));
    
    // Test insert operation
    const testCollection = db.collection('test');
    const testDoc = {
      message: 'Hello from EchoSenseiX!',
      timestamp: new Date(),
      test: true
    };
    
    const insertResult = await testCollection.insertOne(testDoc);
    console.log('[MongoDB Test] Insert test document:', insertResult.insertedId);
    
    // Test find operation
    const foundDoc = await testCollection.findOne({ test: true });
    console.log('[MongoDB Test] Found test document:', foundDoc);
    
    // Clean up test document
    await testCollection.deleteOne({ _id: insertResult.insertedId });
    console.log('[MongoDB Test] Cleaned up test document');
    
    console.log('[MongoDB Test] MongoDB connection test successful!');
    
  } catch (error) {
    console.error('[MongoDB Test] Error testing MongoDB:', error);
    process.exit(1);
  } finally {
    await closeMongoDB();
  }
}

// Run the test
testMongoDB();
