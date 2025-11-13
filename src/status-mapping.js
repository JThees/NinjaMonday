/**
 * Status mapping from NinjaRMM to Monday.com
 */

export const STATUS_MAPPING = {
  "Closed": "Done",
  "Waiting": "Stuck",
  "Supplies Ordered": "Done",
  "Pending Vendor": "Working on it",
  "Paused": "Working BUT",
  "Impending User Action": "Working on it"
};

/**
 * Map a NinjaRMM status to Monday.com status
 * @param {string} ninjaStatus - NinjaRMM status
 * @returns {string} Monday.com status (defaults to "Working on it" if not mapped)
 */
export function mapStatus(ninjaStatus) {
  return STATUS_MAPPING[ninjaStatus] || "Working on it";
}
