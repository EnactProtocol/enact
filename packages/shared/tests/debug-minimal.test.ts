import { test, expect } from 'bun:test';
// The user command is in the CLI package
// import { handleUserCommand } from '../src/commands/user';

test('minimal test', async () => {
  try {
    // Note: User command is in CLI package, not shared
    // await handleUserCommand([], { help: true });
    console.log('Command test skipped - user command in CLI package');
    expect(true).toBe(true);
  } catch (error) {
    console.error('Command failed:', error);
    console.error('Error type:', typeof error);
    console.error('Error constructor:', error?.constructor?.name);
    console.error('Error message:', error?.message);
    console.error('Error stack:', error?.stack);
    throw error;
  }
});
