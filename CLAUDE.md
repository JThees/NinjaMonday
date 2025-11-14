# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

I manage 92 county kiosks across Indiana for Indiana Legal Help. Currently, I'm manually entering the same ticket information in both NinjaRMM (device management) and Monday.com (project tracking), which is tedious and error-prone. I need automation to sync tickets from Ninja to Monday to feed trend analysis dashboards that show problem patterns and repeat offender kiosks.

## API Documentation and Reference

- **NinjaRMM:**
      https://app.ninjarmm.com/apidocs/?links.active=core
- **Monday.com**
      https://developer.monday.com/api-reference/reference/about-the-api-reference

## Configuration

**Environment Variables** (stored in `.env` file, never commit this file):
- `NINJA_BASE_URL` - NinjaRMM API base URL
- `NINJA_CLIENT_ID` - NinjaRMM OAuth client ID
- `NINJA_CLIENT_SECRET` - NinjaRMM OAuth client secret
- `MONDAY_API_TOKEN` - Monday.com GraphQL API token
- `MONDAY_KIOSKS_BOARD_ID` - Monday board ID for ILH Kiosks (reference data)
- `MONDAY_TICKETS_BOARD_ID` - Monday board ID for Tickets (sync target)

See `.env.example` for the required format. Copy it to `.env` and fill in your actual credentials.

## Key Requirements:
1. **Primary Key:** Use Ninja Ticket ID to avoid duplicate Monday items
2. **Kiosk ID Mapping:** Convert full kiosk IDs to short form (IBF-0136058 → 6058)
3. **Data Enrichment:** Lookup county/location from ILH Kiosks board using kiosk ID
4. **New Items Only:** Create new Monday items for each ticket (one kiosk can have multiple tickets over time)
5. **No Filtering:** Sync all tickets regardless of status for complete trend analysis
6. **Error Handling:** Log when kiosks not found in ILH Kiosks board, continue processing

**Field Mapping:**
- Ninja Ticket ID → Monday "Ninja Ticket ID" (text_mkxn628j)
- Ninja Device/Kiosk (converted to short form) → Monday "Kiosk" (text_mkx0wqmq)
- Ninja creation date → Monday "Date" (date4)
- Ninja Tags → Monday "Core issue" (tag_mkwzqtky)
- Ninja Status → Monday "Status" (status)
- Ninja Attribute 10 (County) → Monday "County" (text_mkwzhc6k)
- Ninja Attribute 80 (Service checkbox) → Monday "Service call" (dropdown_mkwznn43)
- County/Location from ILH Kiosks board lookup → Monday "County" and "Location" (text_mkwzt5ce)

## Project Status

✅ **COMPLETED** - All phases complete and tested

## Usage

### Available Scripts

```bash
# Sync tickets + update kiosk health (RECOMMENDED)
npm run sync:all

# Preview what will be synced (no changes to Monday.com)
npm run sync:dry-run

# Test sync with 3 items only
npm run sync:test

# Full sync of all tickets
npm run sync

# Update existing Monday items with latest NinjaRMM data
npm run sync:update

# Update kiosk health statuses based on tickets
npm run health:update

# View/manage field mappings and configuration
npm run config
npm run config add-status "New Status" "Working on it"
npm run config update-date 2025-06-01T00:00:00Z
```

### How It Works

1. **Date Filtering**: Only syncs tickets created on or after **July 1, 2025** (configurable via `npm run config`)
2. **Duplicate Detection**: Uses "Ninja Ticket ID" column to avoid creating duplicates
3. **Tag Auto-Creation**: Automatically creates Monday.com tags from NinjaRMM tags using `create_or_get_tag` mutation
4. **County Fallback**: Extracts county from NinjaRMM attribute values when kiosk not found in ILH Kiosks board
5. **Consecutive Numbering**: Items are named with consecutive integers (e.g., "22", "23", "24")
6. **Rate Limiting**: Built-in retry logic with exponential backoff for API rate limits
7. **Health Status Automation**: Automatically updates ILH Kiosks board health status based on most recent ticket per kiosk

