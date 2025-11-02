/**
 * Utility to parse and validate Google Vertex AI service account credentials
 * from environment variable
 */

import * as fs from "fs";
import * as path from "path";

export interface ServiceAccountCredentials {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
}

/**
 * Parse service account credentials from environment variable
 * Supports both JSON string and JSON file path
 */
export function getVertexAICredentials(): ServiceAccountCredentials {
  const credentialsEnv = process.env.GOOGLE_VERTEX_AI_CREDENTIALS?.trim();

  if (!credentialsEnv || credentialsEnv === "" || credentialsEnv === '""') {
    throw new Error(
      "GOOGLE_VERTEX_AI_CREDENTIALS environment variable is not set or is empty. Please set it in your .env file with your Google Cloud service account JSON credentials."
    );
  }

  let credentialsJson: string;

  // Check if it's a file path (doesn't start with { and not valid JSON)
  if (!credentialsEnv.startsWith("{") && !credentialsEnv.startsWith('"')) {
    try {
      // Try to read as file path (relative to backend directory or absolute)
      const filePath = path.isAbsolute(credentialsEnv)
        ? credentialsEnv
        : path.join(process.cwd(), credentialsEnv.replace(/^\.\//, ""));
      
      if (!fs.existsSync(filePath)) {
        throw new Error(`Credentials file not found at: ${filePath}`);
      }

      credentialsJson = fs.readFileSync(filePath, "utf-8");
      console.log(`✅ Loaded Vertex AI credentials from file: ${filePath}`);
    } catch (fileError) {
      throw new Error(
        `Failed to read credentials file: ${fileError instanceof Error ? fileError.message : String(fileError)}\n` +
        `Tried path: ${credentialsEnv}\n` +
        `Make sure the file exists and is readable.`
      );
    }
  } else {
    // It's a JSON string
    credentialsJson = credentialsEnv;
  }

  try {
    // Parse the JSON (either from file or string)
    const credentials = JSON.parse(credentialsJson) as ServiceAccountCredentials;

    // Validate required fields
    if (!credentials.project_id) {
      throw new Error("Missing project_id in service account credentials");
    }
    if (!credentials.private_key) {
      throw new Error("Missing private_key in service account credentials");
    }
    if (!credentials.client_email) {
      throw new Error("Missing client_email in service account credentials");
    }

    return credentials;
  } catch (error) {
    if (error instanceof SyntaxError) {
      // If parsing fails, provide helpful error message
      throw new Error(
        "Failed to parse GOOGLE_VERTEX_AI_CREDENTIALS. It must be either:\n" +
        "1. A valid JSON string, or\n" +
        "2. A path to a JSON file containing the credentials\n\n" +
        "Please check:\n" +
        "- If using a JSON string: ensure it's properly formatted and escaped\n" +
        "- If using a file path: ensure the file exists and contains valid JSON\n" +
        "- Newlines in private_key should be escaped as \\n when using JSON string\n\n" +
        "Example JSON string: GOOGLE_VERTEX_AI_CREDENTIALS='{\"type\":\"service_account\",...}'\n" +
        "Example file path: GOOGLE_VERTEX_AI_CREDENTIALS=./credentials.json"
      );
    }
    throw error;
  }
}

/**
 * Get the project ID from credentials
 */
export function getVertexAIProjectId(): string {
  const credentials = getVertexAICredentials();
  return credentials.project_id;
}

/**
 * Get the location for Vertex AI (defaults to us-central1)
 */
export function getVertexAILocation(): string {
  return process.env.GOOGLE_VERTEX_AI_LOCATION || "us-central1";
}
