-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- USERS
-- ============================================================
CREATE TYPE user_plan AS ENUM ('starter', 'pro', 'enterprise');

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  plan user_plan NOT NULL DEFAULT 'starter',
  stripe_customer_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own record" ON users
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own record" ON users
  FOR UPDATE USING (auth.uid() = id);

-- ============================================================
-- BUSINESSES
-- ============================================================
CREATE TABLE businesses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  industry TEXT,
  description TEXT,
  goals TEXT[] NOT NULL DEFAULT '{}',
  timezone TEXT NOT NULL DEFAULT 'UTC',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT name_not_empty CHECK (char_length(name) > 0)
);

ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own businesses" ON businesses
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_businesses_user_id ON businesses(user_id);

-- ============================================================
-- TEAM MEMBERS
-- ============================================================
CREATE TYPE team_role AS ENUM ('owner', 'admin', 'member', 'viewer');

CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role team_role NOT NULL DEFAULT 'member',
  invited_email TEXT,
  invite_token TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team members can read own business team" ON team_members
  FOR SELECT USING (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
      UNION
      SELECT business_id FROM team_members WHERE user_id = auth.uid()
    )
  );
CREATE POLICY "Owners and admins can manage team" ON team_members
  FOR ALL USING (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
      UNION
      SELECT business_id FROM team_members
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE INDEX idx_team_members_business_id ON team_members(business_id);
CREATE INDEX idx_team_members_user_id ON team_members(user_id);

-- ============================================================
-- CONNECTED ACCOUNTS
-- ============================================================
CREATE TYPE connected_platform AS ENUM (
  'google_analytics', 'instagram', 'facebook',
  'tiktok', 'linkedin', 'twitter', 'google_ads', 'meta_ads'
);

CREATE TABLE connected_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  platform connected_platform NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  account_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  expires_at TIMESTAMPTZ,
  CONSTRAINT platform_not_empty CHECK (account_name IS NULL OR char_length(account_name) > 0)
);

ALTER TABLE connected_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Business members can read connected accounts" ON connected_accounts
  FOR SELECT USING (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
      UNION
      SELECT business_id FROM team_members WHERE user_id = auth.uid()
    )
  );
CREATE POLICY "Owners and admins can manage connected accounts" ON connected_accounts
  FOR ALL USING (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
      UNION
      SELECT business_id FROM team_members
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE INDEX idx_connected_accounts_business_id ON connected_accounts(business_id);

-- ============================================================
-- AI MEMORIES
-- ============================================================
CREATE TYPE memory_type AS ENUM ('fact', 'preference', 'goal', 'event', 'insight');

CREATE TABLE ai_memories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  memory_type memory_type NOT NULL,
  content TEXT NOT NULL,
  pinecone_id TEXT,
  importance_score FLOAT NOT NULL DEFAULT 0.5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE ai_memories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Business members can read memories" ON ai_memories
  FOR SELECT USING (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
      UNION
      SELECT business_id FROM team_members WHERE user_id = auth.uid()
    )
  );
CREATE POLICY "Owners and admins can manage memories" ON ai_memories
  FOR ALL USING (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
      UNION
      SELECT business_id FROM team_members
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE INDEX idx_ai_memories_business_id ON ai_memories(business_id);
CREATE INDEX idx_ai_memories_type ON ai_memories(memory_type);

-- ============================================================
-- DAILY REPORTS
-- ============================================================
CREATE TABLE daily_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  report_date DATE NOT NULL,
  content JSONB NOT NULL DEFAULT '{}',
  summary TEXT NOT NULL DEFAULT '',
  key_insights TEXT[] NOT NULL DEFAULT '{}',
  action_items TEXT[] NOT NULL DEFAULT '{}',
  sent_at TIMESTAMPTZ,
  UNIQUE(business_id, report_date)
);

ALTER TABLE daily_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Business members can read reports" ON daily_reports
  FOR SELECT USING (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
      UNION
      SELECT business_id FROM team_members WHERE user_id = auth.uid()
    )
  );
CREATE POLICY "System can insert reports" ON daily_reports
  FOR INSERT WITH CHECK (TRUE);

CREATE INDEX idx_daily_reports_business_date ON daily_reports(business_id, report_date DESC);

-- ============================================================
-- AI ACTIONS (APPROVAL QUEUE)
-- ============================================================
CREATE TYPE action_status AS ENUM (
  'pending_approval', 'approved', 'rejected', 'executed', 'failed'
);

CREATE TABLE ai_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  description TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  status action_status NOT NULL DEFAULT 'pending_approval',
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  executed_at TIMESTAMPTZ
);

