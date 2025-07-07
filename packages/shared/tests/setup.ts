import { beforeAll, afterAll, beforeEach, afterEach } from 'bun:test'
import { join } from 'path'
import { tmpdir } from 'os'
import { promises as fs } from 'fs'

// Global test environment
declare global {
  namespace globalThis {
    var __TEST_ENV__: {
      tempDir: string
      originalEnv: Record<string, string | undefined>
      cleanup: Array<() => Promise<void>>
    }
  }
}

beforeAll(async () => {
  // Create global test directory
  const tempDir = join(tmpdir(), `enact-tests-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  await fs.mkdir(tempDir, { recursive: true })
  
  // Store original environment
  const originalEnv = { ...process.env }
  
  // Initialize global test environment
  globalThis.__TEST_ENV__ = {
    tempDir,
    originalEnv,
    cleanup: []
  }
  
  // Set test environment variables
  process.env.NODE_ENV = 'test'
  process.env.ENACT_SILENT = 'true'
  process.env.ENACT_SKIP_INTERACTIVE = 'true'
  process.env.CI = 'true'
})

afterAll(async () => {
  // Run all cleanup functions
  for (const cleanup of globalThis.__TEST_ENV__.cleanup) {
    try {
      await cleanup()
    } catch (error) {
      console.warn('Cleanup function failed:', error)
    }
  }
  
  // Restore original environment
  process.env = { ...globalThis.__TEST_ENV__.originalEnv }
  
  // Clean up test directory
  try {
    await fs.rm(globalThis.__TEST_ENV__.tempDir, { recursive: true, force: true })
  } catch (error) {
    console.warn('Failed to clean up test directory:', error)
  }
})

beforeEach(() => {
  // Reset cleanup array for each test
  globalThis.__TEST_ENV__.cleanup = []
})

afterEach(async () => {
  // Run test-specific cleanup
  for (const cleanup of globalThis.__TEST_ENV__.cleanup) {
    try {
      await cleanup()
    } catch (error) {
      console.warn('Test cleanup function failed:', error)
    }
  }
  globalThis.__TEST_ENV__.cleanup = []
})