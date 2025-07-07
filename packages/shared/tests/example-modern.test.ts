import { describe, test, expect, beforeEach } from 'bun:test'
import './setup' // Import setup first
import { 
  createTestEnvironment, 
  createMockConsole, 
  mockProcessExit,
  expectTool,
  expectOutput,
  fixtures,
  createTool,
  describeUnit,
  withTempFile
} from './utils'

// Example of modern test using the new utilities
describeUnit('Modern Test Example', () => {
  let testEnv: ReturnType<typeof createTestEnvironment>
  let mockConsole: ReturnType<typeof createMockConsole>
  let exitMock: ReturnType<typeof mockProcessExit>

  beforeEach(async () => {
    testEnv = createTestEnvironment('modern-test-example')
    await testEnv.setup()
    
    mockConsole = createMockConsole()
    exitMock = mockProcessExit()
  })

  test('should validate tool structure', () => {
    const tool = createTool({ 
      name: 'test-validator',
      tags: ['validation', 'test'] 
    })
    
    // Using custom assertions
    expectTool(tool).toBeValid()
    
    // Standard assertions still work
    expect(tool.name).toBe('test-validator')
    expect(tool.tags).toContain('validation')
  })

  test('should handle file operations safely', async () => {
    const yamlContent = `
name: temp-tool
description: Temporary tool for testing
command: echo "test"
`
    
    await withTempFile(yamlContent, async (filePath) => {
      // Test file operations within safe temp file context
      const fs = await import('fs/promises')
      const content = await fs.readFile(filePath, 'utf8')
      expect(content.trim()).toBe(yamlContent.trim())
    }, '.yaml')
    
    // File automatically cleaned up
  })

  test('should mock console output properly', () => {
    mockConsole.log('Test message')
    mockConsole.error('Error message')
    
    expect(mockConsole.getLogs()).toContain('Test message')
    expect(mockConsole.getErrors()).toContain('Error message')
    
    const output = mockConsole.getOutput()
    expectOutput(output).toContainError()
  })

  test('should handle process.exit calls', () => {
    try {
      process.exit(1)
    } catch (error) {
      // Expected - process.exit is mocked
    }
    
    expect(exitMock.wasExitCalled()).toBe(true)
    expect(exitMock.getExitCode()).toBe(1)
  })

  test('should use fixtures for consistent test data', () => {
    const validTool = fixtures.validTool
    const toolWithEnv = fixtures.toolWithEnvironment
    
    expectTool(validTool).toBeValid()
    expectTool(toolWithEnv).toBeValid()
    expectTool(toolWithEnv).toHaveValidEnvironment()
  })

  test('should set environment variables safely', () => {
    const originalValue = testEnv.getEnv('TEST_VAR')
    
    testEnv.setEnv('TEST_VAR', 'test-value')
    expect(testEnv.getEnv('TEST_VAR')).toBe('test-value')
    
    // Environment automatically restored after test
  })
})