### First-Time Setup

1. Copy `.env.example` to `.env` and fill in your credentials
2. Run `npm install` to install dependencies
3. Run `npm run sync:dry-run` to preview what will be synced
4. Run `npm run sync:test` to test with 3 items
5. Run `npm run sync` for full sync

### Synced Data

**From NinjaRMM:**
- Ticket ID → Ninja Ticket ID column
- Device (IBF-0136058) → Kiosk column (6058)
- Creation date → Date column
- Tags → Core issue column (auto-created)
- Status → Status column (mapped)
- Location → Location column

**Enriched from ILH Kiosks Board:**
- County (looked up by kiosk ID)
- Location (looked up by kiosk ID, overwrites Ninja location if found)

**Ticket Status Mapping (NinjaRMM → Monday Tickets):**
- Closed → Done
- Waiting → Stuck
- Supplies Ordered → Done
- Pending Vendor → Working on it
- Paused → Working BUT
- Impending User Action → Working on it
- *(all others default to "Working on it")*

**Health Status Mapping (Monday Tickets → ILH Kiosks):**
- Done → HEALTHY
- Working on it → NEEDS_ATTENTION
- Working BUT → NEEDS_ATTENTION
- Stuck → NEEDS_ATTENTION
- *(no tickets) → HEALTHY*

**Health Status Logic:** Most recent ticket (by date) determines kiosk health status.

### Configuration Management

The configuration tool allows you to manage field mappings without editing code:

```bash
# View current configuration
npm run config

# Add a new status mapping
npm run config add-status "In Progress" "Working on it"

# Remove a status mapping
npm run config remove-status "Old Status"

# Update Monday column ID (if column IDs change)
npm run config update-column kiosk text_NEW_ID

# Update minimum sync date
npm run config update-date 2025-06-01T00:00:00Z
```

Configuration is stored in `config/field-mappings.json`.

### Automation & Deployment

**Serverless Deployment** (Recommended):
- See `DEPLOYMENT.md` for full guide
- Supports AWS Lambda, Azure Functions, Google Cloud Run
- Pre-configured in `serverless.yml` for AWS Lambda
- Runs daily sync at 9 AM UTC, updates every 6 hours

**Local Automation**:
- **Windows:** Use Task Scheduler to run `npm run sync` daily
- **Linux/Mac:** Use cron to run `npm run sync` daily
- **Docker:** Use container orchestration (Kubernetes, ECS, etc.)

### Troubleshooting

- **Rate Limit Errors (429):** The script has retry logic. Run again to catch failed items.
- **Missing Tags:** Tags are auto-created using Monday.com's API
- **Missing Kiosk Data:** Check if kiosk exists in ILH Kiosks board with correct naming (IBF-013XXXX)
- **Duplicate Items:** Script checks Ninja Ticket ID column to avoid duplicates

## Development Notes

**Completed Phases:**
1. ✅ **API Exploration:** Verified field names and data structures
2. ✅ **Dry Run Mode:** Preview sync without creating items
3. ✅ **Implementation:** Full sync with error handling, retry logic, and tag auto-creation
4. ✅ **Service Call Integration:** NinjaRMM checkbox field synced to Monday.com dropdown
5. ✅ **Health Status Automation:** Kiosk health status auto-updated based on ticket status
6. ✅ **Testing:** Successfully synced 52 tickets and automated 147 kiosk health statuses

**Success Criteria:**
- ✅ No more manual double data entry
- ✅ Dashboard automatically shows ticket trends and problem kiosk patterns
- ✅ Reliable sync with proper error handling
- ✅ Can identify repeat offender kiosks over time
- ✅ Kiosk health status automatically reflects current ticket status
- ✅ Combined workflow runs ticket sync + health update in one command


