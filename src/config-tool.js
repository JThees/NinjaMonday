/**
 * Field Mapping Configuration Tool
 *
 * Allows viewing and updating field mappings without editing code
 * Usage:
 *   node src/config-tool.js view
 *   node src/config-tool.js add-status "New Status" "Working on it"
 *   node src/config-tool.js update-column kiosk text_NEW_ID
 *   node src/config-tool.js update-date 2025-06-01
 */
import { readFile, writeFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const configPath = join(__dirname, '..', 'config', 'field-mappings.json');

async function loadConfig() {
  const data = await readFile(configPath, 'utf-8');
  return JSON.parse(data);
}

async function saveConfig(config) {
  await writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

function printConfig(config) {
  console.log('\n📋 CURRENT CONFIGURATION\n');
  console.log('='.repeat(80));

  console.log('\n🔹 Monday.com Column Mappings:');
  console.log('-'.repeat(80));
  for (const [key, value] of Object.entries(config.monday_columns)) {
    console.log(`  ${key.padEnd(20)} → ${value.id.padEnd(20)} (${value.title})`);
  }

  console.log('\n🔹 NinjaRMM Attribute Mappings:');
  console.log('-'.repeat(80));
  for (const [key, value] of Object.entries(config.ninja_attributes)) {
    console.log(`  ${key.padEnd(20)} → Attribute ID: ${value.id}`);
  }

  console.log('\n🔹 Status Mappings (NinjaRMM → Monday.com):');
  console.log('-'.repeat(80));
  for (const [ninjaStatus, mondayStatus] of Object.entries(config.status_mapping)) {
    console.log(`  ${ninjaStatus.padEnd(30)} → ${mondayStatus}`);
  }

  console.log('\n🔹 Sync Settings:');
  console.log('-'.repeat(80));
  console.log(`  Min Create Date:      ${config.sync_settings.min_create_date}`);
  console.log(`  Ninja Board IDs:      ${config.sync_settings.ninja_board_ids.join(', ')}`);
  console.log(`  Delay (create):       ${config.sync_settings.delay_between_items_ms}ms`);
  console.log(`  Delay (update):       ${config.sync_settings.delay_between_updates_ms}ms`);
  console.log(`  Retry Attempts:       ${config.sync_settings.retry_attempts}`);

  console.log('\n' + '='.repeat(80));
  console.log();
}

async function addStatusMapping(ninjaStatus, mondayStatus) {
  const config = await loadConfig();
  config.status_mapping[ninjaStatus] = mondayStatus;
  await saveConfig(config);
  console.log(`✅ Added status mapping: "${ninjaStatus}" → "${mondayStatus}"`);
}

async function removeStatusMapping(ninjaStatus) {
  const config = await loadConfig();
  if (config.status_mapping[ninjaStatus]) {
    delete config.status_mapping[ninjaStatus];
    await saveConfig(config);
    console.log(`✅ Removed status mapping: "${ninjaStatus}"`);
  } else {
    console.log(`⚠️  Status mapping "${ninjaStatus}" not found`);
  }
}

async function updateColumn(columnName, newId) {
  const config = await loadConfig();
  if (config.monday_columns[columnName]) {
    const oldId = config.monday_columns[columnName].id;
    config.monday_columns[columnName].id = newId;
    await saveConfig(config);
    console.log(`✅ Updated column "${columnName}": ${oldId} → ${newId}`);
  } else {
    console.log(`⚠️  Column "${columnName}" not found`);
    console.log(`   Available columns: ${Object.keys(config.monday_columns).join(', ')}`);
  }
}

async function updateMinDate(newDate) {
  const config = await loadConfig();
  const oldDate = config.sync_settings.min_create_date;

  // Validate date format
  try {
    new Date(newDate);
    config.sync_settings.min_create_date = newDate;
    await saveConfig(config);
    console.log(`✅ Updated min create date: ${oldDate} → ${newDate}`);
  } catch (error) {
    console.log(`❌ Invalid date format: ${newDate}`);
    console.log(`   Use ISO format: YYYY-MM-DDTHH:MM:SSZ (e.g., 2025-07-01T00:00:00Z)`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    const config = await loadConfig();

    switch (command) {
      case 'view':
      case undefined:
        printConfig(config);
        break;

      case 'add-status':
        if (args.length < 3) {
          console.log('Usage: node src/config-tool.js add-status "NinjaStatus" "MondayStatus"');
        } else {
          await addStatusMapping(args[1], args[2]);
        }
        break;

      case 'remove-status':
        if (args.length < 2) {
          console.log('Usage: node src/config-tool.js remove-status "NinjaStatus"');
        } else {
          await removeStatusMapping(args[1]);
        }
        break;

      case 'update-column':
        if (args.length < 3) {
          console.log('Usage: node src/config-tool.js update-column <column_name> <new_id>');
          console.log('Example: node src/config-tool.js update-column kiosk text_NEW_ID');
        } else {
          await updateColumn(args[1], args[2]);
        }
        break;

      case 'update-date':
        if (args.length < 2) {
          console.log('Usage: node src/config-tool.js update-date YYYY-MM-DDTHH:MM:SSZ');
          console.log('Example: node src/config-tool.js update-date 2025-06-01T00:00:00Z');
        } else {
          await updateMinDate(args[1]);
        }
        break;

      case 'help':
        console.log('\n📋 Configuration Tool - Available Commands:\n');
        console.log('  view                                  View current configuration');
        console.log('  add-status <ninja> <monday>           Add status mapping');
        console.log('  remove-status <ninja>                 Remove status mapping');
        console.log('  update-column <name> <id>             Update Monday column ID');
        console.log('  update-date <date>                    Update minimum sync date');
        console.log('  help                                  Show this help');
        console.log();
        console.log('Examples:');
        console.log('  node src/config-tool.js view');
        console.log('  node src/config-tool.js add-status "In Progress" "Working on it"');
        console.log('  node src/config-tool.js update-date 2025-06-01T00:00:00Z');
        console.log();
        break;

      default:
        console.log(`❌ Unknown command: ${command}`);
        console.log('Run "node src/config-tool.js help" for available commands');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
