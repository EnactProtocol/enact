// src/web/env-manager-server.ts - Web server for managing environment variables
import { createServer, IncomingMessage, ServerResponse } from 'http';
import { parse } from 'url';
import { readFile, writeFile, mkdir, readdir, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';
import logger from '../exec/logger';

// Get the directory of this module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration paths
const CONFIG_DIR = join(homedir(), '.enact');
const ENV_BASE_DIR = join(CONFIG_DIR, 'env');

// Find static files - try multiple locations
function findStaticDir(): string {
  const candidates = [
    join(__dirname, 'web', 'static'),             // If running from built package (dist/web/static)
    join(__dirname, 'static'),                    // If running from source
    join(__dirname, '..', 'src', 'web', 'static'), // If bundled in dist
    join(__dirname, '..', '..', 'src', 'web', 'static'), // If nested deeper
    join(process.cwd(), 'src', 'web', 'static'), // From project root
    // When installed via npm, static files are in the package root
    join(__dirname, '..', '..', '..', 'src', 'web', 'static'), // node_modules/enact-cli/src/web/static from node_modules/enact-cli/dist/web/
    join(__dirname, '..', '..', 'src', 'web', 'static'), // node_modules/enact-cli/src/web/static from node_modules/enact-cli/dist/
  ];
  
  for (const candidate of candidates) {
    if (existsSync(join(candidate, 'index.html'))) {
      logger.debug(`Found static directory: ${candidate}`);
      return candidate;
    }
  }
  
  throw new Error('Could not find static directory. Tried: ' + candidates.join(', '));
}

const STATIC_DIR = findStaticDir();

interface PackageEnvInfo {
  namespace: string;
  path: string;
  variables: Record<string, string>;
}

/**
 * Parse simple .env file format (KEY=value)
 */
function parseDotEnv(content: string): Record<string, string> {
  const vars: Record<string, string> = {};
  const lines = content.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue; // Skip empty lines and comments
    }
    
    const equalIndex = trimmed.indexOf('=');
    if (equalIndex === -1) {
      continue; // Skip lines without '='
    }
    
    const key = trimmed.slice(0, equalIndex).trim();
    let value = trimmed.slice(equalIndex + 1).trim();
    
    // Remove quotes if present
    if ((value.startsWith('"') && value.endsWith('"')) || 
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    
    if (key) {
      vars[key] = value;
    }
  }
  
  return vars;
}

/**
 * Convert environment variables to .env file format
 */
function generateDotEnv(vars: Record<string, string>): string {
  return Object.entries(vars)
    .map(([key, value]) => {
      // Escape value if it contains special characters
      const needsQuotes = value.includes(' ') || value.includes('\t') || value.includes('\n') || value.includes('"');
      const escapedValue = needsQuotes ? `"${value.replace(/"/g, '\\"')}"` : value;
      return `${key}=${escapedValue}`;
    })
    .join('\n') + '\n';
}

/**
 * Get all package namespaces with environment variables
 */
async function getAllPackageNamespaces(): Promise<PackageEnvInfo[]> {
  const packages: PackageEnvInfo[] = [];
  
  if (!existsSync(ENV_BASE_DIR)) {
    return packages;
  }
  
  try {
    await scanDirectory(ENV_BASE_DIR, '', packages);
  } catch (error) {
    logger.error('Failed to scan env directory:', error);
  }
  
  return packages;
}

/**
 * Recursively scan directory for .env files
 */
async function scanDirectory(dir: string, relativePath: string, packages: PackageEnvInfo[]): Promise<void> {
  try {
    const entries = await readdir(dir);
    
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stats = await stat(fullPath);
      
      if (stats.isDirectory()) {
        // Recursively scan subdirectories
        const newRelativePath = relativePath ? `${relativePath}/${entry}` : entry;
        await scanDirectory(fullPath, newRelativePath, packages);
      } else if (entry === '.env') {
        // Found a .env file
        const namespace = relativePath || 'root';
        try {
          const content = await readFile(fullPath, 'utf8');
          const variables = parseDotEnv(content);
          
          packages.push({
            namespace,
            path: fullPath,
            variables
          });
        } catch (error) {
          logger.error(`Failed to read .env file at ${fullPath}:`, error);
        }
      }
    }
  } catch (error) {
    logger.error(`Failed to scan directory ${dir}:`, error);
  }
}

/**
 * Get environment variables for a specific package namespace
 */
async function getPackageEnvVars(namespace: string): Promise<Record<string, string>> {
  const envFile = join(ENV_BASE_DIR, namespace, '.env');
  
  if (!existsSync(envFile)) {
    return {};
  }
  
  try {
    const content = await readFile(envFile, 'utf8');
    return parseDotEnv(content);
  } catch (error) {
    logger.error(`Failed to read env file for ${namespace}:`, error);
    return {};
  }
}

/**
 * Set environment variable for a package namespace
 */
async function setPackageEnvVar(namespace: string, key: string, value: string): Promise<void> {
  const envFile = join(ENV_BASE_DIR, namespace, '.env');
  const envDir = dirname(envFile);
  
  // Ensure directory exists
  if (!existsSync(envDir)) {
    await mkdir(envDir, { recursive: true });
  }
  
  // Read existing variables
  const existingVars = await getPackageEnvVars(namespace);
  
  // Update variables
  existingVars[key] = value;
  
  // Write back to file
  const envContent = generateDotEnv(existingVars);
  await writeFile(envFile, envContent, 'utf8');
}

