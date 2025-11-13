/**
 * Utility functions for NinjaRMM to Monday.com sync
 */

/**
 * Convert short kiosk ID to full format
 * @param {string} shortId - Short ID like "6058"
 * @returns {string} Full ID like "IBF-0136058"
 */
export function toFullKioskId(shortId) {
  if (!shortId) return null;
  return `IBF-013${shortId}`;
}

/**
 * Convert full kiosk ID to short format
 * @param {string} fullId - Full ID like "IBF-0136058"
 * @returns {string} Short ID like "6058"
 */
export function toShortKioskId(fullId) {
  if (!fullId) return null;
  return fullId.slice(-4);
}

/**
 * Convert Unix timestamp to YYYY-MM-DD format
 * @param {number} unixTimestamp - Unix timestamp (seconds)
 * @returns {string} Date string in YYYY-MM-DD format
 */
export function unixToDate(unixTimestamp) {
  if (!unixTimestamp) return null;
  return new Date(unixTimestamp * 1000).toISOString().split('T')[0];
}

/**
 * Extract custom attribute value by attribute ID
 * @param {Array} attributeValues - Array of attribute objects
 * @param {number} attributeId - Attribute ID to find
 * @returns {string|null} Attribute value or null
 */
export function getAttributeValue(attributeValues, attributeId) {
  if (!Array.isArray(attributeValues)) return null;
  const attr = attributeValues.find(av => av.attributeId === attributeId);
  return attr?.value || null;
}

/**
 * Map service checkbox value to Monday.com dropdown label
 * @param {Array} attributeValues - Array of attribute objects
 * @param {number} attributeId - Service checkbox attribute ID
 * @returns {string|null} Monday.com label name ("Yes" or "No") or null if not set
 */
export function getServiceCallValue(attributeValues, attributeId) {
  if (!attributeId) return null; // Attribute not configured yet

  const value = getAttributeValue(attributeValues, attributeId);
  if (value === null || value === undefined) return null;

  // Handle boolean or string values
  const normalizedValue = String(value).toLowerCase().trim();

  // Map to Monday.com dropdown labels ("Yes" or "No")
  if (normalizedValue === 'true' || normalizedValue === '1' || normalizedValue === 'yes' || normalizedValue === 'checked') {
    return 'Yes';
  } else if (normalizedValue === 'false' || normalizedValue === '0' || normalizedValue === 'no' || normalizedValue === 'unchecked') {
    return 'No';
  }

  return null; // Unknown value
}

/**
 * Format ticket data for logging/display
 * @param {object} ticket - Ninja ticket object
 * @returns {string} Formatted ticket summary
 */
export function formatTicketSummary(ticket) {
  const kioskId = getAttributeValue(ticket.attributeValues, 54);
  const county = getAttributeValue(ticket.attributeValues, 10);
  const date = unixToDate(ticket.createTime);

  return [
    `Ticket #${ticket.id}`,
    `  Kiosk: ${kioskId || 'N/A'}`,
    `  County: ${county || 'N/A'}`,
    `  Date: ${date}`,
    `  Status: ${ticket.status?.displayName || 'N/A'}`,
    `  Summary: ${ticket.summary?.substring(0, 60)}${ticket.summary?.length > 60 ? '...' : ''}`
  ].join('\n');
}

/**
 * Build a lookup map from kiosks data
 * @param {Array} kiosks - Array of Monday kiosk items
 * @returns {Map} Map of short kiosk ID to {county, location}
 */
export function buildKioskLookupMap(kiosks) {
  const map = new Map();

  for (const kiosk of kiosks) {
    const fullId = kiosk.name;
    const shortId = toShortKioskId(fullId);

    // Extract county and location from column_values
    let county = null;
    let location = null;

    for (const cv of kiosk.column_values) {
      if (cv.column.title === 'County') {
        county = cv.text;
      } else if (cv.column.title === 'Location') {
        location = cv.text;
      }
    }

    map.set(shortId, { county, location, fullId });
  }

  return map;
}

/**
 * Create a logger with consistent formatting
 */
export class Logger {
  constructor(verbose = true) {
    this.verbose = verbose;
    this.stats = {
      total: 0,
      success: 0,
      skipped: 0,
      errors: 0,
      warnings: 0
    };
  }

  info(message) {
    if (this.verbose) {
      console.log(`ℹ️  ${message}`);
    }
  }

  success(message) {
    console.log(`✅ ${message}`);
    this.stats.success++;
  }

  skip(message) {
    console.log(`⏭️  ${message}`);
    this.stats.skipped++;
  }

  warn(message) {
    console.log(`⚠️  ${message}`);
    this.stats.warnings++;
  }

  error(message) {
    console.error(`❌ ${message}`);
    this.stats.errors++;
  }

  header(message) {
    console.log('\n' + '='.repeat(80));
    console.log(message);
    console.log('='.repeat(80) + '\n');
  }

  section(message) {
    console.log('\n' + '-'.repeat(80));
    console.log(message);
    console.log('-'.repeat(80));
  }

  printStats() {
    this.header('SYNC STATISTICS');
    console.log(`Total tickets processed: ${this.stats.total}`);
    console.log(`✅ Would create:        ${this.stats.success}`);
    console.log(`⏭️  Skipped (duplicate): ${this.stats.skipped}`);
    console.log(`❌ Errors:              ${this.stats.errors}`);
    console.log(`⚠️  Warnings:            ${this.stats.warnings}`);
    console.log();
  }
}
