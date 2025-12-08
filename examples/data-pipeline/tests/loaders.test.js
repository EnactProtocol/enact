/**
 * Loader Tests
 * @jest-environment node
 */

/* global describe, test */

const { loadToConsole } = require('../src/loaders/console');

describe('Console Loader', () => {
  test('outputs table format', async () => {
    const data = [{ id: 1, name: 'test' }];
    await loadToConsole(data, { format: 'table' });
  });
  
  test('outputs JSON format', async () => {
    const data = [{ id: 1, name: 'test' }];
    await loadToConsole(data, { format: 'json' });
  });
  
  test('outputs count format', async () => {
    const data = [{ id: 1 }, { id: 2 }];
    await loadToConsole(data, { format: 'count' });
  });
});
