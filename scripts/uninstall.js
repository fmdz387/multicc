#!/usr/bin/env node

/**
 * multicc Uninstall Script
 * Safely removes all multicc components from the system
 *
 * Usage: node scripts/uninstall.js [--force]
 *
 * Components removed:
 * - API keys from system keyring
 * - Config directory (~/.multicc)
 * - Global npm/pnpm link (optional)
 * - Shell integration (eval lines in shell profiles)
 */

import { spawnSync } from 'node:child_process';
import { existsSync, rmSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';

const CONFIG_DIR_NAME = '.multicc';
const KEYRING_SERVICE = 'multicc';

const isWindows = platform() === 'win32';
const isMac = platform() === 'darwin';
const isLinux = platform() === 'linux';

const forceMode = process.argv.includes('--force') || process.argv.includes('-f');

function readProfileNames() {
  const configPath = join(homedir(), CONFIG_DIR_NAME, 'config.json');
  if (!existsSync(configPath)) return [];
  try {
    const raw = readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.profiles === 'object' && parsed.profiles !== null) {
      return Object.keys(parsed.profiles);
    }
  } catch {
    // Corrupted config -- fall through to fallback cleanup.
  }
  return [];
}

function log(message, type = 'info') {
  const colors = {
    info: '\x1b[36m',
    success: '\x1b[32m',
    warn: '\x1b[33m',
    error: '\x1b[31m',
    reset: '\x1b[0m',
  };

  const prefix = {
    info: '\u2139',
    success: '\u2714',
    warn: '\u26A0',
    error: '\u2716',
  };

  console.log(`${colors[type]}${prefix[type]} ${message}${colors.reset}`);
}

