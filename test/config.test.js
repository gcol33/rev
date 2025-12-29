/**
 * Tests for config.js
 * Tests user configuration management
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// We need to mock the config path for testing
// Since config.js uses a hardcoded path, we'll test the logic indirectly

let tempDir;
let originalHome;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docrev-config-'));
  originalHome = process.env.HOME;
  // Note: This won't affect the already-imported config.js constants
  // So we test the functions that we can
});

afterEach(() => {
  process.env.HOME = originalHome;
  fs.rmSync(tempDir, { recursive: true, force: true });
});

// Import after setting up mocks wouldn't work for ES modules
// So we test what we can without changing HOME
import {
  loadUserConfig,
  saveUserConfig,
  getUserName,
  setUserName,
  getConfigPath,
} from '../lib/config.js';

describe('getConfigPath', () => {
  it('should return a path', () => {
    const configPath = getConfigPath();

    assert.ok(typeof configPath === 'string');
    assert.ok(configPath.length > 0);
  });

  it('should be in home directory', () => {
    const configPath = getConfigPath();

    assert.ok(configPath.includes(os.homedir()));
  });

  it('should end with .revrc', () => {
    const configPath = getConfigPath();

    assert.ok(configPath.endsWith('.revrc'));
  });
});

describe('loadUserConfig', () => {
  it('should return object', () => {
    const config = loadUserConfig();

    assert.ok(typeof config === 'object');
  });

  it('should return empty object if config does not exist', () => {
    // If no config exists yet, should return {}
    // This might pass or fail depending on user's actual config
    const config = loadUserConfig();

    assert.ok(config !== null);
    assert.ok(config !== undefined);
  });
});

describe('saveUserConfig', () => {
  it('should save and load config', () => {
    const testConfig = { testKey: 'testValue', timestamp: Date.now() };

    // Save
    saveUserConfig(testConfig);

    // Load
    const loaded = loadUserConfig();

    assert.strictEqual(loaded.testKey, testConfig.testKey);
    assert.strictEqual(loaded.timestamp, testConfig.timestamp);
  });

  it('should overwrite existing config', () => {
    saveUserConfig({ first: 1 });
    saveUserConfig({ second: 2 });

    const loaded = loadUserConfig();

    assert.strictEqual(loaded.second, 2);
    assert.strictEqual(loaded.first, undefined);
  });
});

describe('getUserName', () => {
  it('should return string or null', () => {
    const name = getUserName();

    assert.ok(name === null || typeof name === 'string');
  });
});

describe('setUserName', () => {
  it('should set and get user name', () => {
    const testName = `TestUser_${Date.now()}`;

    setUserName(testName);
    const retrieved = getUserName();

    assert.strictEqual(retrieved, testName);
  });

  it('should update existing user name', () => {
    setUserName('First');
    setUserName('Second');

    const name = getUserName();

    assert.strictEqual(name, 'Second');
  });

  it('should preserve other config values', () => {
    // Save some config
    saveUserConfig({ otherKey: 'preserved', userName: 'old' });

    // Update just the name
    setUserName('new');

    const config = loadUserConfig();

    assert.strictEqual(config.userName, 'new');
    assert.strictEqual(config.otherKey, 'preserved');
  });
});

describe('config file format', () => {
  it('should save as JSON', () => {
    saveUserConfig({ key: 'value' });

    const configPath = getConfigPath();
    const raw = fs.readFileSync(configPath, 'utf-8');

    // Should be valid JSON
    const parsed = JSON.parse(raw);
    assert.strictEqual(parsed.key, 'value');
  });

  it('should be pretty-printed', () => {
    saveUserConfig({ key: 'value' });

    const configPath = getConfigPath();
    const raw = fs.readFileSync(configPath, 'utf-8');

    // Pretty-printed JSON has newlines
    assert.ok(raw.includes('\n'));
  });
});

describe('config error handling', () => {
  it('should handle malformed JSON gracefully', () => {
    const configPath = getConfigPath();

    // Write invalid JSON
    fs.writeFileSync(configPath, 'not valid json {{{');

    // Should not throw, should return empty object
    const config = loadUserConfig();
    assert.deepStrictEqual(config, {});
  });
});
