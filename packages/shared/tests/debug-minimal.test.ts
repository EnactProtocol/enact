import { test, expect } from 'bun:test';
import { handleUserCommand } from '../src/commands/user';

test('minimal test', async () => {
  try {
    await handleUserCommand([], { help: true });
    console.log('Command succeeded');
  } catch (error) {
    console.error('Command failed:', error);
    console.error('Error type:', typeof error);
    console.error('Error constructor:', error?.constructor?.name);
    console.error('Error message:', error?.message);
    console.error('Error stack:', error?.stack);
    throw error;
  }
});
