import axios from 'axios';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

console.log('\n' + '='.repeat(80));
console.log('CREDENTIAL DIAGNOSTIC TOOL');
console.log('='.repeat(80) + '\n');

// Test 1: Check environment variables are loaded
console.log('Test 1: Environment Variables Check');
console.log('------------------------------------');
console.log('NINJA_BASE_URL:', process.env.NINJA_BASE_URL ? '✓ Set' : '✗ Missing');
console.log('NINJA_CLIENT_ID:', process.env.NINJA_CLIENT_ID ? `✓ ${process.env.NINJA_CLIENT_ID.substring(0, 10)}...` : '✗ Missing');
console.log('NINJA_CLIENT_SECRET:', process.env.NINJA_CLIENT_SECRET ? `✓ ${process.env.NINJA_CLIENT_SECRET.substring(0, 10)}...` : '✗ Missing');
console.log('MONDAY_API_TOKEN:', process.env.MONDAY_API_TOKEN ? `✓ ${process.env.MONDAY_API_TOKEN.substring(0, 20)}... (${process.env.MONDAY_API_TOKEN.length} chars)` : '✗ Missing');
console.log('MONDAY_KIOSKS_BOARD_ID:', process.env.MONDAY_KIOSKS_BOARD_ID || '✗ Missing');
console.log('MONDAY_TICKETS_BOARD_ID:', process.env.MONDAY_TICKETS_BOARD_ID || '✗ Missing');

// Test 2: Monday.com API - Simple "me" query
console.log('\n\nTest 2: Monday.com Authentication');
console.log('------------------------------------');

// Test different authentication formats
const mondayAuthFormats = [
  { name: 'Direct token', value: process.env.MONDAY_API_TOKEN },
  { name: 'Bearer token', value: `Bearer ${process.env.MONDAY_API_TOKEN}` },
  { name: 'Token with quotes', value: `"${process.env.MONDAY_API_TOKEN}"` }
];

let mondaySuccess = false;

for (const authFormat of mondayAuthFormats) {
  console.log(`\nTrying: ${authFormat.name}`);
  try {
    const mondayResponse = await axios.post(
      'https://api.monday.com/v2',
      {
        query: 'query { me { id name email } }'
      },
      {
        headers: {
          'Authorization': authFormat.value,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log(`✓ Monday.com authentication successful with: ${authFormat.name}`);
    console.log('User info:', JSON.stringify(mondayResponse.data.data.me, null, 2));
    mondaySuccess = true;
    break;
  } catch (error) {
    console.error(`✗ Failed with ${authFormat.name}`);
    if (error.response) {
      console.error(`  Status: ${error.response.status}`);
    } else {
      console.error(`  Error: ${error.message}`);
    }
  }
}

if (!mondaySuccess) {
  console.error('\n⚠ All Monday.com authentication methods failed');
  console.error('Token length:', process.env.MONDAY_API_TOKEN.length);
  console.error('Token starts with:', process.env.MONDAY_API_TOKEN.substring(0, 30) + '...');
  console.error('Token ends with:', '...' + process.env.MONDAY_API_TOKEN.substring(process.env.MONDAY_API_TOKEN.length - 10));
}

// Test 3: NinjaRMM OAuth - Detailed error info
console.log('\n\nTest 3: NinjaRMM OAuth Authentication');
console.log('----------------------------------------');

// Check for whitespace issues
const clientId = process.env.NINJA_CLIENT_ID.trim();
const clientSecret = process.env.NINJA_CLIENT_SECRET.trim();

console.log('Client ID (trimmed):', clientId);
console.log('Client Secret length:', clientSecret.length);

// Try with Basic Auth as well
const ninjaAuthMethods = [
  {
    name: 'URL-encoded form (standard)',
    config: {
      data: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret
      }),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    }
  },
  {
    name: 'URL-encoded with redirect_uri',
    config: {
      data: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: 'urn:ietf:wg:oauth:2.0:oob'
      }),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    }
  },
  {
    name: 'Basic Auth header',
    config: {
      data: new URLSearchParams({
        grant_type: 'client_credentials'
      }),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
      }
    }
  }
];

let ninjaSuccess = false;

for (const method of ninjaAuthMethods) {
  console.log(`\nTrying: ${method.name}`);
  try {
    const ninjaResponse = await axios.post(
      'https://app.ninjarmm.com/ws/oauth/token',
      method.config.data,
      {
        headers: method.config.headers
      }
    );

    console.log(`✓ NinjaRMM authentication successful with: ${method.name}`);
    console.log('Token type:', ninjaResponse.data.token_type);
    console.log('Expires in:', ninjaResponse.data.expires_in);
    console.log('Scope:', ninjaResponse.data.scope || 'none');
    ninjaSuccess = true;
    break;
  } catch (error) {
    console.error(`✗ Failed with ${method.name}`);
    if (error.response) {
      console.error(`  Status: ${error.response.status}`);
      console.error(`  Error: ${error.response.data.error || 'unknown'}`);
      if (error.response.data.error_description) {
        console.error(`  Description: ${error.response.data.error_description}`);
      }
    } else {
      console.error(`  Error: ${error.message}`);
    }
  }
}

if (!ninjaSuccess) {
  console.error('\n⚠ All NinjaRMM authentication methods failed');
  console.error('This typically means:');
  console.error('  - The OAuth application in NinjaRMM needs to be reconfigured');
  console.error('  - The Client Credentials grant type is not enabled');
  console.error('  - The credentials were revoked or expired');
}

console.log('\n' + '='.repeat(80));
console.log('DIAGNOSTIC COMPLETE');
console.log('='.repeat(80) + '\n');
