-- Migration: Update hybrid search to respect visibility
-- Only public tools should appear in search results

CREATE OR REPLACE FUNCTION search_tools_hybrid(
  query_text text,
  query_embedding vector(1536),
  text_weight float DEFAULT 0.3,
  semantic_weight float DEFAULT 0.7,
  match_count int DEFAULT 20,
  match_threshold float DEFAULT 0.1
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
      t.visibility = 'public'  -- Only search public tools
      AND (
        t.name ILIKE '%' || query_text || '%'
        OR t.description ILIKE '%' || query_text || '%'
        OR EXISTS (SELECT 1 FROM unnest(t.tags) tag WHERE tag ILIKE '%' || query_text || '%')
      )
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
    WHERE 
      t.embedding IS NOT NULL
      AND t.visibility = 'public'  -- Only search public tools
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
  ) > match_threshold
  ORDER BY combined_score DESC
  LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION search_tools_hybrid(text, vector, float, float, int, float) IS 'Hybrid search combining text matching and semantic similarity - only searches public tools';
