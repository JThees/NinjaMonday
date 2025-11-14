/**
 * Update Kiosk Health Status based on Ticket Status
 *
 * Logic:
 * - Most recent ticket (by Date) determines the kiosk's health status
 * - Maps ticket status to health status per configuration
 * - Only updates when health status would change
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFile } from 'fs/promises';
import { MondayClient } from './monday-client.js';
import { Logger, toShortKioskId } from './utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

// Load configuration
const configPath = join(__dirname, '..', 'config', 'field-mappings.json');
const configData = await readFile(configPath, 'utf-8');
const config = JSON.parse(configData);

const CONFIG = {
  MONDAY: {
    API_TOKEN: process.env.MONDAY_API_TOKEN,
    KIOSKS_BOARD_ID: process.env.MONDAY_KIOSKS_BOARD_ID,
    TICKETS_BOARD_ID: process.env.MONDAY_TICKETS_BOARD_ID
  },
  COLUMNS: {
    TICKETS: {
      KIOSK: config.monday_columns.kiosk.id,
      STATUS: config.monday_columns.status.id,
      DATE: config.monday_columns.date.id
    },
    KIOSKS: {
      HEALTH: config.kiosk_health_column.id
    }
  },
  HEALTH_MAPPING: config.health_status_mapping
};

const logger = new Logger(true);

/**
 * Sleep helper
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Extract kiosk ID from ticket
 */
function getKioskId(ticket) {
  const kioskColumn = ticket.column_values.find(c => c.id === CONFIG.COLUMNS.TICKETS.KIOSK);
  return kioskColumn?.text?.trim() || null;
}

/**
 * Extract status from ticket
 */
function getTicketStatus(ticket) {
  const statusColumn = ticket.column_values.find(c => c.id === CONFIG.COLUMNS.TICKETS.STATUS);
  return statusColumn?.text?.trim() || '';
}

/**
 * Extract date from ticket
 */
function getTicketDate(ticket) {
  const dateColumn = ticket.column_values.find(c => c.id === CONFIG.COLUMNS.TICKETS.DATE);
  return dateColumn?.text || null;
}

/**
 * Map ticket status to health status
 */
function mapToHealthStatus(ticketStatus) {
  const mapped = CONFIG.HEALTH_MAPPING[ticketStatus];
  if (!mapped) {
    logger.warn(`Unknown ticket status: "${ticketStatus}" - using UNKNOWN`);
    return 'UNKNOWN';
  }
  return mapped;
}

/**
 * Get current health status from kiosk
 */
function getCurrentHealthStatus(kiosk) {
  const healthColumn = kiosk.column_values.find(c => c.id === CONFIG.COLUMNS.KIOSKS.HEALTH);
  return healthColumn?.text?.trim() || '';
}

/**
 * Main update function
 */
