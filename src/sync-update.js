/**
 * Update Sync: Update existing Monday items with latest NinjaRMM data
 *
 * This script updates existing Monday items when NinjaRMM data changes
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { NinjaClient } from './ninja-client.js';
import { MondayClient } from './monday-client.js';
import {
  Logger,
  toShortKioskId,
  unixToDate,
  getAttributeValue,
  getServiceCallValue,
  buildKioskLookupMap
} from './utils.js';
import { mapStatus } from './status-mapping.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

// Configuration
const CONFIG = {
  NINJA: {
    CLIENT_ID: process.env.NINJA_CLIENT_ID,
    CLIENT_SECRET: process.env.NINJA_CLIENT_SECRET
  },
  MONDAY: {
    API_TOKEN: process.env.MONDAY_API_TOKEN,
    KIOSKS_BOARD_ID: process.env.MONDAY_KIOSKS_BOARD_ID,
    TICKETS_BOARD_ID: process.env.MONDAY_TICKETS_BOARD_ID
  },
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
  MIN_CREATE_DATE: new Date('2025-07-01T00:00:00Z'),
  DELAY_BETWEEN_UPDATES: 500 // ms delay between updates
};

const logger = new Logger(true);

/**
 * Sleep helper
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Compare and build update payload if changes detected
 */
function buildUpdatePayload(ninjaTicket, mondayItem, kioskLookup, existingTags) {
  const updates = {};
  let hasChanges = false;

  // Extract data from Ninja ticket
  const fullKioskId = ninjaTicket.device || null;
  const shortKioskId = fullKioskId ? toShortKioskId(fullKioskId) : null;
  const date = unixToDate(ninjaTicket.createTime);
  const tags = ninjaTicket.tags || [];
  const ninjaStatus = ninjaTicket.status?.displayName || 'Unknown';
  const mondayStatus = mapStatus(ninjaStatus);

  // Get county from NinjaRMM attribute values as baseline
  const ninjaCounty = getAttributeValue(ninjaTicket.attributeValues, CONFIG.NINJA_ATTRIBUTES.COUNTY);

  // Enrich with kiosk data
  let county = ninjaCounty;
  let location = ninjaTicket.location || null;

  if (shortKioskId) {
    const kioskData = kioskLookup.get(shortKioskId);
    if (kioskData) {
      if (kioskData.county) county = kioskData.county;
      if (kioskData.location) location = kioskData.location;
    }
  }

  // Compare each field with Monday data
  const mondayColumns = mondayItem.column_values;

  // Kiosk ID
  const mondayKiosk = mondayColumns.find(cv => cv.id === CONFIG.MONDAY_COLUMNS.KIOSK)?.text || '';
  if ((shortKioskId || '') !== mondayKiosk) {
    updates[CONFIG.MONDAY_COLUMNS.KIOSK] = shortKioskId || '';
    hasChanges = true;
  }

  // Date
  const mondayDate = mondayColumns.find(cv => cv.id === CONFIG.MONDAY_COLUMNS.DATE)?.text || '';
  if ((date || '') !== mondayDate) {
    updates[CONFIG.MONDAY_COLUMNS.DATE] = date || '';
    hasChanges = true;
  }

  // County
  const mondayCounty = mondayColumns.find(cv => cv.id === CONFIG.MONDAY_COLUMNS.COUNTY)?.text || '';
  if ((county || '') !== mondayCounty) {
    updates[CONFIG.MONDAY_COLUMNS.COUNTY] = county || '';
    hasChanges = true;
  }

  // Location
  const mondayLocation = mondayColumns.find(cv => cv.id === CONFIG.MONDAY_COLUMNS.LOCATION)?.text || '';
  if ((location || '') !== mondayLocation) {
    updates[CONFIG.MONDAY_COLUMNS.LOCATION] = location || '';
    hasChanges = true;
  }

  // Status
  const mondayStatusCol = mondayColumns.find(cv => cv.id === CONFIG.MONDAY_COLUMNS.STATUS);
  const mondayStatusText = mondayStatusCol?.text || '';
  if (mondayStatus !== mondayStatusText) {
    updates[CONFIG.MONDAY_COLUMNS.STATUS] = mondayStatus;
    hasChanges = true;
  }

  // Service Call
  const serviceCallLabel = getServiceCallValue(
    ninjaTicket.attributeValues,
    CONFIG.NINJA_ATTRIBUTES.SERVICE_CHECKBOX
  );
  if (serviceCallLabel !== null) {
    const mondayServiceCall = mondayColumns.find(cv => cv.id === CONFIG.MONDAY_COLUMNS.SERVICE_CALL);
    const mondayServiceCallText = mondayServiceCall?.text || '';
    if (serviceCallLabel !== mondayServiceCallText) {
      updates[CONFIG.MONDAY_COLUMNS.SERVICE_CALL] = { labels: [serviceCallLabel] };
      hasChanges = true;
    }
  }

  return { hasChanges, updates, tags };
}

