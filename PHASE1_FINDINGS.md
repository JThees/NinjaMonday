# Phase 1: API Exploration - Complete Findings

## Executive Summary

Successfully connected to both NinjaRMM and Monday.com APIs. All required data fields are available, and the integration is feasible as planned.

---

## NinjaRMM API

### Authentication
- **Method**: OAuth 2.0 Client Credentials
- **Token Endpoint**: `https://app.ninjarmm.com/ws/oauth/token`
- **Scope**: `monitoring`
- **Token Lifetime**: 3600 seconds (1 hour)

### Ticket Retrieval Process

**Step 1: Get all ticket boards**
```
GET https://app.ninjarmm.com/api/v2/ticketing/trigger/boards
```

Returns 7 boards in your system:
- WIP (ID: 1009)
- Unassigned tickets (ID: 1)
- My tickets (ID: 3)
- **Open tickets** (ID: 4) - Has 4 active tickets
- **All tickets** (ID: 2) - Has 12 total tickets (best for sync)
- Deleted tickets (ID: 5)
- In Queue (ID: 1006)

**Step 2: Get tickets from each board**
```
POST https://app.ninjarmm.com/api/v2/ticketing/trigger/board/{boardId}/run
```

### Available Ticket Fields

**Core Fields:**
- `id` - Ninja Ticket ID (e.g., 1264, 1263, 1261) - **PRIMARY KEY**
- `createTime` - Unix timestamp (e.g., 1762274460.40222)
- `summary` - Ticket title/subject
- `description` - Full ticket description (can be very long)
- `status` - Object: `{ statusId: number, displayName: string, parentId: number }`
- `priority` - "MEDIUM", "NONE", etc.
- `severity` - "MODERATE", "NONE", etc.
- `tags` - Array of strings (e.g., ["HTI", "Printer"], ["Supplies"])
- `location` - Location name (e.g., "Carnegie Library of Steuben County")
- `requester` - Requester name
- `assignedAppUser` - Assigned user (e.g., "Jason Thees")
- `lastUpdated` - Unix timestamp
- `lastUpdatedBy` - User name
- `organization` - Organization name
- `source` - "EMAIL", "TECHNICIAN", etc.
- `type` - "PROBLEM" or null
- `ticketForm` - "Default"

**Custom Attributes (in `attributeValues` array):**
- Attribute ID 54: **"Kiosk ID"** (Type: TEXT)
  - Examples: "5850", "6056", "5875", "6078"
  - **Note**: Short form IDs (NOT the full IBF-0136058 format)
- Attribute ID 10: **"County"** (Type: DROPDOWN)
  - Examples: "Steuben", "Rush", "Elkhart"
  - Can be `null` for some tickets

### Sample Ticket Structure
```json
{
  "id": 1261,
  "createTime": 1761664561.507857,
  "summary": "Kiosk Troubleshooting - Carnegie Public Library of Steuben County",
  "description": "Your form(Basic Troubleshooting Checklist) has received 1 new response...",
  "status": {
    "statusId": 2001,
    "displayName": "Impending User Action",
    "parentId": 2000
  },
  "priority": "MEDIUM",
  "severity": "MODERATE",
  "tags": [],
  "location": "Carnegie Library of Steuben County",
  "requester": " ",
  "assignedAppUser": "Jason Thees",
  "lastUpdated": 1762539868.722185,
  "lastUpdatedBy": " ",
  "ticketForm": "Default",
  "attributeValues": [
    {
      "attributeId": 10,
      "value": "Steuben"
    },
    {
      "attributeId": 54,
      "value": "5850"
    }
  ]
}
```

---

## Monday.com API

### Authentication
- **Method**: API Token (GraphQL)
- **Endpoint**: `https://api.monday.com/v2`
- **Headers**:
  - `Authorization: <token>`
  - `Content-Type: application/json`
  - `API-Version: 2024-10`

### Board 1: ILH Kiosks (Reference Data)
**Board ID**: `9594374343`

**Purpose**: Lookup table for enriching ticket data with county/location information

**Available Columns:**
- `name` (ID: name) - **Kiosk ID in full format** (e.g., "IBF-0136058")
- `text_mkswvz1h` - Device Type ("Freestanding", "Desktop")
- `text_mkswqfrr` - **County** (e.g., "Newton", "Starke", "Fulton")
- `long_text_mkswk1we` - **Location** (e.g., "Newton County Clerk's Office")
- `color_mkswdp57` - Health Status
- `text_mkswnsmd` - PPOC Name
- `text_mkswmhm8` - PPOC Email
- `text_mksw9jpa` - PPOC Phone
- `text_mkswk06c` - SPOC Name
- `text_mkswtah0` - SPOC Email
- `text_mksw27p` - SPOC Phone
- `text_mkswc4bx` - ITPOC Name
- `text_mkswd0d6` - ITPOC Email
- `text_mkswfv9b` - ITPOC Phone

**Sample Items:**
- Item: "IBF-0136058" → County: "Newton", Location: "Newton County Clerk's Office"
- Item: "IBF-0136034" → County: "Starke", Location: "Starke County Clerk's Office"
- Item: "IBF-0136051" → County: "Fulton", Location: "Fulton County Public Library"

**Total Items**: 92 kiosks (matching your stated count)

### Board 2: Tickets (Sync Target)
**Board ID**: `18246434123`

**Purpose**: Dashboard for tracking ticket trends and problem patterns