async function updateHealthStatus() {
  logger.header('🏥 UPDATE KIOSK HEALTH STATUS');

  console.log('📋 Configuration:');
  console.log(`  Tickets Board: ${CONFIG.MONDAY.TICKETS_BOARD_ID}`);
  console.log(`  Kiosks Board: ${CONFIG.MONDAY.KIOSKS_BOARD_ID}`);
  console.log(`  Health Status Mapping:`);
  Object.entries(CONFIG.HEALTH_MAPPING).forEach(([ticket, health]) => {
    const label = ticket || '(blank)';
    console.log(`    ${label} → ${health}`);
  });
  console.log();

  const mondayClient = new MondayClient(CONFIG.MONDAY.API_TOKEN);

  try {
    // Step 1: Fetch all kiosks
    logger.section('Step 1: Fetching kiosks from ILH Kiosks board');
    const kiosks = await mondayClient.getBoardItems(CONFIG.MONDAY.KIOSKS_BOARD_ID);
    logger.success(`Fetched ${kiosks.length} kiosks`);

    // Build kiosk lookup by name (kiosk ID)
    const kioskMap = new Map();
    kiosks.forEach(kiosk => {
      // Kiosk ID is in the name, format: IBF-0136058
      // We want the short form: 6058 (last 4 digits)
      const fullId = kiosk.name;
      const shortId = toShortKioskId(fullId);
      kioskMap.set(shortId, {
        id: kiosk.id,
        name: fullId,
        shortId: shortId,
        currentHealth: getCurrentHealthStatus(kiosk)
      });
    });
    logger.info(`Built lookup map for ${kioskMap.size} kiosks`);

    // Step 2: Fetch all tickets
    logger.section('Step 2: Fetching tickets from Tickets board');
    const tickets = await mondayClient.getBoardItems(CONFIG.MONDAY.TICKETS_BOARD_ID);
    logger.success(`Fetched ${tickets.length} tickets`);

    // Step 3: Group tickets by kiosk, find most recent per kiosk
    logger.section('Step 3: Finding most recent ticket per kiosk');
    const kioskTickets = new Map(); // kioskId -> most recent ticket

    for (const ticket of tickets) {
      const kioskId = getKioskId(ticket);
      if (!kioskId) {
        logger.warn(`Ticket ${ticket.name} has no kiosk ID - skipping`);
        continue;
      }

      const ticketStatus = getTicketStatus(ticket);
      const ticketDate = getTicketDate(ticket);

      // Check if this ticket is more recent than current stored ticket for this kiosk
      const existing = kioskTickets.get(kioskId);

      if (!existing) {
        kioskTickets.set(kioskId, { ticket, status: ticketStatus, date: ticketDate });
      } else {
        // Compare dates - keep most recent
        if (ticketDate && (!existing.date || ticketDate > existing.date)) {
          kioskTickets.set(kioskId, { ticket, status: ticketStatus, date: ticketDate });
        }
      }
    }

    logger.success(`Found tickets for ${kioskTickets.size} kiosks`);

    // Step 4: Update health status for each kiosk
    logger.section('Step 4: Updating kiosk health statuses');

    let updateCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (const [kioskId, { ticket, status, date }] of kioskTickets) {
      const kiosk = kioskMap.get(kioskId);

      if (!kiosk) {
        logger.warn(`Kiosk ${kioskId} not found in ILH Kiosks board`);
        errorCount++;
        continue;
      }

      const newHealth = mapToHealthStatus(status);
      const currentHealth = kiosk.currentHealth;

      // Only update if health status would change
      if (currentHealth === newHealth) {
        logger.info(`Kiosk ${kioskId}: Already ${newHealth} - skipping`);
        skipCount++;
        continue;
      }

      logger.info(`Updating ${kioskId}: ${currentHealth || '(blank)'} → ${newHealth} (from ticket ${ticket.name}, status: ${status})`);

      try {
        await mondayClient.updateItem(
          CONFIG.MONDAY.KIOSKS_BOARD_ID,
          kiosk.id,
          {
            [CONFIG.COLUMNS.KIOSKS.HEALTH]: { label: newHealth }
          }
        );
        logger.success(`✓ Updated ${kioskId}`);
        updateCount++;

        // Small delay to avoid rate limits
        await sleep(300);
      } catch (error) {
        logger.error(`Failed to update ${kioskId}: ${error.message}`);
        errorCount++;
      }
    }

    // Step 5: Handle kiosks with no tickets
    logger.section('Step 5: Handling kiosks with no tickets');
    let noTicketCount = 0;

    for (const [kioskId, kiosk] of kioskMap) {
      if (!kioskTickets.has(kioskId)) {
        const currentHealth = kiosk.currentHealth;
        const newHealth = 'HEALTHY'; // Kiosks with no tickets are healthy

        if (currentHealth === newHealth) {
          skipCount++;
          continue;
        }

        logger.info(`Kiosk ${kioskId} has no tickets: ${currentHealth || '(blank)'} → ${newHealth}`);

        try {
          await mondayClient.updateItem(
            CONFIG.MONDAY.KIOSKS_BOARD_ID,
            kiosk.id,
            {
              [CONFIG.COLUMNS.KIOSKS.HEALTH]: { label: newHealth }
            }
          );
          logger.success(`✓ Updated ${kioskId}`);
          noTicketCount++;
          updateCount++;

          await sleep(300);
        } catch (error) {
          logger.error(`Failed to update ${kioskId}: ${error.message}`);
          errorCount++;
        }
      }
    }

    // Final summary
    logger.section('SUMMARY');
    console.log(`Total kiosks: ${kioskMap.size}`);
    console.log(`Kiosks with tickets: ${kioskTickets.size}`);
    console.log(`Kiosks without tickets: ${noTicketCount}`);
    console.log(`✅ Updated: ${updateCount}`);
    console.log(`⏭️  Skipped (no change): ${skipCount}`);
    console.log(`❌ Errors: ${errorCount}`);

  } catch (error) {
    logger.error(`Fatal error: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

// Run the update
updateHealthStatus();
