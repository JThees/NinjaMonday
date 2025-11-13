/**
 * AWS Lambda handler for sync function
 * Wraps the sync.js logic for serverless deployment
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
  DELAY_BETWEEN_ITEMS: 500
};

const logger = new Logger(true);

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function createMondayItem(mondayClient, boardId, itemName, columnValues, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = await mondayClient.createItem(boardId, itemName, columnValues);
      return result;
    } catch (error) {
      if (attempt === retries) {
        throw error;
      }
      logger.warn(`Retry ${attempt}/${retries} for ${itemName}: ${error.message}`);
      await sleep(1000 * attempt);
    }
  }
}

export const handler = async (event, context) => {
  console.log('Starting NinjaRMM → Monday.com sync');

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

    // Get next item number
    let nextItemNumber = await mondayClient.getNextItemNumber(CONFIG.MONDAY.TICKETS_BOARD_ID);

    // Fetch existing tags
    const existingTags = await mondayClient.getExistingTags(
      CONFIG.MONDAY.TICKETS_BOARD_ID,
      CONFIG.MONDAY_COLUMNS.CORE_ISSUE
    );

    // Fetch existing ticket IDs
    const existingTicketIds = await mondayClient.getExistingNinjaTicketIds(
      CONFIG.MONDAY.TICKETS_BOARD_ID,
      CONFIG.MONDAY_COLUMNS.NINJA_TICKET_ID
    );

    // Fetch NinjaRMM tickets
    const allTickets = await ninjaClient.getAllTickets(CONFIG.NINJA_BOARD_IDS);

    // Filter by date
    const minCreateTimestamp = CONFIG.MIN_CREATE_DATE.getTime() / 1000;
    const ninjaTickets = allTickets.filter(t => t.createTime >= minCreateTimestamp);

    const itemsToCreate = [];

    // Prepare items
    for (const ticket of ninjaTickets) {
      const ticketId = String(ticket.id);

      if (existingTicketIds.has(ticketId)) {
        continue;
      }

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

      const columnValues = {
        [CONFIG.MONDAY_COLUMNS.NINJA_TICKET_ID]: ticketId,
        [CONFIG.MONDAY_COLUMNS.KIOSK]: shortKioskId || '',
        [CONFIG.MONDAY_COLUMNS.DATE]: date || '',
        [CONFIG.MONDAY_COLUMNS.COUNTY]: county || '',
        [CONFIG.MONDAY_COLUMNS.LOCATION]: location || '',
        [CONFIG.MONDAY_COLUMNS.STATUS]: mondayStatus
      };

      itemsToCreate.push({
        columnValues,
        ticket,
        tags
      });
    }

    // Create items
    let created = 0;
    let failed = 0;

    for (const item of itemsToCreate) {
      const itemName = String(nextItemNumber);

      try {
        if (item.tags && item.tags.length > 0) {
          const tagIds = await mondayClient.ensureTags(
            CONFIG.MONDAY.TICKETS_BOARD_ID,
            item.tags,
            existingTags
          );
          item.columnValues[CONFIG.MONDAY_COLUMNS.CORE_ISSUE] = { tag_ids: tagIds };
        }

        await createMondayItem(
          mondayClient,
          CONFIG.MONDAY.TICKETS_BOARD_ID,
          itemName,
          item.columnValues
        );

        created++;
        nextItemNumber++;

        await sleep(CONFIG.DELAY_BETWEEN_ITEMS);

      } catch (error) {
        console.error(`Failed to create ticket #${item.ticket.id}:`, error);
        failed++;
      }
    }

    const result = {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        created,
        failed,
        skipped: ninjaTickets.length - itemsToCreate.length,
        total: ninjaTickets.length
      })
    };

    console.log('Sync complete:', result.body);
    return result;

  } catch (error) {
    console.error('Sync failed:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};
