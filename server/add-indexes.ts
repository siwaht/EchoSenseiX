import { db } from './db';
import { sql } from 'drizzle-orm';

async function addPerformanceIndexes() {
  console.log('🚀 Adding performance indexes to database...');

  try {
    // User indexes
    await db().execute(sql`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email ON users(email);
    `);
    await db().execute(sql`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_organization_id ON users(organization_id);
    `);
    await db().execute(sql`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_user_type ON users(user_type);
    `);
    await db().execute(sql`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_is_admin ON users(is_admin);
    `);

    // Agent indexes
    await db().execute(sql`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agents_organization_id ON agents(organization_id);
    `);
    await db().execute(sql`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agents_eleven_labs_id ON agents(eleven_labs_agent_id);
    `);
    await db().execute(sql`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agents_user_id ON agents(user_id);
    `);
    await db().execute(sql`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agents_org_user ON agents(organization_id, user_id);
    `);

    // Call logs indexes
    await db().execute(sql`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_call_logs_organization_id ON call_logs(organization_id);
    `);
    await db().execute(sql`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_call_logs_agent_id ON call_logs(agent_id);
    `);
    await db().execute(sql`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_call_logs_created_at ON call_logs(created_at DESC);
    `);
    await db().execute(sql`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_call_logs_org_created ON call_logs(organization_id, created_at DESC);
    `);
    await db().execute(sql`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_call_logs_status ON call_logs(status);
    `);
    await db().execute(sql`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_call_logs_org_agent ON call_logs(organization_id, agent_id);
    `);

    // Integration indexes
    await db().execute(sql`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_integrations_organization_id ON integrations(organization_id);
    `);
    await db().execute(sql`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_integrations_provider ON integrations(provider);
    `);
    await db().execute(sql`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_integrations_status ON integrations(status);
    `);
    await db().execute(sql`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_integrations_org_provider ON integrations(organization_id, provider);
    `);

    // User agents indexes (for role-based access)
    await db().execute(sql`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_agents_user_id ON user_agents(user_id);
    `);
    await db().execute(sql`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_agents_agent_id ON user_agents(agent_id);
    `);

    // Organization indexes
    await db().execute(sql`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_organizations_subdomain ON organizations(subdomain);
    `);
    await db().execute(sql`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_organizations_custom_domain ON organizations(custom_domain);
    `);
    await db().execute(sql`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_organizations_parent_id ON organizations(parent_organization_id);
    `);
    await db().execute(sql`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_organizations_type ON organizations(organization_type);
    `);

    // Payment and billing indexes
    await db().execute(sql`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_organization_id ON payments(organization_id);
    `);
    await db().execute(sql`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_created_at ON payments(created_at DESC);
    `);

    // Credit transaction indexes
    await db().execute(sql`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_credit_transactions_org_id ON credit_transactions(organization_id);
    `);
    await db().execute(sql`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_credit_transactions_created ON credit_transactions(created_at DESC);
    `);

    console.log('✅ Successfully added all performance indexes');
    console.log('\n📊 Indexes added for:');
    console.log('   - Users: email, organization_id, user_type, is_admin');
    console.log('   - Agents: organization_id, eleven_labs_agent_id, user_id, composite');
    console.log('   - Call Logs: organization_id, agent_id, created_at, status, composites');
    console.log('   - Integrations: organization_id, provider, status, composite');
    console.log('   - User Agents: user_id, agent_id');
    console.log('   - Organizations: subdomain, custom_domain, parent_organization_id, type');
    console.log('   - Payments: from_organization_id, created_at');
    console.log('   - Credit Transactions: organization_id, created_at');

  } catch (error) {
    console.error('❌ Error adding indexes:', error);
    throw error;
  }
}

// Run the index creation
addPerformanceIndexes()
  .then(() => {
    console.log('\n✨ Database optimization completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed to add indexes:', error);
    process.exit(1);
  });