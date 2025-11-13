import axios from 'axios';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

async function getNinjaToken() {
  const response = await axios.post(
    'https://app.ninjarmm.com/ws/oauth/token',
    new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.NINJA_CLIENT_ID,
      client_secret: process.env.NINJA_CLIENT_SECRET,
      scope: 'monitoring'
    }),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    }
  );
  return response.data.access_token;
}

console.log('\n🎫 TESTING NINJARMM TICKET BOARDS API\n');
console.log('='.repeat(80) + '\n');

const token = await getNinjaToken();
console.log('✓ Got OAuth token\n');

// Step 1: Get all ticket boards
console.log('Step 1: Getting all ticket boards...');
try {
  const boardsResponse = await axios.get(
    'https://app.ninjarmm.com/api/v2/ticketing/trigger/boards',
    {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }
  );

  console.log(`✓ Found ${boardsResponse.data.length} ticket board(s)\n`);
  console.log('Boards:');
  boardsResponse.data.forEach((board, idx) => {
    console.log(`  ${idx + 1}. ID: ${board.id}, Name: ${board.name || 'Unnamed'}`);
  });

  // Step 2: Get tickets from each board
  console.log('\n\nStep 2: Getting tickets from each board...\n');

  let allTickets = [];

  for (const board of boardsResponse.data) {
    console.log(`\nBoard: ${board.name || board.id}`);
    console.log('-'.repeat(80));

    try {
      const ticketsResponse = await axios.post(
        `https://app.ninjarmm.com/api/v2/ticketing/trigger/board/${board.id}/run`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const tickets = ticketsResponse.data;
      console.log(`✓ Found ${Array.isArray(tickets) ? tickets.length : 'unknown'} ticket(s)`);

      if (Array.isArray(tickets) && tickets.length > 0) {
        allTickets = allTickets.concat(tickets);

        console.log('\nSample ticket structure:');
        console.log(JSON.stringify(tickets[0], null, 2));

        console.log('\n\nAvailable fields:');
        Object.keys(tickets[0]).forEach(key => {
          console.log(`  - ${key}: ${typeof tickets[0][key]}`);
        });
      } else if (tickets) {
        console.log('Response:', JSON.stringify(tickets, null, 2));
      }

    } catch (error) {
      console.error(`✗ Error getting tickets from board ${board.id}:`);
      if (error.response) {
        console.error(`  Status: ${error.response.status}`);
        console.error(`  Error: ${JSON.stringify(error.response.data, null, 2)}`);
      } else {
        console.error(`  Error: ${error.message}`);
      }
    }
  }

  console.log('\n\n' + '='.repeat(80));
  console.log(`SUMMARY: Found ${allTickets.length} total ticket(s) across all boards`);
  console.log('='.repeat(80) + '\n');

} catch (error) {
  console.error('✗ Error getting ticket boards:');
  if (error.response) {
    console.error(`Status: ${error.response.status}`);
    console.error(`Error: ${JSON.stringify(error.response.data, null, 2)}`);
  } else {
    console.error(`Error: ${error.message}`);
  }
}