ALTER TABLE ai_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Business members can read ai actions" ON ai_actions
  FOR SELECT USING (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
      UNION
      SELECT business_id FROM team_members WHERE user_id = auth.uid()
    )
  );
CREATE POLICY "Members can approve/reject actions" ON ai_actions
  FOR UPDATE USING (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
      UNION
      SELECT business_id FROM team_members
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'member')
    )
  );

CREATE INDEX idx_ai_actions_business_status ON ai_actions(business_id, status);
CREATE INDEX idx_ai_actions_created_at ON ai_actions(created_at DESC);

-- ============================================================
-- SUPPORT TICKETS
-- ============================================================
CREATE TYPE ticket_sentiment AS ENUM ('positive', 'neutral', 'frustrated', 'angry');
CREATE TYPE ticket_status AS ENUM ('open', 'ai_replied', 'escalated', 'resolved');

CREATE TABLE support_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  platform TEXT NOT NULL,
  message TEXT NOT NULL,
  sentiment ticket_sentiment NOT NULL DEFAULT 'neutral',
  status ticket_status NOT NULL DEFAULT 'open',
  ai_response TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Business members can read support tickets" ON support_tickets
  FOR SELECT USING (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
      UNION
      SELECT business_id FROM team_members WHERE user_id = auth.uid()
    )
  );
CREATE POLICY "Members can manage support tickets" ON support_tickets
  FOR ALL USING (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
      UNION
      SELECT business_id FROM team_members
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'member')
    )
  );

CREATE INDEX idx_support_tickets_business_id ON support_tickets(business_id);
CREATE INDEX idx_support_tickets_status ON support_tickets(status);
CREATE INDEX idx_support_tickets_sentiment ON support_tickets(sentiment);
CREATE INDEX idx_support_tickets_created_at ON support_tickets(created_at DESC);

-- ============================================================
-- LEADS (CRM)
-- ============================================================
CREATE TYPE lead_status AS ENUM ('new', 'contacted', 'qualified', 'converted', 'lost');

CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  company TEXT,
  source TEXT,
  status lead_status NOT NULL DEFAULT 'new',
  notes TEXT,
  lead_score SMALLINT CHECK (lead_score BETWEEN 1 AND 10),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_contacted_at TIMESTAMPTZ
);

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Business members can read leads" ON leads
  FOR SELECT USING (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
      UNION
      SELECT business_id FROM team_members WHERE user_id = auth.uid()
    )
  );
CREATE POLICY "Members can manage leads" ON leads
  FOR ALL USING (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
      UNION
      SELECT business_id FROM team_members
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'member')
    )
  );

CREATE INDEX idx_leads_business_id ON leads(business_id);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_created_at ON leads(created_at DESC);

-- ============================================================
-- TASKS
-- ============================================================
CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE task_status AS ENUM ('todo', 'in_progress', 'done');

CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  priority task_priority NOT NULL DEFAULT 'medium',
  status task_status NOT NULL DEFAULT 'todo',
  due_date TIMESTAMPTZ,
  created_by_ai BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Business members can read tasks" ON tasks
  FOR SELECT USING (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
      UNION
      SELECT business_id FROM team_members WHERE user_id = auth.uid()
    )
  );
CREATE POLICY "Members can manage tasks" ON tasks
  FOR ALL USING (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
      UNION
      SELECT business_id FROM team_members
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'member')
    )
  );

CREATE INDEX idx_tasks_business_id ON tasks(business_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);

-- ============================================================
-- CONTENT POSTS
-- ============================================================
CREATE TYPE post_status AS ENUM ('draft', 'scheduled', 'published', 'failed');

CREATE TABLE content_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  content TEXT NOT NULL,
  media_urls TEXT[] NOT NULL DEFAULT '{}',
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  status post_status NOT NULL DEFAULT 'draft',
  ai_generated BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT content_not_empty CHECK (char_length(content) > 0)
);

ALTER TABLE content_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Business members can read content posts" ON content_posts
  FOR SELECT USING (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
      UNION
      SELECT business_id FROM team_members WHERE user_id = auth.uid()
    )
  );
CREATE POLICY "Members can manage content posts" ON content_posts
  FOR ALL USING (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
      UNION
      SELECT business_id FROM team_members
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'member')
    )
  );

CREATE INDEX idx_content_posts_business_id ON content_posts(business_id);
CREATE INDEX idx_content_posts_status ON content_posts(status);
CREATE INDEX idx_content_posts_scheduled_at ON content_posts(scheduled_at)
  WHERE status = 'scheduled';

