/**
 * Dry-Run Sync: NinjaRMM Tickets → Monday.com
 *
 * This script previews what would be synced without actually creating items.
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { NinjaClient } from './ninja-client.js';
import { MondayClient } from './monday-client.js';
import {
  Logger,
  toFullKioskId,
  toShortKioskId,
  unixToDate,
  getAttributeValue,
  getServiceCallValue,
  buildKioskLookupMap,
  formatTicketSummary
} from './utils.js';
import { mapStatus } from './status-mapping.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

// Configuration
const CONFIG = {
  NINJA: {
    CLIENT_ID: process.env.NINJA_CLIENT_ID,
    CLIENT_SECRET: process.env.NINJA_CLIENT_SECRET,
    BASE_URL: process.env.NINJA_BASE_URL || 'https://app.ninjarmm.com'
  },
  MONDAY: {
    API_TOKEN: process.env.MONDAY_API_TOKEN,
    KIOSKS_BOARD_ID: process.env.MONDAY_KIOSKS_BOARD_ID,
    TICKETS_BOARD_ID: process.env.MONDAY_TICKETS_BOARD_ID
  },
  // Monday.com column IDs (from Phase 1 findings)
  MONDAY_COLUMNS: {
    KIOSK: 'text_mkx0wqmq',
    DATE: 'date4',
    COUNTY: 'text_mkwzhc6k',
    LOCATION: 'text_mkwzt5ce',
    CORE_ISSUE: 'tag_mkwzqtky',
    STATUS: 'status',
    NINJA_TICKET_ID: 'text_mkxn628j',
    SERVICE_CALL: 'dropdown_mkwznn43'
  },
  NINJA_ATTRIBUTES: {
    KIOSK_ID: 54,
    COUNTY: 10,
    SERVICE_CHECKBOX: 80 // Service checkbox: "Resulted in a service call"
  },
  NINJA_BOARD_IDS: [2],
  // Only sync tickets created on or after this date
  MIN_CREATE_DATE: new Date('2025-07-01T00:00:00Z')
};

const logger = new Logger(true);

/**
 * Main sync function
 */
