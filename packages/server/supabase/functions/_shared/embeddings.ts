/**
 * OpenAI Embeddings Utility for Semantic Search
 * Uses text-embedding-3-small model (1536 dimensions)
 */

const OPENAI_API_URL = "https://api.openai.com/v1/embeddings";
const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536;

export interface EmbeddingResult {
  embedding: number[];
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

/**
 * Generate an embedding for a single text input
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY environment variable is not set");
  }

  // Prepare text: combine relevant fields, truncate if needed
  const preparedText = prepareTextForEmbedding(text);

  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: preparedText,
      dimensions: EMBEDDING_DIMENSIONS,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

/**
 * Generate embeddings for multiple texts in a batch
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY environment variable is not set");
  }

  const preparedTexts = texts.map(prepareTextForEmbedding);

  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: preparedTexts,
      dimensions: EMBEDDING_DIMENSIONS,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.data.map((d: { embedding: number[] }) => d.embedding);
}

/**
 * Create embedding text from tool metadata
 * Combines name, description, and tags into a searchable string
 */
export function createToolEmbeddingText(tool: {
  name: string;
  description?: string | null;
  tags?: string[] | null;
}): string {
  const parts: string[] = [];

  // Add tool name (extract short name from full path)
  const shortName = tool.name.split("/").pop() || tool.name;
  parts.push(`Tool: ${shortName}`);

  // Add description
  if (tool.description) {
    parts.push(`Description: ${tool.description}`);
  }

  // Add tags
  if (tool.tags && tool.tags.length > 0) {
    parts.push(`Tags: ${tool.tags.join(", ")}`);
  }

  return parts.join("\n");
}

/**
 * Prepare text for embedding generation
 * Handles truncation and normalization
 */
function prepareTextForEmbedding(text: string): string {
  // Normalize whitespace
  let prepared = text.replace(/\s+/g, " ").trim();

  // OpenAI text-embedding-3-small has a context window of 8191 tokens
  // Rough estimate: 1 token ≈ 4 characters, so ~32000 chars max
  // We'll be conservative and limit to 8000 chars
  const MAX_CHARS = 8000;
  if (prepared.length > MAX_CHARS) {
    prepared = prepared.substring(0, MAX_CHARS);
  }

  return prepared;
}

/**
 * Convert embedding array to Postgres vector format string
 */
export function toVectorString(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

/**
 * Parse Postgres vector format string to embedding array
 */
export function fromVectorString(vectorStr: string): number[] {
  // Remove brackets and split by comma
  const cleaned = vectorStr.replace(/[\[\]]/g, "");
  return cleaned.split(",").map(parseFloat);
}

export { EMBEDDING_MODEL, EMBEDDING_DIMENSIONS };
