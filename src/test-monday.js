import axios from 'axios';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

console.log('\n📋 TESTING MONDAY.COM API\n');
console.log('='.repeat(80) + '\n');

const mondayUrl = 'https://api.monday.com/v2';
const headers = {
  'Authorization': process.env.MONDAY_API_TOKEN,
  'Content-Type': 'application/json',
  'API-Version': '2024-10'
};

// Test authentication first
console.log('Step 0: Testing authentication...');
try {
  const authTest = await axios.post(
    mondayUrl,
    {
      query: 'query { me { id name email } }'
    },
    { headers }
  );

  console.log('✓ Authentication successful!');
  console.log(`User: ${authTest.data.data.me.name} (${authTest.data.data.me.email})\n`);
} catch (error) {
  console.error('✗ Authentication failed');
  console.error('Error:', error.response?.data || error.message);
  process.exit(1);
}

// Step 1: Get ILH Kiosks Board structure
console.log('Step 1: Fetching ILH Kiosks board structure...');
console.log(`Board ID: ${process.env.MONDAY_KIOSKS_BOARD_ID}`);
console.log('-'.repeat(80));

try {
  const kiosksBoardQuery = {
    query: `query {
      boards(ids: [${process.env.MONDAY_KIOSKS_BOARD_ID}]) {
        id
        name
        description
        columns {
          id
          title
          type
          settings_str
        }
        items_page(limit: 3) {
          cursor
          items {
            id
            name
            column_values {
              id
              column {
                id
                title
              }
              type
              text
              value
            }
          }
        }
      }
    }`
  };

  const kiosksBoardResponse = await axios.post(mondayUrl, kiosksBoardQuery, { headers });

  if (kiosksBoardResponse.data.errors) {
    console.error('✗ GraphQL errors:', JSON.stringify(kiosksBoardResponse.data.errors, null, 2));
  }

  const kiosksBoard = kiosksBoardResponse.data.data.boards[0];
  console.log(`✓ Board: "${kiosksBoard.name}"`);
  console.log(`  Description: ${kiosksBoard.description || 'None'}`);

  console.log('\n📊 Available Columns:');
  kiosksBoard.columns.forEach(col => {
    console.log(`  - ${col.title.padEnd(25)} (ID: ${col.id.padEnd(15)} Type: ${col.type})`);
  });

  console.log('\n📝 Sample Items (first 3):');
  kiosksBoard.items_page.items.forEach((item, idx) => {
    console.log(`\n  Item ${idx + 1}: ${item.name} (ID: ${item.id})`);
    item.column_values.forEach(cv => {
      if (cv.text && cv.text.trim()) {
        console.log(`    ${cv.column.title}: ${cv.text}`);
      }
    });
  });

} catch (error) {
  console.error('✗ Error fetching ILH Kiosks board:');
  console.error('Error:', error.response?.data || error.message);
}

// Step 2: Get Tickets Board structure
console.log('\n\nStep 2: Fetching Tickets board structure...');
console.log(`Board ID: ${process.env.MONDAY_TICKETS_BOARD_ID}`);
console.log('-'.repeat(80));

try {
  const ticketsBoardQuery = {
    query: `query {
      boards(ids: [${process.env.MONDAY_TICKETS_BOARD_ID}]) {
        id
        name
        description
        columns {
          id
          title
          type
          settings_str
        }
        items_page(limit: 3) {
          cursor
          items {
            id
            name
            column_values {
              id
              column {
                id
                title
              }
              type
              text
              value
            }
          }
        }
      }
    }`
  };

  const ticketsBoardResponse = await axios.post(mondayUrl, ticketsBoardQuery, { headers });

  if (ticketsBoardResponse.data.errors) {
    console.error('✗ GraphQL errors:', JSON.stringify(ticketsBoardResponse.data.errors, null, 2));
  }

  const ticketsBoard = ticketsBoardResponse.data.data.boards[0];
  console.log(`✓ Board: "${ticketsBoard.name}"`);
  console.log(`  Description: ${ticketsBoard.description || 'None'}`);

  console.log('\n📊 Available Columns:');
  ticketsBoard.columns.forEach(col => {
    console.log(`  - ${col.title.padEnd(25)} (ID: ${col.id.padEnd(15)} Type: ${col.type})`);
  });

  const itemCount = ticketsBoard.items_page.items.length;
  if (itemCount > 0) {
    console.log(`\n📝 Sample Items (first ${itemCount}):`);
    ticketsBoard.items_page.items.forEach((item, idx) => {
      console.log(`\n  Item ${idx + 1}: ${item.name} (ID: ${item.id})`);
      item.column_values.forEach(cv => {
        if (cv.text && cv.text.trim()) {
          console.log(`    ${cv.column.title}: ${cv.text}`);
        }
      });
    });
  } else {
    console.log('\n⚠ No items found in Tickets board yet');
  }

  // Check for Ninja Ticket ID column
  console.log('\n🔍 Checking for "Ninja Ticket ID" column...');
  const ninjaIdColumn = ticketsBoard.columns.find(col =>
    col.title.toLowerCase().includes('ninja') && col.title.toLowerCase().includes('ticket')
  );

  if (ninjaIdColumn) {
    console.log(`✓ Found: "${ninjaIdColumn.title}" (ID: ${ninjaIdColumn.id}, Type: ${ninjaIdColumn.type})`);
  } else {
    console.log('⚠ "Ninja Ticket ID" column not found - will need to be created or identified');
    console.log('Available columns:', ticketsBoard.columns.map(c => c.title).join(', '));
  }

} catch (error) {
  console.error('✗ Error fetching Tickets board:');
  console.error('Error:', error.response?.data || error.message);
}

console.log('\n' + '='.repeat(80));
console.log('MONDAY.COM API EXPLORATION COMPLETE');
console.log('='.repeat(80) + '\n');
