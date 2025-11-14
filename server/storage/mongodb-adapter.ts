/**
 * MongoDB Storage Adapter
 *
 * Provides MongoDB-compatible operations that work alongside Drizzle ORM
 * This adapter bridges SQL-style operations to MongoDB collections
 */

import { Db, Collection, ObjectId } from 'mongodb';
import { getMongoDb } from '../db';

export class MongoDBAdapter {
  private db: Db | null = null;

  async getDb(): Promise<Db> {
    if (!this.db) {
      this.db = await getMongoDb();
      if (!this.db) {
        throw new Error('MongoDB is not configured');
      }
    }
    return this.db;
  }

  async getCollection<T = any>(name: string): Promise<Collection<T>> {
    const db = await this.getDb();
    return db.collection<T>(name);
  }

  // User operations
  async findUser(query: any) {
    const users = await this.getCollection('users');
    return await users.findOne(query);
  }

  async insertUser(userData: any) {
    const users = await this.getCollection('users');
    const result = await users.insertOne({
      ...userData,
      id: userData.id || new ObjectId().toString(),
      createdAt: new Date(),
      updatedAt: new Date()
    });
    return await users.findOne({ _id: result.insertedId });
  }

  async updateUser(id: string, updates: any) {
    const users = await this.getCollection('users');
    await users.updateOne(
      { id },
      { $set: { ...updates, updatedAt: new Date() } }
    );
    return await users.findOne({ id });
  }

  // Organization operations
  async findOrganization(query: any) {
    const orgs = await this.getCollection('organizations');
    return await orgs.findOne(query);
  }

  async insertOrganization(orgData: any) {
    const orgs = await this.getCollection('organizations');
    const result = await orgs.insertOne({
      ...orgData,
      id: orgData.id || new ObjectId().toString(),
      createdAt: new Date(),
      updatedAt: new Date()
    });
    return await orgs.findOne({ _id: result.insertedId });
  }

  // Agent operations
  async findAgents(query: any) {
    const agents = await this.getCollection('agents');
    return await agents.find(query).toArray();
  }

  async findAgent(query: any) {
    const agents = await this.getCollection('agents');
    return await agents.findOne(query);
  }

  async insertAgent(agentData: any) {
    const agents = await this.getCollection('agents');
    const result = await agents.insertOne({
      ...agentData,
      id: agentData.id || new ObjectId().toString(),
      createdAt: new Date(),
      updatedAt: new Date()
    });
    return await agents.findOne({ _id: result.insertedId });
  }

  async updateAgent(id: string, updates: any) {
    const agents = await this.getCollection('agents');
    await agents.updateOne(
      { id },
      { $set: { ...updates, updatedAt: new Date() } }
    );
    return await agents.findOne({ id });
  }

  async deleteAgent(id: string) {
    const agents = await this.getCollection('agents');
    await agents.deleteOne({ id });
  }

  // Integration operations
  async findIntegration(query: any) {
    const integrations = await this.getCollection('integrations');
    return await integrations.findOne(query);
  }

  async findIntegrations(query: any) {
    const integrations = await this.getCollection('integrations');
    return await integrations.find(query).toArray();
  }

  async upsertIntegration(integrationData: any) {
    const integrations = await this.getCollection('integrations');
    const { organizationId, provider } = integrationData;

    const result = await integrations.findOneAndUpdate(
      { organizationId, provider },
      {
        $set: {
          ...integrationData,
          updatedAt: new Date()
        },
        $setOnInsert: {
          id: new ObjectId().toString(),
          createdAt: new Date()
        }
      },
      { upsert: true, returnDocument: 'after' }
    );

    return result.value;
  }

  // Provider Integration operations
  async findProviderIntegrations(query: any) {
    const providers = await this.getCollection('provider_integrations');
    return await providers.find(query).toArray();
  }

  async findProviderIntegration(query: any) {
    const providers = await this.getCollection('provider_integrations');
    return await providers.findOne(query);
  }

  async insertProviderIntegration(data: any) {
    const providers = await this.getCollection('provider_integrations');
    const result = await providers.insertOne({
      ...data,
      id: data.id || new ObjectId().toString(),
      createdAt: new Date(),
      updatedAt: new Date()
    });
    return await providers.findOne({ _id: result.insertedId });
  }

  async updateProviderIntegration(id: string, updates: any) {
    const providers = await this.getCollection('provider_integrations');
    await providers.updateOne(
      { id },
      { $set: { ...updates, updatedAt: new Date() } }
    );
    return await providers.findOne({ id });
  }

  async deleteProviderIntegration(id: string) {
    const providers = await this.getCollection('provider_integrations');
    await providers.deleteOne({ id });
  }

  // Call log operations
  async insertCallLog(callData: any) {
    const callLogs = await this.getCollection('call_logs');
    const result = await callLogs.insertOne({
      ...callData,
      id: callData.id || new ObjectId().toString(),
      createdAt: new Date()
    });
    return await callLogs.findOne({ _id: result.insertedId });
  }

  async findCallLogs(query: any, limit = 100) {
    const callLogs = await this.getCollection('call_logs');
    return await callLogs.find(query).limit(limit).sort({ createdAt: -1 }).toArray();
  }

  // Knowledge base operations
  async findKnowledgeEntries(query: any) {
    const kb = await this.getCollection('knowledge_base_entries');
    return await kb.find(query).toArray();
  }

  async insertKnowledgeEntry(entry: any) {
    const kb = await this.getCollection('knowledge_base_entries');
    const result = await kb.insertOne({
      ...entry,
      id: entry.id || new ObjectId().toString(),
      createdAt: new Date(),
      updatedAt: new Date()
    });
    return await kb.findOne({ _id: result.insertedId });
  }

  async deleteKnowledgeEntry(id: string) {
    const kb = await this.getCollection('knowledge_base_entries');
    await kb.deleteOne({ id });
  }

  // Ensure indexes are created
  async ensureIndexes() {
    try {
      const db = await this.getDb();

      // Users indexes
      await db.collection('users').createIndex({ email: 1 }, { unique: true });
      await db.collection('users').createIndex({ organizationId: 1 });

      // Organizations indexes
      await db.collection('organizations').createIndex({ subdomain: 1 }, { unique: true, sparse: true });

      // Agents indexes
      await db.collection('agents').createIndex({ organizationId: 1 });
      await db.collection('agents').createIndex({ elevenLabsAgentId: 1 });
      await db.collection('agents').createIndex({ externalAgentId: 1 });

      // Integrations indexes
      await db.collection('integrations').createIndex({ organizationId: 1, provider: 1 }, { unique: true });

      // Provider integrations indexes
      await db.collection('provider_integrations').createIndex({ organizationId: 1 });
      await db.collection('provider_integrations').createIndex({ providerType: 1 });

      // Call logs indexes
      await db.collection('call_logs').createIndex({ organizationId: 1 });
      await db.collection('call_logs').createIndex({ agentId: 1 });
      await db.collection('call_logs').createIndex({ createdAt: -1 });

      // Knowledge base indexes
      await db.collection('knowledge_base_entries').createIndex({ organizationId: 1 });
      await db.collection('knowledge_base_entries').createIndex({ category: 1 });

      console.log('[MongoDB] Indexes created successfully');
    } catch (error) {
      console.error('[MongoDB] Error creating indexes:', error);
    }
  }
}

// Singleton instance
let mongoAdapter: MongoDBAdapter | null = null;

export function getMongoDBAdapter(): MongoDBAdapter {
  if (!mongoAdapter) {
    mongoAdapter = new MongoDBAdapter();
  }
  return mongoAdapter;
}
