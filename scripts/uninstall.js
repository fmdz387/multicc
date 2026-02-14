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

  try {
    try {
      const { Entry } = await import('@napi-rs/keyring');
      // Multicc stores keys per profile, try to clear the service
      const entry = new Entry(KEYRING_SERVICE, 'default');
      entry.deleteCredential();
      log('Keyring entries removed (via @napi-rs/keyring)', 'success');
      return true;
    } catch {
      // Fall through to platform-specific methods
    }

    if (isWindows) {
      spawnSync('cmdkey', ['/delete:multicc'], { encoding: 'utf-8', shell: true });
    } else if (isMac) {
      spawnSync('security', ['delete-generic-password', '-s', KEYRING_SERVICE], { encoding: 'utf-8' });
    } else if (isLinux) {
      spawnSync('secret-tool', ['clear', 'service', KEYRING_SERVICE], { encoding: 'utf-8' });
    }

    log('No keyring entries found (may not have been stored there)', 'warn');
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
