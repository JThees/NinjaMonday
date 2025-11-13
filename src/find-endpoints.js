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

async function testEndpoint(token, path) {
  try {
    const response = await axios.get(
      `https://app.ninjarmm.com/api/v2${path}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        params: { pageSize: 5 }
      }
    );
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      status: error.response?.status,
      error: error.response?.data?.errorMessage || error.message
    };
  }
}

console.log('\n🔍 FINDING AVAILABLE NINJARMM ENDPOINTS\n');

const token = await getNinjaToken();
console.log('✓ Got OAuth token\n');

const endpointsToTest = [
  '/organizations',
  '/devices',
  '/ticketing/tickets',
  '/ticketing/ticket',
  '/tickets',
  '/ticket',
  '/ticketing/contact/tickets',
  '/queries/tickets',
  '/activities'
];

console.log('Testing endpoints...\n');

for (const endpoint of endpointsToTest) {
  const result = await testEndpoint(token, endpoint);

  if (result.success) {
    console.log(`✓ ${endpoint}`);
    console.log(`  Response type: ${Array.isArray(result.data) ? `Array with ${result.data.length} items` : typeof result.data}`);

    if (Array.isArray(result.data) && result.data.length > 0) {
      console.log(`  Sample keys: ${Object.keys(result.data[0]).slice(0, 5).join(', ')}`);
    } else if (typeof result.data === 'object' && result.data !== null) {
      console.log(`  Keys: ${Object.keys(result.data).slice(0, 5).join(', ')}`);
    }
  } else {
    console.log(`✗ ${endpoint} - ${result.status} ${result.error}`);
  }
}

console.log('\n');
