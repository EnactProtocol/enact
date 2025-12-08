/**
 * TAR file parsing utilities for Deno Edge Functions
 * 
 * Simple tar.gz extraction without external dependencies.
 * Based on USTAR format specification.
 */

/**
 * File entry from a tar archive
 */
export interface TarEntry {
  name: string;
  size: number;
  type: 'file' | 'directory';
  mode: number;
  mtime: Date;
  content?: Uint8Array;
}

/**
 * Parse a tar header block (512 bytes)
 */
function parseHeader(header: Uint8Array): TarEntry | null {
  // Check if this is an empty block (end of archive)
  if (header.every(b => b === 0)) {
    return null;
  }

  // Read name (0-99, null-terminated)
  let name = readString(header, 0, 100);
  
  // Read file mode (100-107, octal)
  const mode = readOctal(header, 100, 8);
  
  // Read size (124-135, octal)
  const size = readOctal(header, 124, 12);
  
  // Read mtime (136-147, octal)
  const mtime = new Date(readOctal(header, 136, 12) * 1000);
  
  // Read type flag (156)
  const typeFlag = header[156];
  
  // Read prefix for long names (345-499)
  const prefix = readString(header, 345, 155);
  if (prefix) {
    name = prefix + '/' + name;
  }
  
  // Normalize name
  name = name.replace(/^\.\//, '').replace(/\/$/, '');
  
  // Skip pax headers and other special types
  if (typeFlag === 120 || typeFlag === 103 || typeFlag === 76 || typeFlag === 75) {
    return {
      name: '',
      size,
      type: 'file',
      mode,
      mtime,
    };
  }
  
  const type = typeFlag === 53 || typeFlag === 5 ? 'directory' : 'file';
  
  return {
    name,
    size,
    type,
    mode,
    mtime,
  };
}

/**
 * Read a null-terminated string from a buffer
 */
function readString(buffer: Uint8Array, offset: number, length: number): string {
  let end = offset;
  while (end < offset + length && buffer[end] !== 0) {
    end++;
  }
  return new TextDecoder().decode(buffer.slice(offset, end));
}

/**
 * Read an octal number from a buffer
 */
function readOctal(buffer: Uint8Array, offset: number, length: number): number {
  const str = readString(buffer, offset, length).trim();
  if (!str) return 0;
  return parseInt(str, 8) || 0;
}

/**
 * Decompress gzip data using Web Streams API
 */
async function decompress(data: Uint8Array): Promise<Uint8Array> {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(data);
      controller.close();
    },
  });
  
  const decompressedStream = stream.pipeThrough(new DecompressionStream('gzip'));
  const reader = decompressedStream.getReader();
  const chunks: Uint8Array[] = [];
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  
  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  
  return result;
}

/**
 * Extract files from a tar.gz archive
 * 
 * @param data - The gzipped tar data
 * @param options - Options for extraction
 * @returns Array of file entries
 */
export async function extractTarGz(
  data: ArrayBuffer | Uint8Array,
  options: {
    /** Only return file list, don't extract content */
    listOnly?: boolean;
    /** Filter to specific file path */
    filterPath?: string;
  } = {}
): Promise<TarEntry[]> {
  const gzipData = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
  
  // Decompress gzip
  const tarData = await decompress(gzipData);
  
  const entries: TarEntry[] = [];
  let offset = 0;
  
  while (offset < tarData.length - 512) {
    // Read header (512 bytes)
    const header = tarData.slice(offset, offset + 512);
    offset += 512;
    
    const entry = parseHeader(header);
    
    // End of archive
    if (!entry) {
      break;
    }
    
    // Skip special entries (pax headers, etc.)
    if (!entry.name) {
      // Skip content blocks
      if (entry.size > 0) {
        offset += Math.ceil(entry.size / 512) * 512;
      }
      continue;
    }
    
    // Read content if it's a file
    if (entry.type === 'file' && entry.size > 0) {
      if (!options.listOnly && (!options.filterPath || entry.name === options.filterPath)) {
        entry.content = tarData.slice(offset, offset + entry.size);
      }
      // Move to next 512-byte boundary
      offset += Math.ceil(entry.size / 512) * 512;
    }
    
    // Add to list if it passes filter
    if (!options.filterPath || entry.name === options.filterPath || entry.name.startsWith(options.filterPath + '/')) {
      entries.push(entry);
    }
    
    // If we're looking for a specific file and found it, stop
    if (options.filterPath && entry.name === options.filterPath && entry.type === 'file') {
      break;
    }
  }
  
  return entries;
}

/**
 * List files in a tar.gz archive
 */
export async function listTarGzFiles(data: ArrayBuffer | Uint8Array): Promise<TarEntry[]> {
  return extractTarGz(data, { listOnly: true });
}

/**
 * Get a specific file from a tar.gz archive
 */
export async function getFileFromTarGz(
  data: ArrayBuffer | Uint8Array,
  filePath: string
): Promise<TarEntry | null> {
  const entries = await extractTarGz(data, { filterPath: filePath });
  return entries.find(e => e.name === filePath && e.type === 'file') || null;
}
