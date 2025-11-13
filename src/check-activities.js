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

console.log('\n🔍 CHECKING NINJARMMACTIVITIES FOR TICKET DATA\n');

const token = await getNinjaToken();

// Get activities
const activitiesResponse = await axios.get(
  'https://app.ninjarmm.com/api/v2/activities',
  {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  }
);

console.log('Activities Response:');
console.log(JSON.stringify(activitiesResponse.data, null, 2));

// Get devices to see their structure
const devicesResponse = await axios.get(
  'https://app.ninjarmm.com/api/v2/devices',
  {
    headers: {
      'Authorization': `Bearer ${token}`
    },
    params: { pageSize: 2 }
  }
);

console.log('\n\nSample Device Structure:');
console.log(JSON.stringify(devicesResponse.data[0], null, 2));

// Check if there are device-specific ticket endpoints
if (devicesResponse.data.length > 0) {
  const deviceId = devicesResponse.data[0].id;
  console.log(`\n\nTrying device-specific endpoints for device ${deviceId}...`);

  const deviceEndpoints = [
    `/device/${deviceId}/tickets`,
    `/device/${deviceId}/ticketing`,
    `/device/${deviceId}/activities`
  ];

  for (const endpoint of deviceEndpoints) {
    try {
      const response = await axios.get(
        `https://app.ninjarmm.com/api/v2${endpoint}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      console.log(`✓ ${endpoint} - Found data!`);
      console.log(JSON.stringify(response.data, null, 2).substring(0, 500));
    } catch (error) {
      console.log(`✗ ${endpoint} - ${error.response?.status} ${error.response?.data?.errorMessage || error.message}`);
    }
  }
}

console.log('\n');
