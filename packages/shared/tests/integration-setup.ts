import { beforeAll, afterAll } from 'bun:test'
import { join } from 'path'
import { promises as fs } from 'fs'

beforeAll(async () => {
  // Integration test specific setup
  console.log('Setting up integration tests...')
  
  // Ensure test environment is properly isolated
  process.env.ENACT_TEST_MODE = 'integration'
  process.env.ENACT_API_URL = 'http://localhost:8080' // Mock API URL
  
  // Create additional integration test directories if needed
  const integrationTempDir = join(globalThis.__TEST_ENV__.tempDir, 'integration')
  await fs.mkdir(integrationTempDir, { recursive: true })
})

afterAll(async () => {
  console.log('Cleaning up integration tests...')
  // Integration-specific cleanup
})