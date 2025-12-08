-- Add Vector Embeddings for Semantic Search
-- This migration adds pgvector support for AI-powered semantic search

-- =============================================================================
-- Enable pgvector Extension
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- =============================================================================
-- Add Embedding Columns
-- =============================================================================

-- Add embedding column to tools table (1536 dimensions for OpenAI text-embedding-3-small)
ALTER TABLE public.tools
  ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- =============================================================================
-- Create Indexes for Vector Similarity Search
-- =============================================================================

-- Create index for cosine similarity search on tools
-- Using HNSW for better accuracy (can switch to ivfflat for faster builds on large datasets)
CREATE INDEX IF NOT EXISTS idx_tools_embedding ON tools
  USING hnsw (embedding vector_cosine_ops);

-- =============================================================================
-- Helper Functions
-- =============================================================================

-- Function to search tools by semantic similarity
CREATE OR REPLACE FUNCTION search_tools_semantic(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.3,
  match_count int DEFAULT 20
)
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  tags text[],
  total_downloads integer,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.name,
    t.description,
    t.tags,
    t.total_downloads,
    1 - (t.embedding <=> query_embedding) as similarity
  FROM tools t
  WHERE t.embedding IS NOT NULL
    AND 1 - (t.embedding <=> query_embedding) > match_threshold
  ORDER BY t.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Hybrid search combining full-text and semantic search
CREATE OR REPLACE FUNCTION search_tools_hybrid(
  query_text text,
  query_embedding vector(1536),
  text_weight float DEFAULT 0.3,
  semantic_weight float DEFAULT 0.7,
  match_count int DEFAULT 20
)
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  tags text[],
  total_downloads integer,
  combined_score float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH text_results AS (
    SELECT
      t.id,
      t.name,
      t.description,
      t.tags,
      t.total_downloads,
      GREATEST(
        similarity(LOWER(t.name), LOWER(query_text)),
        similarity(COALESCE(LOWER(t.description), ''), LOWER(query_text))
      ) as text_score
    FROM tools t
    WHERE 
      t.name ILIKE '%' || query_text || '%'
      OR t.description ILIKE '%' || query_text || '%'
      OR EXISTS (SELECT 1 FROM unnest(t.tags) tag WHERE tag ILIKE '%' || query_text || '%')
  ),
  semantic_results AS (
    SELECT
      t.id,
      t.name,
      t.description,
      t.tags,
      t.total_downloads,
      1 - (t.embedding <=> query_embedding) as semantic_score
    FROM tools t
    WHERE t.embedding IS NOT NULL
  )
  SELECT
    COALESCE(tr.id, sr.id) as id,
    COALESCE(tr.name, sr.name) as name,
    COALESCE(tr.description, sr.description) as description,
    COALESCE(tr.tags, sr.tags) as tags,
    COALESCE(tr.total_downloads, sr.total_downloads) as total_downloads,
    (
      COALESCE(tr.text_score, 0) * text_weight +
      COALESCE(sr.semantic_score, 0) * semantic_weight
    ) as combined_score
  FROM text_results tr
  FULL OUTER JOIN semantic_results sr ON tr.id = sr.id
  WHERE (
    COALESCE(tr.text_score, 0) * text_weight +
    COALESCE(sr.semantic_score, 0) * semantic_weight
  ) > 0.1
  ORDER BY combined_score DESC
  LIMIT match_count;
END;
$$;

-- =============================================================================
-- Comments
-- =============================================================================

COMMENT ON COLUMN tools.embedding IS 'Vector embedding for semantic search (OpenAI text-embedding-3-small, 1536 dimensions)';
COMMENT ON FUNCTION search_tools_semantic IS 'Search tools by semantic similarity using vector embeddings';
COMMENT ON FUNCTION search_tools_hybrid IS 'Hybrid search combining text matching and semantic similarity';
