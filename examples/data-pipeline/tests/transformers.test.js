/**
 * Transformer Tests
 * @jest-environment node
 */

/* global describe, test, expect */

const { cleanData } = require('../src/transformers/clean');
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- used for demonstration
const { validateData } = require('../src/transformers/validate');
const { mapFields } = require('../src/transformers/map');

describe('Data Cleaner', () => {
  test('trims strings', () => {
    const data = [{ name: '  test  ' }];
    const result = cleanData(data, { trimStrings: true });
    expect(result[0].name).toBe('test');
  });
  
  test('removes empty values', () => {
    const data = [{ name: 'test', empty: null }];
    const result = cleanData(data, { removeEmpty: true });
    expect(result[0].empty).toBeUndefined();
  });
});

describe('Field Mapper', () => {
  test('renames fields', () => {
    const data = [{ old_name: 'value' }];
    const result = mapFields(data, { old_name: 'new_name' });
    expect(result[0].new_name).toBe('value');
  });
});