/**
 * Main update function
 */
async function syncUpdate() {
  logger.header('🔄 NINJA → MONDAY UPDATE SYNC');

  console.log('📋 Configuration:');
  console.log(`  Ninja Boards: ${CONFIG.NINJA_BOARD_IDS.join(', ')}`);
  console.log(`  Monday Kiosks Board: ${CONFIG.MONDAY.KIOSKS_BOARD_ID}`);
  console.log(`  Monday Tickets Board: ${CONFIG.MONDAY.TICKETS_BOARD_ID}`);
  console.log(`  Mode: UPDATE SYNC (existing items will be updated)`);
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

    // Step 2: Fetch existing tags
    logger.section('Step 2: Fetching existing tags from Monday.com');
    const existingTags = await mondayClient.getExistingTags(
      CONFIG.MONDAY.TICKETS_BOARD_ID,
      CONFIG.MONDAY_COLUMNS.CORE_ISSUE
    );
    logger.success(`Found ${existingTags.size} existing tags`);

    // Step 3: Fetch all existing Monday items
    logger.section('Step 3: Fetching existing tickets from Monday.com');
    const mondayItems = await mondayClient.getBoardItems(CONFIG.MONDAY.TICKETS_BOARD_ID);
    logger.success(`Fetched ${mondayItems.length} items from Monday`);

    // Build map of Ninja Ticket ID -> Monday Item
    const mondayItemMap = new Map();
    for (const item of mondayItems) {
      const ninjaIdColumn = item.column_values.find(cv => cv.id === CONFIG.MONDAY_COLUMNS.NINJA_TICKET_ID);
      if (ninjaIdColumn && ninjaIdColumn.text) {
        mondayItemMap.set(ninjaIdColumn.text.trim(), item);
      }
    }
    logger.info(`Mapped ${mondayItemMap.size} Monday items by Ninja Ticket ID`);

    // Step 4: Fetch all tickets from NinjaRMM
    logger.section('Step 4: Fetching tickets from NinjaRMM');
    const allTickets = await ninjaClient.getAllTickets(CONFIG.NINJA_BOARD_IDS);
    logger.success(`Fetched ${allTickets.length} tickets from NinjaRMM`);

    // Filter by date
    const minCreateTimestamp = CONFIG.MIN_CREATE_DATE.getTime() / 1000;
    const ninjaTickets = allTickets.filter(t => t.createTime >= minCreateTimestamp);
    logger.info(`${ninjaTickets.length} tickets created on or after ${CONFIG.MIN_CREATE_DATE.toISOString().split('T')[0]}`);

    // Step 5: Compare and update items
    logger.section('Step 5: Comparing and updating items');

    let updateCount = 0;
    let unchangedCount = 0;
    let notFoundCount = 0;

    for (const ticket of ninjaTickets) {
      const ticketId = String(ticket.id);
      const mondayItem = mondayItemMap.get(ticketId);

      if (!mondayItem) {
        logger.warn(`Ticket #${ticketId} not found in Monday (use sync script to create it)`);
        notFoundCount++;
        continue;
      }

      // Compare and build update payload
      const { hasChanges, updates, tags } = buildUpdatePayload(ticket, mondayItem, kioskLookup, existingTags);

      if (!hasChanges && tags.length === 0) {
        unchangedCount++;
        continue;
      }

      // Handle tags
      if (tags.length > 0) {
        const tagIds = await mondayClient.ensureTags(
          CONFIG.MONDAY.TICKETS_BOARD_ID,
          tags,
          existingTags
        );
        updates[CONFIG.MONDAY_COLUMNS.CORE_ISSUE] = { tag_ids: tagIds };
      }

      // Perform update
      try {
        logger.info(`Updating Monday item "${mondayItem.name}" (Ticket #${ticketId})`);

        const columnValuesJson = JSON.stringify(updates).replace(/"/g, '\\"');

        const mutation = `mutation {
          change_multiple_column_values(
            item_id: ${mondayItem.id},
            board_id: ${CONFIG.MONDAY.TICKETS_BOARD_ID},
            column_values: "${columnValuesJson}"
          ) {
            id
          }
        }`;

        await mondayClient.query(mutation);

        logger.success(`Updated Monday item "${mondayItem.name}"`);
        updateCount++;

        // Rate limiting
        await sleep(CONFIG.DELAY_BETWEEN_UPDATES);

      } catch (error) {
        logger.error(`Failed to update ticket #${ticketId}: ${error.message}`);
      }
    }

    // Step 6: Summary
    logger.section('Update Summary');
    console.log(`Total tickets checked: ${ninjaTickets.length}`);
    console.log(`✅ Updated: ${updateCount}`);
    console.log(`⏭️  Unchanged: ${unchangedCount}`);
    console.log(`⚠️  Not found in Monday: ${notFoundCount}`);
    console.log();

    console.log('✅ Update sync complete!');
    console.log();

  } catch (error) {
    logger.error(`Update sync failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

// Run update sync
syncUpdate().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
