/**
 * Combined Sync: NinjaRMM → Monday Tickets → Kiosk Health Status
 *
 * This script runs both operations in sequence:
 * 1. Sync tickets from NinjaRMM to Monday.com Tickets board
 * 2. Update kiosk health statuses based on ticket statuses
 */
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Run a script and wait for it to complete
 */
function runScript(scriptPath, scriptName) {
  return new Promise((resolve, reject) => {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Running: ${scriptName}`);
    console.log('='.repeat(80));

    const child = spawn('node', [scriptPath], {
      stdio: 'inherit',
      cwd: join(__dirname, '..')
    });

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`${scriptName} failed with code ${code}`));
      } else {
        console.log(`\n✅ ${scriptName} completed successfully\n`);
        resolve();
      }
    });

    child.on('error', (error) => {
      reject(new Error(`Failed to start ${scriptName}: ${error.message}`));
    });
  });
}

/**
 * Main function - run both scripts in sequence
 */
async function syncAll() {
  console.log('\n' + '='.repeat(80));
  console.log('🔄 COMBINED SYNC: NinjaRMM → Monday → Kiosk Health');
  console.log('='.repeat(80));
  console.log('\nThis will run two operations in sequence:');
  console.log('  1. Sync tickets from NinjaRMM to Monday.com');
  console.log('  2. Update kiosk health statuses based on tickets');
  console.log();

  try {
    // Step 1: Sync tickets from NinjaRMM
    await runScript(
      join(__dirname, 'sync.js'),
      'Ninja → Monday Sync'
    );

    // Step 2: Update kiosk health statuses
    await runScript(
      join(__dirname, 'update-health-status.js'),
      'Kiosk Health Status Update'
    );

    console.log('\n' + '='.repeat(80));
    console.log('✅ ALL OPERATIONS COMPLETED SUCCESSFULLY');
    console.log('='.repeat(80));
    console.log('\nSummary:');
    console.log('  ✓ Tickets synced from NinjaRMM to Monday.com');
    console.log('  ✓ Kiosk health statuses updated');
    console.log();

  } catch (error) {
    console.error('\n' + '='.repeat(80));
    console.error('❌ SYNC FAILED');
    console.error('='.repeat(80));
    console.error(`\nError: ${error.message}\n`);
    process.exit(1);
  }
}

// Run the combined sync
syncAll();
