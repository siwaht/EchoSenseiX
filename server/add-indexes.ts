import { db } from "./db";
import { sql } from "drizzle-orm";

async function addPerformanceIndexes() {
  console.log("Adding performance indexes to database...");
  
  try {
    const database = db();
    
    // Add indexes for frequently queried columns
    const indexes = [
      // Users table indexes
      "CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)",
      "CREATE INDEX IF NOT EXISTS idx_users_organization_id ON users(organization_id)",
      "CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC)",
      
      // Agents table indexes
      "CREATE INDEX IF NOT EXISTS idx_agents_organization_id ON agents(organization_id)",
      "CREATE INDEX IF NOT EXISTS idx_agents_user_id ON agents(user_id)",
      "CREATE INDEX IF NOT EXISTS idx_agents_created_at ON agents(created_at DESC)",
      "CREATE INDEX IF NOT EXISTS idx_agents_elevenlabs_agent_id ON agents(elevenlabs_agent_id)",
      
      // Call logs table indexes
      "CREATE INDEX IF NOT EXISTS idx_call_logs_organization_id ON call_logs(organization_id)",
      "CREATE INDEX IF NOT EXISTS idx_call_logs_agent_id ON call_logs(agent_id)",
      "CREATE INDEX IF NOT EXISTS idx_call_logs_user_id ON call_logs(user_id)",
      "CREATE INDEX IF NOT EXISTS idx_call_logs_created_at ON call_logs(created_at DESC)",
      "CREATE INDEX IF NOT EXISTS idx_call_logs_status ON call_logs(status)",
      "CREATE INDEX IF NOT EXISTS idx_call_logs_call_id ON call_logs(call_id)",
      
      // Composite indexes for common queries
      "CREATE INDEX IF NOT EXISTS idx_call_logs_org_created ON call_logs(organization_id, created_at DESC)",
      "CREATE INDEX IF NOT EXISTS idx_call_logs_org_agent ON call_logs(organization_id, agent_id)",
      "CREATE INDEX IF NOT EXISTS idx_agents_org_user ON agents(organization_id, user_id)",
      
      // Knowledge base indexes
      "CREATE INDEX IF NOT EXISTS idx_knowledge_base_entries_organization_id ON knowledge_base_entries(organization_id)",
      "CREATE INDEX IF NOT EXISTS idx_knowledge_base_entries_agent_id ON knowledge_base_entries(agent_id)",
      "CREATE INDEX IF NOT EXISTS idx_knowledge_base_entries_created_at ON knowledge_base_entries(created_at DESC)",
      
      // Integrations indexes
      "CREATE INDEX IF NOT EXISTS idx_integrations_organization_id ON integrations(organization_id)",
      "CREATE INDEX IF NOT EXISTS idx_integrations_user_id ON integrations(user_id)",
      "CREATE INDEX IF NOT EXISTS idx_integrations_provider ON integrations(provider)",
      
      // Phone numbers indexes
      "CREATE INDEX IF NOT EXISTS idx_phone_numbers_organization_id ON phone_numbers(organization_id)",
      "CREATE INDEX IF NOT EXISTS idx_phone_numbers_number ON phone_numbers(number)",
      "CREATE INDEX IF NOT EXISTS idx_phone_numbers_agent_id ON phone_numbers(agent_id)",
      
      // Billing indexes
      "CREATE INDEX IF NOT EXISTS idx_billing_plans_organization_id ON billing_plans(organization_id)",
      "CREATE INDEX IF NOT EXISTS idx_payment_history_organization_id ON payment_history(organization_id)",
      "CREATE INDEX IF NOT EXISTS idx_payment_history_created_at ON payment_history(created_at DESC)",
      
      // Whitelabel indexes
      "CREATE INDEX IF NOT EXISTS idx_whitelabel_configs_organization_id ON whitelabel_configs(organization_id)",
      "CREATE INDEX IF NOT EXISTS idx_whitelabel_configs_subdomain ON whitelabel_configs(subdomain)",
      
      // Analytics indexes
      "CREATE INDEX IF NOT EXISTS idx_analytics_organization_id ON analytics(organization_id)",
      "CREATE INDEX IF NOT EXISTS idx_analytics_created_at ON analytics(created_at DESC)",
      "CREATE INDEX IF NOT EXISTS idx_analytics_event_type ON analytics(event_type)",
      
      // Full-text search indexes for transcript search
      "CREATE INDEX IF NOT EXISTS idx_call_logs_transcript_gin ON call_logs USING gin(to_tsvector('english', transcript))",
      "CREATE INDEX IF NOT EXISTS idx_knowledge_base_content_gin ON knowledge_base_entries USING gin(to_tsvector('english', content))",
    ];
    
    // Execute each index creation
    for (const indexSql of indexes) {
      try {
        await database.execute(sql.raw(indexSql));
        console.log(`✓ Created index: ${indexSql.match(/idx_\w+/)?.[0]}`);
      } catch (error: any) {
        if (error.message?.includes('already exists')) {
          console.log(`- Index already exists: ${indexSql.match(/idx_\w+/)?.[0]}`);
        } else {
          console.error(`✗ Failed to create index: ${indexSql.match(/idx_\w+/)?.[0]}`, error.message);
        }
      }
    }
    
    // Analyze tables for query planner optimization
    const tables = [
      'users', 'agents', 'call_logs', 'knowledge_base_entries',
      'integrations', 'phone_numbers', 'billing_plans', 'payment_history',
      'whitelabel_configs', 'analytics'
    ];
    
    for (const table of tables) {
      try {
        await database.execute(sql.raw(`ANALYZE ${table}`));
        console.log(`✓ Analyzed table: ${table}`);
      } catch (error: any) {
        console.log(`- Table ${table} may not exist yet`);
      }
    }
    
    console.log("\n✅ Performance indexes added successfully!");
    console.log("Note: Run this script periodically to ensure indexes are up to date.");
    
  } catch (error) {
    console.error("Error adding indexes:", error);
    process.exit(1);
  }
  
  process.exit(0);
}

// Run the migration
addPerformanceIndexes();
