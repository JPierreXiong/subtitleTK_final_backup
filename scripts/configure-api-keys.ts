/**
 * Configure RapidAPI and Gemini API keys
 * This script adds the API keys to the database config table
 */

import { saveConfigs } from '../src/shared/models/config';

async function configureAPIKeys() {
  try {
    console.log('Configuring API keys...');

    const configs: Record<string, string> = {
      // RapidAPI Key for TikTok and YouTube media extraction
      rapidapi_key: '558c577f30msh4f4e14fdc702b0cp1cf611jsn339fa91dba2b',
      rapidapi_media_key: '558c577f30msh4f4e14fdc702b0cp1cf611jsn339fa91dba2b',
      
      // Gemini API Key for translation
      gemini_api_key: 'AIzaSyD-kp-66sGmHLwaj1P_UgLCB4_7Q8z8yu0',
    };

    await saveConfigs(configs);

    console.log('✓ API keys configured successfully!');
    console.log('\nConfigured keys:');
    console.log('  - RapidAPI Key: 558c577f30msh4f4e14fdc702b0cp1cf611jsn339fa91dba2b');
    console.log('  - Gemini API Key: AIzaSyD-kp-66sGmHLwaj1P_UgLCB4_7Q8z8yu0');
    
    process.exit(0);
  } catch (error: any) {
    console.error('✗ Error configuring API keys:', error.message);
    console.error(error);
    process.exit(1);
  }
}

configureAPIKeys();

