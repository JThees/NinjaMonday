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

**Field Mapping (some field names need API verification):**
- Ninja Ticket ID → Monday "Ninja Ticket ID" (custom field)
- Ninja Device/Kiosk (converted to short form) → Monday "Kiosk"
- Ninja creation date → Monday "Date"
- Ninja Tags → Monday "Core issue"
- Ninja Status → Monday "Status"
- County/Location from ILH Kiosks board lookup → Monday "County" and "Location"

**Development Phases:**
1. **API Exploration:** Connect to both APIs and verify exact field names
2. **Dry Run Mode:** Build sync logic with preview/logging only (no actual Monday item creation)
3. **Implementation:** Full sync with error handling
4. **Testing:** Verify dashboard charts populate correctly

**Success Criteria:**
- No more manual double data entry
- Dashboard automatically shows ticket trends and problem kiosk patterns
- Reliable sync with proper error handling
- Can identify repeat offender kiosks over time

Please start with Phase 1 - explore both APIs to understand available fields and data structures, then build a dry-run version I can test safely.


