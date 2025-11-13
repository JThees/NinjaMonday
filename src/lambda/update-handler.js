/**
 * AWS Lambda handler for update function
 * Wraps the sync-update.js logic for serverless deployment
 */
import { NinjaClient } from '../ninja-client.js';
import { MondayClient } from '../monday-client.js';
import {
  Logger,
  toShortKioskId,
  unixToDate,
  getAttributeValue,
  buildKioskLookupMap
} from '../utils.js';
import { mapStatus } from '../status-mapping.js';

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
    NINJA_TICKET_ID: 'text_mkxkpphv'
  },
  NINJA_ATTRIBUTES: {
    KIOSK_ID: 54,
    COUNTY: 10
  },
  NINJA_BOARD_IDS: [2],
  MIN_CREATE_DATE: new Date('2025-07-01T00:00:00Z'),
  DELAY_BETWEEN_UPDATES: 500
};

const logger = new Logger(true);

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export const handler = async (event, context) => {
  console.log('Starting update sync');

  const ninjaClient = new NinjaClient(
    CONFIG.NINJA.CLIENT_ID,
    CONFIG.NINJA.CLIENT_SECRET
  );

  const mondayClient = new MondayClient(
    CONFIG.MONDAY.API_TOKEN
  );

  try {
    // Fetch kiosks
    const kiosks = await mondayClient.getBoardItems(CONFIG.MONDAY.KIOSKS_BOARD_ID);
    const kioskLookup = buildKioskLookupMap(kiosks);

    // Fetch existing tags
    const existingTags = await mondayClient.getExistingTags(
      CONFIG.MONDAY.TICKETS_BOARD_ID,
      CONFIG.MONDAY_COLUMNS.CORE_ISSUE
    );

    // Fetch Monday items
    const mondayItems = await mondayClient.getBoardItems(CONFIG.MONDAY.TICKETS_BOARD_ID);

    // Build map
    const mondayItemMap = new Map();
    for (const item of mondayItems) {
      const ninjaIdColumn = item.column_values.find(cv => cv.id === CONFIG.MONDAY_COLUMNS.NINJA_TICKET_ID);
      if (ninjaIdColumn && ninjaIdColumn.text) {
        mondayItemMap.set(ninjaIdColumn.text.trim(), item);
      }
    }

    // Fetch NinjaRMM tickets
    const allTickets = await ninjaClient.getAllTickets(CONFIG.NINJA_BOARD_IDS);

    // Filter by date
    const minCreateTimestamp = CONFIG.MIN_CREATE_DATE.getTime() / 1000;
    const ninjaTickets = allTickets.filter(t => t.createTime >= minCreateTimestamp);

    let updateCount = 0;
    let unchangedCount = 0;

    for (const ticket of ninjaTickets) {
      const ticketId = String(ticket.id);
      const mondayItem = mondayItemMap.get(ticketId);

      if (!mondayItem) {
        continue;
      }

      const updates = {};
      let hasChanges = false;

      // Extract data
      const fullKioskId = ticket.device || null;
      const shortKioskId = fullKioskId ? toShortKioskId(fullKioskId) : null;
      const date = unixToDate(ticket.createTime);
      const tags = ticket.tags || [];
      const ninjaStatus = ticket.status?.displayName || 'Unknown';
      const mondayStatus = mapStatus(ninjaStatus);

      const ninjaCounty = getAttributeValue(ticket.attributeValues, CONFIG.NINJA_ATTRIBUTES.COUNTY);

      let county = ninjaCounty;
      let location = ticket.location || null;

      if (shortKioskId) {
        const kioskData = kioskLookup.get(shortKioskId);
        if (kioskData) {
          if (kioskData.county) county = kioskData.county;
          if (kioskData.location) location = kioskData.location;
        }
      }

      // Compare fields
      const mondayColumns = mondayItem.column_values;

      const mondayKiosk = mondayColumns.find(cv => cv.id === CONFIG.MONDAY_COLUMNS.KIOSK)?.text || '';
      if ((shortKioskId || '') !== mondayKiosk) {
        updates[CONFIG.MONDAY_COLUMNS.KIOSK] = shortKioskId || '';
        hasChanges = true;
      }

      const mondayDate = mondayColumns.find(cv => cv.id === CONFIG.MONDAY_COLUMNS.DATE)?.text || '';
      if ((date || '') !== mondayDate) {
        updates[CONFIG.MONDAY_COLUMNS.DATE] = date || '';
        hasChanges = true;
      }

      const mondayCounty = mondayColumns.find(cv => cv.id === CONFIG.MONDAY_COLUMNS.COUNTY)?.text || '';
      if ((county || '') !== mondayCounty) {
        updates[CONFIG.MONDAY_COLUMNS.COUNTY] = county || '';
        hasChanges = true;
      }

      const mondayLocation = mondayColumns.find(cv => cv.id === CONFIG.MONDAY_COLUMNS.LOCATION)?.text || '';
      if ((location || '') !== mondayLocation) {
        updates[CONFIG.MONDAY_COLUMNS.LOCATION] = location || '';
        hasChanges = true;
      }

      const mondayStatusCol = mondayColumns.find(cv => cv.id === CONFIG.MONDAY_COLUMNS.STATUS);
      const mondayStatusText = mondayStatusCol?.text || '';
      if (mondayStatus !== mondayStatusText) {
        updates[CONFIG.MONDAY_COLUMNS.STATUS] = mondayStatus;
        hasChanges = true;
      }

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

      // Update
      try {
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

        updateCount++;
        await sleep(CONFIG.DELAY_BETWEEN_UPDATES);

      } catch (error) {
        console.error(`Failed to update ticket #${ticketId}:`, error);
      }
    }

    const result = {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        updated: updateCount,
        unchanged: unchangedCount,
        total: ninjaTickets.length
      })
    };

    console.log('Update complete:', result.body);
    return result;

  } catch (error) {
    console.error('Update failed:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};