-- ============================================================
-- AI USAGE LOG
-- ============================================================
CREATE TABLE ai_usage_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  tokens_used INTEGER NOT NULL DEFAULT 0,
  cost_usd NUMERIC(10, 6) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE ai_usage_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Business owners can read usage" ON ai_usage_log
  FOR SELECT USING (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
      UNION
      SELECT business_id FROM team_members
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE INDEX idx_ai_usage_log_business_id ON ai_usage_log(business_id);
CREATE INDEX idx_ai_usage_log_created_at ON ai_usage_log(created_at DESC);

-- ============================================================
-- AI COST LOG
-- ============================================================
CREATE TABLE ai_cost_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID REFERENCES businesses(id) ON DELETE SET NULL,
  provider TEXT NOT NULL CHECK (provider IN ('anthropic', 'openai')),
  model TEXT NOT NULL,
  tokens_in INTEGER NOT NULL DEFAULT 0,
  tokens_out INTEGER NOT NULL DEFAULT 0,
  cost_usd NUMERIC(10, 6) NOT NULL DEFAULT 0,
  feature TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE ai_cost_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read cost log" ON ai_cost_log
  FOR SELECT USING (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
    )
  );

CREATE INDEX idx_ai_cost_log_created_at ON ai_cost_log(created_at DESC);
CREATE INDEX idx_ai_cost_log_business_id ON ai_cost_log(business_id);

-- ============================================================
-- AUDIT LOG
-- ============================================================
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  actor TEXT NOT NULL CHECK (actor IN ('user', 'ai')),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Business members can read audit log" ON audit_log
  FOR SELECT USING (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
      UNION
      SELECT business_id FROM team_members WHERE user_id = auth.uid()
    )
  );

CREATE INDEX idx_audit_log_business_id ON audit_log(business_id);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at DESC);

-- ============================================================
-- USER ONBOARDING
-- ============================================================
CREATE TABLE user_onboarding (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  step_completed SMALLINT NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  skipped_steps INTEGER[] NOT NULL DEFAULT '{}',
  reminder_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE user_onboarding ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own onboarding" ON user_onboarding
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- PROMPTS (versioned AI prompts)
-- ============================================================
CREATE TABLE prompts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  content TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(name, version)
);

ALTER TABLE prompts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read active prompts" ON prompts
  FOR SELECT USING (auth.role() = 'authenticated' AND is_active = TRUE);

-- ============================================================
-- FAILED API CALL LOG
-- ============================================================
CREATE TABLE failed_api_calls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  error_code TEXT,
  error_message TEXT,
  endpoint TEXT,
  retry_count SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE failed_api_calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Business owners can read failed calls" ON failed_api_calls
  FOR SELECT USING (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
    )
  );

CREATE INDEX idx_failed_api_calls_business_id ON failed_api_calls(business_id);

-- ============================================================
-- SEED: default prompts
-- ============================================================
INSERT INTO prompts (name, version, content, is_active) VALUES
(
  'daily_ceo_report',
  1,
  'You are the AI Chief of Staff for {{business_name}}. You have deep knowledge of this business: {{memories}}. Generate a structured CEO morning briefing based on the following data: {{data}}. Format the response as JSON with these keys: executive_summary (string), revenue_financial (string), marketing_performance (string), customer_support (string), growth_opportunities (string), priority_actions (array of strings, max 5).',
  TRUE
),
(
  'support_sentiment',
  1,
  'Analyze the sentiment of this customer support message and classify it as exactly one of: positive, neutral, frustrated, angry. Message: {{message}}. Respond with only the sentiment word.',
  TRUE
),
(
  'support_reply_suggestions',
  1,
  'You are a customer support AI for {{business_name}}. Business context: {{memories}}. Generate 3 different reply options for this customer message: {{message}}. Customer sentiment: {{sentiment}}. Format as JSON array with objects containing: tone (string), reply (string).',
  TRUE
),
(
  'lead_scoring',
  1,
  'Score this lead from 1-10 based on fit with {{business_name}} goals and target customer profile. Business context: {{memories}}. Lead info: {{lead_info}}. Respond with JSON: score (number 1-10), reasoning (string).',
  TRUE
),
(
  'memory_extraction',
  1,
  'Extract key business facts from this text and categorize them. Text: {{text}}. Return a JSON array where each item has: memory_type (fact|preference|goal|event|insight), content (string), importance_score (0.0-1.0).',
  TRUE
),
(
  'post_generator',
  1,
  'You are a social media content creator for {{business_name}}. Business context: {{memories}}. Generate a {{platform}} post about: {{topic}}. Tone: {{tone}}. Character limit: {{char_limit}}. Return only the post text.',
  TRUE
),
(
  'lead_followup',
  1,
  'Generate a personalized follow-up message for a lead that has not been contacted in {{days}} days. Business: {{business_name}}. Lead info: {{lead_info}}. Keep it concise, human, and relevant. Return only the message text.',
  TRUE
);
