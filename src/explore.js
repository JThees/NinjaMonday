import axios from 'axios';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

// ============================================================================
// NINJARRMM API EXPLORATION
// ============================================================================

async function exploreNinjaAPI() {
  console.log('\n' + '='.repeat(80));
  console.log('EXPLORING NINJARMM API');
  console.log('='.repeat(80) + '\n');

  try {
    // Step 1: Get OAuth Token
    console.log('Step 1: Authenticating with OAuth...');

    // NinjaRMM OAuth token endpoint (not under /api/v2)
    const tokenUrl = 'https://app.ninjarmm.com/ws/oauth/token';

    // Use monitoring scope (verified working)
    const possibleScopes = ['monitoring'];

    let tokenResponse = null;
    let successfulScope = null;

    for (const scope of possibleScopes) {
      try {
        const params = {
          grant_type: 'client_credentials',
          client_id: process.env.NINJA_CLIENT_ID,
          client_secret: process.env.NINJA_CLIENT_SECRET
        };

        if (scope) {
          params.scope = scope;
          console.log(`  Trying with scope: "${scope}"`);
        } else {
          console.log(`  Trying without scope parameter`);
        }

        tokenResponse = await axios.post(
          tokenUrl,
          new URLSearchParams(params),
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded'
            }
          }
        );

        successfulScope = scope || 'none';
        console.log(`  ✓ Success with scope: ${successfulScope}`);
        break;
      } catch (err) {
        console.log(`  ✗ Failed: ${err.response?.status} - ${err.response?.data?.error || err.message}`);
      }
    }

    if (!tokenResponse) {
      throw new Error('Could not authenticate with NinjaRMM OAuth');
    }

    const accessToken = tokenResponse.data.access_token;
    console.log('✓ Authentication successful!');
    console.log(`Token type: ${tokenResponse.data.token_type}`);
    console.log(`Expires in: ${tokenResponse.data.expires_in} seconds\n`);

    // Step 2: Explore Tickets
    console.log('Step 2: Fetching tickets...');
    const ticketsUrl = `${process.env.NINJA_BASE_URL}/v2/ticketing/ticket/tickets`;

    const ticketsResponse = await axios.get(ticketsUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      params: {
        pageSize: 5  // Just get a few for exploration
      }
    });

    console.log(`✓ Found ${ticketsResponse.data.length} tickets (showing first 5)`);

    if (ticketsResponse.data.length > 0) {
      console.log('\nSample Ticket Structure:');
      console.log(JSON.stringify(ticketsResponse.data[0], null, 2));

      console.log('\n\nAvailable Ticket Fields:');
      const fields = Object.keys(ticketsResponse.data[0]);
      fields.forEach(field => console.log(`  - ${field}`));
    }

    // Step 3: Explore Devices
    console.log('\n\nStep 3: Fetching devices/kiosks...');
    const devicesUrl = `${process.env.NINJA_BASE_URL}/v2/devices`;

    const devicesResponse = await axios.get(devicesUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      params: {
        pageSize: 5
      }
    });

    console.log(`✓ Found ${devicesResponse.data.length} devices (showing first 5)`);

    if (devicesResponse.data.length > 0) {
      console.log('\nSample Device Structure:');
      console.log(JSON.stringify(devicesResponse.data[0], null, 2));

      console.log('\n\nAvailable Device Fields:');
      const fields = Object.keys(devicesResponse.data[0]);
      fields.forEach(field => console.log(`  - ${field}`));
    }

  } catch (error) {
    console.error('❌ NinjaRMM API Error:');
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Data:`, error.response.data);
    } else {
      console.error(error.message);
    }
  }
}

// ============================================================================
// MONDAY.COM API EXPLORATION
// ============================================================================

async function exploreMondayAPI() {
  console.log('\n' + '='.repeat(80));
  console.log('EXPLORING MONDAY.COM API');
  console.log('='.repeat(80) + '\n');

  const mondayUrl = 'https://api.monday.com/v2';

  // Monday.com uses just the token value directly, not "Bearer token"
  const headers = {
    'Authorization': process.env.MONDAY_API_TOKEN,
    'Content-Type': 'application/json',
    'API-Version': '2024-10'
  };

  console.log('Testing Monday.com authentication...');

  try {
    // Step 1: Fetch ILH Kiosks Board Structure
    console.log('Step 1: Fetching ILH Kiosks board structure...');

    const kiosksBoardQuery = {
      query: `query {
        boards(ids: ${process.env.MONDAY_KIOSKS_BOARD_ID}) {
          id
          name
          columns {
            id
            title
            type
          }
          items_page(limit: 2) {
            items {
              id
              name
              column_values {
                id
                column {
                  title
                }
                text
                value
              }
            }
          }
        }
      }`
    };

    const kiosksBoardResponse = await axios.post(mondayUrl, kiosksBoardQuery, { headers });

    const kiosksBoard = kiosksBoardResponse.data.data.boards[0];
    console.log(`✓ Board: ${kiosksBoard.name}`);
    console.log('\nAvailable Columns:');
    kiosksBoard.columns.forEach(col => {
      console.log(`  - ${col.title} (ID: ${col.id}, Type: ${col.type})`);
    });

    console.log('\nSample Items:');
    kiosksBoard.items_page.items.forEach((item, idx) => {
      console.log(`\n  Item ${idx + 1}: ${item.name}`);
      item.column_values.forEach(cv => {
        if (cv.text) {
          console.log(`    ${cv.column.title}: ${cv.text}`);
        }
      });
    });

    // Step 2: Fetch Tickets Board Structure
    console.log('\n\nStep 2: Fetching Tickets board structure...');

    const ticketsBoardQuery = {
      query: `query {
        boards(ids: ${process.env.MONDAY_TICKETS_BOARD_ID}) {
          id
          name
          columns {
            id
            title
            type
          }
          items_page(limit: 2) {
            items {
              id
              name
              column_values {
                id
                column {
                  title
                }
                text
                value
              }
            }
          }
        }
      }`
    };

    const ticketsBoardResponse = await axios.post(mondayUrl, ticketsBoardQuery, { headers });

    const ticketsBoard = ticketsBoardResponse.data.data.boards[0];
    console.log(`✓ Board: ${ticketsBoard.name}`);
    console.log('\nAvailable Columns:');
    ticketsBoard.columns.forEach(col => {
      console.log(`  - ${col.title} (ID: ${col.id}, Type: ${col.type})`);
    });

    if (ticketsBoard.items_page.items.length > 0) {
      console.log('\nSample Items:');
      ticketsBoard.items_page.items.forEach((item, idx) => {
        console.log(`\n  Item ${idx + 1}: ${item.name}`);
        item.column_values.forEach(cv => {
          if (cv.text) {
            console.log(`    ${cv.column.title}: ${cv.text}`);
          }
        });
      });
    } else {
      console.log('\n(No items in board yet)');
    }

    // Step 3: Check for existing Ninja Ticket IDs
    console.log('\n\nStep 3: Checking for duplicate detection field...');
    const ninjaTicketIdColumn = ticketsBoard.columns.find(
      col => col.title.toLowerCase().includes('ninja') && col.title.toLowerCase().includes('ticket')
    );

    if (ninjaTicketIdColumn) {
      console.log(`✓ Found column: "${ninjaTicketIdColumn.title}" (ID: ${ninjaTicketIdColumn.id}, Type: ${ninjaTicketIdColumn.type})`);
    } else {
      console.log('⚠ No "Ninja Ticket ID" column found - may need to be created');
    }

  } catch (error) {
    console.error('❌ Monday.com API Error:');
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Data:`, JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(error.message);
    }
  }
}

// ============================================================================
// RUN EXPLORATION
// ============================================================================

async function main() {
  console.log('\n🔍 API EXPLORATION TOOL');
  console.log('Phase 1: Understanding available fields and data structures\n');

  await exploreNinjaAPI();
  await exploreMondayAPI();

  console.log('\n' + '='.repeat(80));
  console.log('EXPLORATION COMPLETE');
  console.log('='.repeat(80) + '\n');
}

main().catch(console.error);
