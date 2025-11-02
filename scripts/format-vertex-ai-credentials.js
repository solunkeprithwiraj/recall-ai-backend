#!/usr/bin/env node

/**
 * Helper script to format service account JSON for GOOGLE_VERTEX_AI_CREDENTIALS
 * 
 * Usage:
 *   node scripts/format-vertex-ai-credentials.js path/to/service-account.json
 * 
 * This script reads a service account JSON file and outputs it in a format
 * suitable for the GOOGLE_VERTEX_AI_CREDENTIALS environment variable.
 */

const fs = require('fs');
const path = require('path');

function formatCredentials(credentialsPath) {
  try {
    // Read the service account JSON file
    const credentialsFile = path.resolve(credentialsPath);
    
    if (!fs.existsSync(credentialsFile)) {
      console.error(`❌ Error: File not found: ${credentialsFile}`);
      process.exit(1);
    }

    const credentials = JSON.parse(fs.readFileSync(credentialsFile, 'utf8'));

    // Validate required fields
    const requiredFields = ['type', 'project_id', 'private_key', 'client_email'];
    for (const field of requiredFields) {
      if (!credentials[field]) {
        console.error(`❌ Error: Missing required field: ${field}`);
        process.exit(1);
      }
    }

    // Format as a single-line JSON string (escape newlines in private_key)
    const formatted = JSON.stringify(credentials);

    console.log('\n✅ Formatted credentials for GOOGLE_VERTEX_AI_CREDENTIALS:\n');
    console.log('Copy this into your .env file:\n');
    console.log(`GOOGLE_VERTEX_AI_CREDENTIALS='${formatted}'\n`);
    console.log('Note: Make sure to use single quotes around the JSON string to preserve double quotes inside.\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Get the file path from command line arguments
const credentialsPath = process.argv[2];

if (!credentialsPath) {
  console.error('Usage: node scripts/format-vertex-ai-credentials.js <path-to-service-account.json>');
  console.error('\nExample:');
  console.error('  node scripts/format-vertex-ai-credentials.js ./path/to/service-account.json');
  process.exit(1);
}

formatCredentials(credentialsPath);