async function syncDryRun() {
  logger.header('🔄 NINJA → MONDAY SYNC (DRY RUN)');

  console.log('📋 Configuration:');
  console.log(`  Ninja Boards: ${CONFIG.NINJA_BOARD_IDS.join(', ')}`);
  console.log(`  Monday Kiosks Board: ${CONFIG.MONDAY.KIOSKS_BOARD_ID}`);
  console.log(`  Monday Tickets Board: ${CONFIG.MONDAY.TICKETS_BOARD_ID}`);
  console.log(`  Mode: DRY RUN (no items will be created)`);
  console.log();

  // Initialize clients
  const ninjaClient = new NinjaClient(
    CONFIG.NINJA.CLIENT_ID,
    CONFIG.NINJA.CLIENT_SECRET
  );

  const mondayClient = new MondayClient(
    CONFIG.MONDAY.API_TOKEN
  );

  try {
    // Step 1: Fetch kiosks from Monday for enrichment
    logger.section('Step 1: Fetching kiosk data from Monday.com ILH Kiosks board');
    const kiosks = await mondayClient.getBoardItems(CONFIG.MONDAY.KIOSKS_BOARD_ID);
    logger.success(`Fetched ${kiosks.length} kiosks`);

    const kioskLookup = buildKioskLookupMap(kiosks);
    logger.info(`Built lookup map for ${kioskLookup.size} kiosks`);

    // Step 2: Get next item number
    logger.section('Step 2: Getting next item number');
    let nextItemNumber = await mondayClient.getNextItemNumber(CONFIG.MONDAY.TICKETS_BOARD_ID);
    logger.success(`Would start from item number: ${nextItemNumber}`);

    // Step 3: Fetch existing Ninja Ticket IDs from Monday for duplicate detection
    logger.section('Step 3: Fetching existing tickets from Monday.com for duplicate detection');
    const existingTicketIds = await mondayClient.getExistingNinjaTicketIds(
      CONFIG.MONDAY.TICKETS_BOARD_ID,
      CONFIG.MONDAY_COLUMNS.NINJA_TICKET_ID
    );
    logger.success(`Found ${existingTicketIds.size} existing tickets in Monday`);

    // Step 4: Fetch all tickets from NinjaRMM
    logger.section('Step 4: Fetching tickets from NinjaRMM');
    const allTickets = await ninjaClient.getAllTickets(CONFIG.NINJA_BOARD_IDS);
    logger.success(`Fetched ${allTickets.length} tickets from NinjaRMM`);

    // Filter by date (only tickets created on or after MIN_CREATE_DATE)
    const minCreateTimestamp = CONFIG.MIN_CREATE_DATE.getTime() / 1000; // Convert to Unix timestamp
    const ninjaTickets = allTickets.filter(t => t.createTime >= minCreateTimestamp);
    logger.info(`${ninjaTickets.length} tickets created on or after ${CONFIG.MIN_CREATE_DATE.toISOString().split('T')[0]}`);

    // Step 5: Process and transform tickets
    logger.section('Step 5: Processing tickets (DRY RUN)');

    const itemsToCreate = [];
    logger.stats.total = ninjaTickets.length;

    for (const ticket of ninjaTickets) {
      const ticketId = String(ticket.id);

      // Check for duplicate
      if (existingTicketIds.has(ticketId)) {
        logger.skip(`Ticket #${ticketId} already exists in Monday`);
        continue;
      }

      // Extract data from Ninja ticket
      const fullKioskId = ticket.device || null;
      const shortKioskId = fullKioskId ? toShortKioskId(fullKioskId) : null;
      const date = unixToDate(ticket.createTime);
      const tags = ticket.tags || [];
      const ninjaStatus = ticket.status?.displayName || 'Unknown';
      const mondayStatus = mapStatus(ninjaStatus);

      // Get county from NinjaRMM attribute values as baseline
      const ninjaCounty = getAttributeValue(ticket.attributeValues, CONFIG.NINJA_ATTRIBUTES.COUNTY);

      // Enrich with kiosk data (overwrites if available)
      let county = ninjaCounty;
      let location = ticket.location || null;
      let kioskNotFound = false;

      if (shortKioskId) {
        const kioskData = kioskLookup.get(shortKioskId);
        if (kioskData) {
          if (kioskData.county) county = kioskData.county;
          if (kioskData.location) location = kioskData.location;
        } else {
          logger.warn(`Kiosk ${shortKioskId} not found in ILH Kiosks board for ticket #${ticketId}`);
          kioskNotFound = true;
        }
      } else if (!shortKioskId && !county) {
        logger.warn(`Ticket #${ticketId} has no kiosk ID or county`);
      }

      // Build Monday.com column values
      // Get service call value if configured
      const serviceCallLabelId = getServiceCallValue(
        ticket.attributeValues,
        CONFIG.NINJA_ATTRIBUTES.SERVICE_CHECKBOX
      );

      const columnValues = {
        [CONFIG.MONDAY_COLUMNS.NINJA_TICKET_ID]: ticketId,
        [CONFIG.MONDAY_COLUMNS.KIOSK]: shortKioskId || '',
        [CONFIG.MONDAY_COLUMNS.DATE]: date || '',
        [CONFIG.MONDAY_COLUMNS.COUNTY]: county || '',
        [CONFIG.MONDAY_COLUMNS.LOCATION]: location || '',
        [CONFIG.MONDAY_COLUMNS.STATUS]: mondayStatus
      };

      // Add service call if value is available
      if (serviceCallLabelId !== null) {
        columnValues[CONFIG.MONDAY_COLUMNS.SERVICE_CALL] = { labels: [serviceCallLabelId] };
      }

      // Skip tags for now - Monday.com needs pre-existing tag IDs, not tag names
      // Tags can be manually added in Monday.com or we can create a tag mapping later
      // if (tags.length > 0) {
      //   columnValues[CONFIG.MONDAY_COLUMNS.CORE_ISSUE] = { tag_ids: tags };
      // }

      // Preview item
      const itemName = String(nextItemNumber);

      itemsToCreate.push({
        name: itemName,
        columnValues,
        ninjaTicket: ticket
      });

      // Log what would be created
      logger.success(`Would create: Item #${itemName} (Ninja Ticket #${ticketId})`);
      console.log(`  Device: ${fullKioskId || 'N/A'}`);
      console.log(`  Kiosk ID: ${shortKioskId || 'N/A'}${kioskNotFound ? ' ⚠️ NOT FOUND IN ILH KIOSKS' : ''}`);
      console.log(`  Date: ${date || 'N/A'}`);
      console.log(`  County: ${county || 'N/A'}`);
      console.log(`  Location: ${location || 'N/A'}`);
      console.log(`  Status: ${ninjaStatus} → ${mondayStatus}`);
      console.log(`  Tags: ${tags.length > 0 ? tags.join(', ') : 'None'}`);
      console.log(`  Service Call: ${serviceCallLabelId || 'Not Set'}`);
      console.log(`  Summary: ${ticket.summary?.substring(0, 60)}${ticket.summary?.length > 60 ? '...' : ''}`);
      console.log();

      // Increment item number for next item
      nextItemNumber++;
    }

    // Step 6: Summary
    logger.printStats();

    if (itemsToCreate.length > 0) {
      console.log('💡 TIP: To actually create these items, run the full sync script (not yet implemented).');
      console.log();

      // Save preview data to file
      const fs = await import('fs/promises');
      const previewData = {
        timestamp: new Date().toISOString(),
        stats: logger.stats,
        itemsToCreate: itemsToCreate.map(item => ({
          name: item.name,
          columnValues: item.columnValues,
          ninjaSummary: item.ninjaTicket.summary
        }))
      };

      const previewPath = join(__dirname, '..', 'sync-preview.json');
      await fs.writeFile(previewPath, JSON.stringify(previewData, null, 2));
      logger.info(`Preview data saved to: sync-preview.json`);
    }

  } catch (error) {
    logger.error(`Sync failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

// Run sync
syncDryRun().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
