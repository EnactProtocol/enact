import { test, expect } from 'bun:test';
import { handleUserCommand } from '../src/commands/user';

test('testing not.toThrow pattern', async () => {
  // This is how it should be done - wrapping the async call
  await expect(async () => {
    await handleUserCommand(['public-key', 'test-user'], {});
  }).not.toThrow();
});
