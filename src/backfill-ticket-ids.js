/**
 * Backfill Ninja Ticket IDs for manually entered Monday items
 *
 * This script finds Monday items without a Ninja Ticket ID and attempts to match them
 * to NinjaRMM tickets based on kiosk ID, date, and summary similarity.
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { NinjaClient } from './ninja-client.js';
import { MondayClient } from './monday-client.js';
import {
  Logger,
  toShortKioskId,
  unixToDate
} from './utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

const CONFIG = {
  NINJA: {
    CLIENT_ID: process.env.NINJA_CLIENT_ID,
    CLIENT_SECRET: process.env.NINJA_CLIENT_SECRET
  },
  MONDAY: {
    API_TOKEN: process.env.MONDAY_API_TOKEN,
    TICKETS_BOARD_ID: process.env.MONDAY_TICKETS_BOARD_ID
  },
  MONDAY_COLUMNS: {
    KIOSK: 'text_mkx0wqmq',
    DATE: 'date4',
    NINJA_TICKET_ID: 'text_mkxkpphv'
  },
  NINJA_BOARD_IDS: [2],
  MIN_CREATE_DATE: new Date('2025-07-01T00:00:00Z')
};

const logger = new Logger(true);

/**
 * Calculate similarity between two strings (simple Levenshtein-like approach)
 */
function stringSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();

  if (s1 === s2) return 1;

  // Simple word overlap score
  const words1 = s1.split(/\s+/);
  const words2 = s2.split(/\s+/);

  let matches = 0;
  for (const word of words1) {
    if (words2.includes(word) && word.length > 3) {
      matches++;
    }
  }

  return matches / Math.max(words1.length, words2.length);
}

/**
 * Find best match for a Monday item
 */
function findBestMatch(mondayItem, ninjaTickets) {
  const mondayKiosk = mondayItem.column_values.find(cv => cv.id === CONFIG.MONDAY_COLUMNS.KIOSK)?.text || '';
  const mondayDate = mondayItem.column_values.find(cv => cv.id === CONFIG.MONDAY_COLUMNS.DATE)?.text || '';
  const mondayName = mondayItem.name || '';

  let bestMatch = null;
  let bestScore = 0;

  for (const ticket of ninjaTickets) {
    let score = 0;

    // Match on kiosk ID (high weight)
    const fullKioskId = ticket.device || null;
    const shortKioskId = fullKioskId ? toShortKioskId(fullKioskId) : null;
    if (shortKioskId && mondayKiosk && shortKioskId === mondayKiosk) {
      score += 50;
    }

    // Match on date (high weight)
    const ninjaDate = unixToDate(ticket.createTime);
    if (ninjaDate && mondayDate && ninjaDate === mondayDate) {
      score += 40;
    }

    // Match on summary similarity (medium weight)
    const summary = ticket.summary || '';
    const similarity = stringSimilarity(mondayName, summary);
    score += similarity * 30;

    if (score > bestScore) {
      bestScore = score;
      bestMatch = {
        ticket,
        score,
        matchedKiosk: shortKioskId === mondayKiosk,
        matchedDate: ninjaDate === mondayDate,
        summarySimilarity: similarity
      };
    }
  }

  return bestMatch;
}

/**
 * Main backfill function
 */
async function backfillTicketIds() {
  logger.header('🔄 BACKFILL NINJA TICKET IDs');

  console.log('📋 This tool finds Monday items without a Ninja Ticket ID');
  console.log('   and attempts to match them to NinjaRMM tickets.');
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
    // Step 1: Fetch all Monday items
    logger.section('Step 1: Fetching Monday items');
    const mondayItems = await mondayClient.getBoardItems(CONFIG.MONDAY.TICKETS_BOARD_ID);
    logger.success(`Fetched ${mondayItems.length} items from Monday`);

    // Find items without Ninja Ticket ID
    const itemsWithoutTicketId = mondayItems.filter(item => {
      const ninjaIdColumn = item.column_values.find(cv => cv.id === CONFIG.MONDAY_COLUMNS.NINJA_TICKET_ID);
      return !ninjaIdColumn || !ninjaIdColumn.text || ninjaIdColumn.text.trim() === '';
    });

    logger.info(`Found ${itemsWithoutTicketId.length} items without Ninja Ticket ID`);

    if (itemsWithoutTicketId.length === 0) {
      console.log('✅ All Monday items already have Ninja Ticket IDs!');
      return;
    }

    // Step 2: Fetch NinjaRMM tickets
    logger.section('Step 2: Fetching NinjaRMM tickets');
    const allTickets = await ninjaClient.getAllTickets(CONFIG.NINJA_BOARD_IDS);
    logger.success(`Fetched ${allTickets.length} tickets from NinjaRMM`);

    // Filter by date
    const minCreateTimestamp = CONFIG.MIN_CREATE_DATE.getTime() / 1000;
    const ninjaTickets = allTickets.filter(t => t.createTime >= minCreateTimestamp);
    logger.info(`${ninjaTickets.length} tickets created on or after ${CONFIG.MIN_CREATE_DATE.toISOString().split('T')[0]}`);

    // Step 3: Find matches
    logger.section('Step 3: Finding potential matches');

    const matches = [];

    for (const mondayItem of itemsWithoutTicketId) {
      const match = findBestMatch(mondayItem, ninjaTickets);

      if (match && match.score > 30) { // Only show matches with reasonable confidence
        matches.push({
          mondayItem,
          ...match
        });
      }
    }

    logger.success(`Found ${matches.length} potential matches (confidence > 30%)`);

    if (matches.length === 0) {
      console.log('⚠️  No confident matches found.');
      console.log('   Manual review may be needed.');
      return;
    }

    // Step 4: Display matches
    logger.section('Step 4: Potential Matches');

    console.log();
    console.log('The following matches were found:');
    console.log('='.repeat(80));

    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      console.log(`\n${i + 1}. Monday Item: "${match.mondayItem.name}" (ID: ${match.mondayItem.id})`);
      console.log(`   → Ninja Ticket #${match.ticket.id}: "${match.ticket.summary}"`);
      console.log(`   Score: ${match.score.toFixed(1)}% | Kiosk: ${match.matchedKiosk ? '✅' : '❌'} | Date: ${match.matchedDate ? '✅' : '❌'} | Summary: ${(match.summarySimilarity * 100).toFixed(0)}%`);
    }

    console.log('\n' + '='.repeat(80));
    console.log();
    console.log('📝 Review these matches carefully!');
    console.log();
    console.log('To apply these updates, run the following command:');
    console.log('  node src/backfill-ticket-ids.js --confirm');
    console.log();
    console.log('Or update the Ninja Ticket ID manually in NinjaRMM for better accuracy.');

  } catch (error) {
    logger.error(`Backfill failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

// Run backfill
backfillTicketIds().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