**Available Columns:**
- `name` (ID: name) - Item name/number
- `text_mkx0wqmq` - **Kiosk** (short form ID, e.g., "6066", "5864")
- `date4` - **Date**
- `text_mkwzhc6k` - **County**
- `text_mkwzt5ce` - **Location**
- `dropdown_mkwzm1z3` - Initiated By
- `tag_mkwzqtky` - **Core issue** (tags)
- `dropdown_mkwznn43` - Service call
- `status` - **Status**
- `text_mkxkpphv` - **Ninja Ticket ID** ✓ (for duplicate prevention)

**Existing Items:** 3 sample items already in board (Items 19, 20, 21)

---

## Field Mapping for Sync

| NinjaRMM Source | Transform | Monday.com Target | Column ID |
|-----------------|-----------|-------------------|-----------|
| `id` | Direct | Ninja Ticket ID | `text_mkxkpphv` |
| `attributeValues[54].value` | Convert short→full format¹ | Kiosk | `text_mkx0wqmq` |
| `createTime` | Unix→Date² | Date | `date4` |
| `tags` | Array→Tags | Core issue | `tag_mkwzqtky` |
| `status.displayName` | Direct | Status | `status` |
| Lookup from ILH Kiosks³ | Via kiosk ID | County | `text_mkwzhc6k` |
| Lookup from ILH Kiosks³ | Via kiosk ID | Location | `text_mkwzt5ce` |

**Notes:**
1. **Kiosk ID Conversion**: NinjaRMM stores short IDs like "5850". Need to convert to full format "IBF-0136058" OR store as-is (short form matches Monday pattern)
2. **Date Conversion**: Convert Unix timestamp (e.g., 1761664561) to YYYY-MM-DD format
3. **Lookup Process**:
   - Extract short kiosk ID from Ninja ticket (e.g., "5850")
   - Convert to full format "IBF-0136058" (prefix "IBF-013" + 4-digit ID)
   - Query ILH Kiosks board by `name` field
   - Extract County and Location from matching item
   - Log warning if no match found, continue processing

---

## Kiosk ID Format Analysis ✓

**NinjaRMM Format (Short):** `5850`, `6056`, `6078`
**Monday ILH Kiosks (Full):** `IBF-0136058`, `IBF-0136034`, `IBF-0136051`
**Monday Tickets (Short):** `6066`, `6065`, `5864`

**Conversion Pattern** (CONFIRMED):
All kiosks follow the naming pattern `IBF-013XXXX`, where XXXX are the last 4 digits.

**Conversion Functions**:
```javascript
// Short to Full: 6058 → IBF-0136058
const toFullKioskId = (shortId) => `IBF-013${shortId}`;

// Full to Short: IBF-0136058 → 6058
const toShortKioskId = (fullId) => fullId.slice(-4);
```

**Examples**:
- `6058` ↔ `IBF-0136058`
- `5850` ↔ `IBF-0135850`
- `6066` ↔ `IBF-0136066`

**Lookup Strategy**:
1. Ninja ticket has Kiosk ID "6058"
2. Convert to full: "IBF-0136058"
3. Query ILH Kiosks board where `name` = "IBF-0136058"
4. Extract County and Location from matched item

---

## Recommendations for Phase 2 (Dry Run Implementation)

### 1. Data Fetching Strategy
```javascript
// Fetch all tickets from all boards and combine
const boards = await getAllTicketBoards();
let allTickets = [];
for (const board of boards) {
  const tickets = await getTicketsFromBoard(board.id);
  allTickets = allTickets.concat(tickets);
}
```

### 2. Deduplication Strategy
- Query Monday Tickets board for all existing "Ninja Ticket ID" values
- Store in a Set for O(1) lookup
- Skip any Ninja tickets whose ID already exists in Monday

### 3. Kiosk Lookup Strategy
- Fetch all items from ILH Kiosks board at start
- Build a Map: `{ "6058": { county: "Newton", location: "..." }, ... }`
- Extract last 4 digits from full IBF format as key
- For each ticket, lookup using short kiosk ID
- Log warnings for unmapped kiosks

### 4. Date Conversion
```javascript
// Unix timestamp to Monday date format
const date = new Date(ticket.createTime * 1000).toISOString().split('T')[0]; // "2025-11-11"
```

### 5. Error Handling
- Log all failures to a file
- Continue processing other tickets even if one fails
- Track statistics: total, success, failed, skipped (duplicates)

### 6. Dry Run Mode
- Print all actions without executing
- Show what would be created in Monday
- Verify field mappings visually
- Test with a small subset first (e.g., 5 tickets)

---

## Next Steps

**Phase 2: Dry Run Implementation**
1. ✅ Create kiosk ID mapping logic (clarify format first)
2. ✅ Build deduplication checker
3. ✅ Implement data transformation functions
4. ✅ Add comprehensive logging
5. ✅ Create dry-run mode that previews without creating
6. ✅ Test with small data set

**Phase 3: Full Implementation**
1. Implement actual Monday item creation
2. Add error recovery and retry logic
3. Create scheduling/automation capability
4. Document usage and maintenance

---

## Configuration for Phase 2

Based on CLAUDE.md requirements:

1. **✓ Kiosk ID Mapping**: Confirmed - last 4 digits with `IBF-013` prefix
2. **✓ Which Boards to Sync**: "All tickets" board (ID: 2) - contains complete ticket history
3. **✓ Status Mapping**: Use Ninja status `displayName` as-is in Monday Status field
4. **✓ Filtering**: Sync ALL tickets regardless of status (per requirement #5: "No Filtering")
5. **✓ Duplicate Prevention**: Check Monday "Ninja Ticket ID" field before creating
6. **✓ Error Handling**: Log unmapped kiosks, continue processing (per requirement #6)
