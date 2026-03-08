-- Migration 009: Insights Engine
-- Description: Create tables for AI-generated and rule-based insights
-- Supports the intelligence feed with source tracking and user feedback

-- =================================================================
-- INSIGHTS
-- =================================================================

CREATE TABLE insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Classification
  insight_type TEXT NOT NULL CHECK (insight_type IN ('spending', 'portfolio', 'market', 'tax', 'credit')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('critical', 'high', 'medium', 'low')),

  -- Content
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  recommended_action TEXT,
  explanation TEXT, -- Detailed explanation/reasoning

  -- Impact
  estimated_impact_amount NUMERIC(15, 2), -- Dollar value of following action
  confidence_score NUMERIC(3, 2), -- 0.85 = 85% confidence

  -- Source
  source_type TEXT CHECK (source_type IN ('rule_based', 'ai_generated', 'external')),
  rule_id UUID, -- If from a rule

  -- Entity references (for drill-down)
  related_entity_type TEXT, -- 'holding', 'account', 'transaction', 'filing'
  related_entity_ids TEXT[], -- Array of related IDs

  -- User interaction
  is_dismissed BOOLEAN DEFAULT FALSE,
  is_useful BOOLEAN,
  user_feedback TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ -- Insights can have expiry
);

-- Indexes
CREATE INDEX idx_insights_user_id ON insights(user_id);
CREATE INDEX idx_insights_type ON insights(insight_type);
CREATE INDEX idx_insights_priority ON insights(priority);
CREATE INDEX idx_insights_created ON insights(created_at DESC);
CREATE INDEX idx_insights_dismissed ON insights(is_dismissed) WHERE is_dismissed = FALSE;

-- Comments
COMMENT ON TABLE insights IS 'AI-generated and rule-based financial insights for users';
COMMENT ON COLUMN insights.estimated_impact_amount IS 'Potential dollar impact if user acts on insight';
COMMENT ON COLUMN insights.confidence_score IS 'Confidence in insight (0-1 scale)';
COMMENT ON COLUMN insights.related_entity_ids IS 'Array of UUIDs for related entities (holdings, accounts, etc.)';

-- =================================================================
-- INSIGHT SOURCES
-- =================================================================

CREATE TABLE insight_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  insight_id UUID NOT NULL REFERENCES insights(id) ON DELETE CASCADE,

  source_type TEXT NOT NULL, -- 'market_news', 'sec_filing', 'holding', 'transaction'
  source_id UUID, -- ID of the source entity
  source_url TEXT,
  source_metadata JSONB, -- Additional context

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_insight_sources_insight_id ON insight_sources(insight_id);
CREATE INDEX idx_insight_sources_type ON insight_sources(source_type);

-- Comments
COMMENT ON TABLE insight_sources IS 'Links insights to their source data for transparency and drill-down';
COMMENT ON COLUMN insight_sources.source_metadata IS 'Additional context about the source';

-- =================================================================
-- INSIGHT RULES
-- =================================================================

CREATE TABLE insight_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  rule_name TEXT NOT NULL UNIQUE,
  rule_description TEXT,

  -- Rule definition (SQL or logic)
  rule_query TEXT, -- SQL query or condition
  rule_logic JSONB, -- Structured rule definition

  insight_template JSONB, -- Template for generating insight

  is_active BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_insight_rules_active ON insight_rules(is_active) WHERE is_active = TRUE;

-- Comments
COMMENT ON TABLE insight_rules IS 'Automated insight generation rules (system-managed)';
COMMENT ON COLUMN insight_rules.rule_query IS 'SQL query to evaluate if rule should trigger';
COMMENT ON COLUMN insight_rules.insight_template IS 'JSONB template for generating insight content';

-- =================================================================
-- TRIGGERS
-- =================================================================

-- Trigger for insight_rules updated_at
CREATE TRIGGER update_insight_rules_updated_at
    BEFORE UPDATE ON insight_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