/**
 * Delete environment variable for a package namespace
 */
async function deletePackageEnvVar(namespace: string, key: string): Promise<void> {
  const existingVars = await getPackageEnvVars(namespace);
  
  if (!(key in existingVars)) {
    throw new Error(`Environment variable '${key}' not found in package '${namespace}'`);
  }
  
  delete existingVars[key];
  
  const envFile = join(ENV_BASE_DIR, namespace, '.env');
  const envContent = generateDotEnv(existingVars);
  await writeFile(envFile, envContent, 'utf8');
}

/**
 * Serve static files
 */
async function serveStaticFile(filePath: string, res: ServerResponse): Promise<void> {
  try {
    const content = await readFile(filePath, 'utf8');
    const ext = filePath.split('.').pop()?.toLowerCase();
    
    let contentType = 'text/plain';
    switch (ext) {
      case 'html':
        contentType = 'text/html';
        break;
      case 'css':
        contentType = 'text/css';
        break;
      case 'js':
        contentType = 'application/javascript';
        break;
      case 'json':
        contentType = 'application/json';
        break;
    }
    
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  } catch (error) {
    logger.error('Error serving static file:', error);
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('File not found');
  }
}

/**
 * Handle HTTP requests
 */
async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const urlParts = parse(req.url || '', true);
  const pathname = urlParts.pathname || '/';
  const method = req.method || 'GET';

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  try {
    if (pathname === '/') {
      // Serve main HTML page
      await serveStaticFile(join(STATIC_DIR, 'index.html'), res);
      
    } else if (pathname === '/style.css') {
      // Serve CSS file
      await serveStaticFile(join(STATIC_DIR, 'style.css'), res);
      
    } else if (pathname === '/app.js') {
      // Serve JavaScript file
      await serveStaticFile(join(STATIC_DIR, 'app.js'), res);
      
    } else if (pathname === '/favicon.ico') {
      // Serve a simple SVG favicon
      const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🌐</text></svg>`;
      res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
      res.end(favicon);
      
    } else if (pathname === '/api/packages' && method === 'GET') {
      // Get all packages
      const packages = await getAllPackageNamespaces();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ packages }));
      
    } else if (pathname === '/api/packages' && method === 'POST') {
      // Create new package
      const body = await getRequestBody(req);
      const { namespace } = JSON.parse(body);
      
      if (!namespace) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Namespace is required' }));
        return;
      }
      
      const envDir = join(ENV_BASE_DIR, namespace);
      const envFile = join(envDir, '.env');
      
      if (!existsSync(envDir)) {
        await mkdir(envDir, { recursive: true });
      }
      
      if (!existsSync(envFile)) {
        await writeFile(envFile, '', 'utf8');
      }
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
      
    } else if (pathname?.startsWith('/api/packages/') && method === 'GET') {
      // Get specific package variables
      const namespace = decodeURIComponent(pathname.replace('/api/packages/', ''));
      const variables = await getPackageEnvVars(namespace);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ namespace, variables }));
      
    } else if (pathname?.startsWith('/api/packages/') && pathname.endsWith('/variables') && method === 'POST') {
      // Add/update variable
      const namespace = decodeURIComponent(pathname.replace('/api/packages/', '').replace('/variables', ''));
      const body = await getRequestBody(req);
      const { key, value } = JSON.parse(body);
      
      if (!key || value === undefined) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Key and value are required' }));
        return;
      }
      
      await setPackageEnvVar(namespace, key, value);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
      
    } else if (pathname?.includes('/variables/') && method === 'DELETE') {
      // Delete variable
      const pathParts = pathname.split('/');
      const variableIndex = pathParts.indexOf('variables');
      const namespace = decodeURIComponent(pathParts.slice(3, variableIndex).join('/'));
      const key = decodeURIComponent(pathParts[variableIndex + 1]);
      
      await deletePackageEnvVar(namespace, key);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
      
    } else {
      // 404 Not Found
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
    }
    
  } catch (error) {
    logger.error('Web server error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    }));
  }
}

/**
 * Get request body as string
 */
function getRequestBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      resolve(body);
    });
    req.on('error', reject);
  });
}

/**
 * Start the web server
 */
export function startEnvManagerServer(port: number = 5555): Promise<{ server: any; port: number }> {
  return new Promise((resolve, reject) => {
    const server = createServer(handleRequest);
    
    // Try to start on the specified port, fallback to a random port if unavailable
    server.listen(port, () => {
      const actualPort = (server.address() as any)?.port || port;
      logger.info(`🌐 Environment Manager web server started on http://localhost:${actualPort}`);
      resolve({ server, port: actualPort });
    });
    
    server.on('error', (error: any) => {
      if (error.code === 'EADDRINUSE') {
        // Port is in use, try a random port
        server.listen(0, () => {
          const actualPort = (server.address() as any)?.port;
          logger.info(`🌐 Environment Manager web server started on http://localhost:${actualPort} (port ${port} was in use)`);
          resolve({ server, port: actualPort });
        });
      } else {
        reject(error);
      }
    });
  });
}

// Export additional functions for use by MCP tools
export { getAllPackageNamespaces, getPackageEnvVars, setPackageEnvVar, deletePackageEnvVar };