async function confirm(question) {
  if (forceMode) return true;

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${question} (y/N): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

async function removeKeyringEntries() {
  log('Removing API keys from system keyring...');

  const profiles = readProfileNames();

  // Preferred path: use the same @napi-rs/keyring binding the CLI uses.
  // Iterate over every profile so we delete each per-account entry.
  let napiOk = false;
  let napiCleared = 0;
  try {
    const { Entry } = await import('@napi-rs/keyring');
    napiOk = true;
    for (const name of profiles) {
      try {
        const entry = new Entry(KEYRING_SERVICE, name);
        entry.deletePassword();
        napiCleared++;
      } catch {
        // Entry may not exist -- ignore.
      }
    }
  } catch {
    // Module not installed -- fall through to native CLI tools.
  }

  if (napiOk) {
    if (napiCleared > 0) {
      log(`Removed ${napiCleared} keyring entr${napiCleared === 1 ? 'y' : 'ies'} via @napi-rs/keyring`, 'success');
    } else {
      log('No keyring entries found for known profiles', 'info');
    }
    return true;
  }

  // Fallback: platform-specific CLI. Iterate per profile when we know them;
  // otherwise do a best-effort sweep of the service itself.
  try {
    if (isWindows) {
      // cmdkey targets are stored as "<service>:<account>" by some bindings.
      // Try per-profile first, then a service-wide cleanup as a safety net.
      for (const name of profiles) {
        spawnSync('cmdkey', [`/delete:${KEYRING_SERVICE}:${name}`], { encoding: 'utf-8' });
      }
      spawnSync('cmdkey', [`/delete:${KEYRING_SERVICE}`], { encoding: 'utf-8' });
    } else if (isMac) {
      // macOS Keychain: -s scopes to service, -a scopes to account.
      // Loop until no entry remains for each (service, account) pair.
      for (const name of profiles) {
        for (let i = 0; i < 10; i++) {
          const r = spawnSync(
            'security',
            ['delete-generic-password', '-s', KEYRING_SERVICE, '-a', name],
            { encoding: 'utf-8' }
          );
          if (r.status !== 0) break;
        }
      }
      // Best-effort sweep of any remaining entries with our service name.
      for (let i = 0; i < 10; i++) {
        const r = spawnSync(
          'security',
          ['delete-generic-password', '-s', KEYRING_SERVICE],
          { encoding: 'utf-8' }
        );
        if (r.status !== 0) break;
      }
    } else if (isLinux) {
      // libsecret: clear all entries with our service attribute.
      spawnSync('secret-tool', ['clear', 'service', KEYRING_SERVICE], { encoding: 'utf-8' });
    }

    log('Keyring cleanup attempted via native CLI (results vary by platform)', 'info');
    return true;
  } catch (error) {
    log(`Could not remove keyring entries: ${error.message}`, 'warn');
    return false;
  }
}

function removeConfigDirectory() {
  const configDir = join(homedir(), CONFIG_DIR_NAME);

  if (!existsSync(configDir)) {
    log(`Config directory not found: ${configDir}`, 'warn');
    return true;
  }

  log(`Removing config directory: ${configDir}`);

  try {
    rmSync(configDir, { recursive: true, force: true });
    log('Config directory removed', 'success');
    return true;
  } catch (error) {
    log(`Failed to remove config directory: ${error.message}`, 'error');
    return false;
  }
}

function removeGlobalLink() {
  log('Checking for global package installation...');

  try {
    const pnpmResult = spawnSync('pnpm', ['list', '-g', '--depth=0'], {
      encoding: 'utf-8',
      shell: true,
    });

    if (pnpmResult.stdout && pnpmResult.stdout.includes('multicc')) {
      log('Found pnpm global link, removing...');
      spawnSync('pnpm', ['unlink', '--global', 'multicc'], { encoding: 'utf-8', shell: true });
      log('Removed pnpm global link', 'success');
      return true;
    }
  } catch {
    // pnpm not available
  }

  try {
    const npmResult = spawnSync('npm', ['list', '-g', '--depth=0'], {
      encoding: 'utf-8',
      shell: true,
    });

    if (npmResult.stdout && npmResult.stdout.includes('multicc')) {
      log('Found npm global link, removing...');
      spawnSync('npm', ['uninstall', '-g', 'multicc'], { encoding: 'utf-8', shell: true });
      log('Removed npm global link', 'success');
      return true;
    }
  } catch {
    // npm not available
  }

  log('No global package link found', 'info');
  return true;
}

function removeShellIntegration() {
  log('Checking for shell integration...');

  const shellConfigs = [];

  if (isWindows) {
    const psProfile = join(homedir(), 'Documents', 'WindowsPowerShell', 'Microsoft.PowerShell_profile.ps1');
    const pwshProfile = join(homedir(), 'Documents', 'PowerShell', 'Microsoft.PowerShell_profile.ps1');
    if (existsSync(psProfile)) shellConfigs.push(psProfile);
    if (existsSync(pwshProfile)) shellConfigs.push(pwshProfile);
  } else {
    const bashrc = join(homedir(), '.bashrc');
    const zshrc = join(homedir(), '.zshrc');
    const fishConfig = join(homedir(), '.config', 'fish', 'config.fish');

    if (existsSync(bashrc)) shellConfigs.push(bashrc);
    if (existsSync(zshrc)) shellConfigs.push(zshrc);
    if (existsSync(fishConfig)) shellConfigs.push(fishConfig);
  }

  let removed = 0;

  for (const configPath of shellConfigs) {
    try {
      const content = readFileSync(configPath, 'utf-8');

      const patterns = [
        /^.*eval\s+.*multicc\s+shell-init.*$/gm,
        /^.*multicc\s+shell-init.*$/gm,
        /^# multicc.*$/gm,
      ];

      let newContent = content;
      let hasChanges = false;

      for (const pattern of patterns) {
        if (pattern.test(newContent)) {
          hasChanges = true;
          newContent = newContent.replace(pattern, '');
        }
      }

      if (hasChanges) {
        const backupPath = `${configPath}.multicc-backup`;
        copyFileSync(configPath, backupPath);
        log(`Created backup: ${backupPath}`, 'info');

        newContent = newContent.replace(/\n{3,}/g, '\n\n').trim() + '\n';
        writeFileSync(configPath, newContent);
        log(`Removed shell integration from: ${configPath}`, 'success');
        removed++;
      }
    } catch (error) {
      log(`Could not process ${configPath}: ${error.message}`, 'warn');
    }
  }

  if (removed === 0) {
    log('No shell integration found', 'info');
  }

  return true;
}

async function main() {
  console.log('\n\x1b[1m\x1b[35mmulticc Uninstaller\x1b[0m\n');

  if (!forceMode) {
    console.log('This will remove:');
    console.log('  \u2022 API keys from system keyring');
    console.log(`  \u2022 Config directory (~/${CONFIG_DIR_NAME})`);
    console.log('  \u2022 Global package link (if exists)');
    console.log('  \u2022 Shell integration (if configured)\n');

    const proceed = await confirm('Do you want to proceed?');
    if (!proceed) {
      log('Uninstall cancelled', 'info');
      process.exit(0);
    }
    console.log();
  }

  const results = {
    keyring: await removeKeyringEntries(),
    config: removeConfigDirectory(),
    globalLink: removeGlobalLink(),
    shell: removeShellIntegration(),
  };

  console.log('\n\x1b[1m--- Summary ---\x1b[0m\n');

  const allSuccess = Object.values(results).every(Boolean);

  if (allSuccess) {
    log('multicc has been completely removed from your system!', 'success');
    console.log('\nIf you installed via npm/pnpm globally, you may also want to run:');
    console.log('  npm uninstall -g multicc');
    console.log('  # or');
    console.log('  pnpm uninstall -g multicc\n');
  } else {
    log('Uninstall completed with some warnings (see above)', 'warn');
  }

  console.log('\x1b[33mRestart your terminal for changes to take effect.\x1b[0m\n');
}

main().catch((error) => {
  log(`Uninstall failed: ${error.message}`, 'error');
  process.exit(1);
});
