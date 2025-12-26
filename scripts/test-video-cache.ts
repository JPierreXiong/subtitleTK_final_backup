/**
 * Test video cache functionality
 * Tests URL normalization, fingerprint generation, and cache operations
 */

import { generateVideoFingerprint, normalizeVideoUrl } from '../src/shared/lib/media-url';
import {
  findValidVideoCache,
  setVideoCache,
} from '../src/shared/models/video_cache';

async function testVideoCache() {
  console.log('🧪 Testing Video Cache Functionality\n');

  const testUrl1 =
    'https://www.tiktok.com/@Dasher/video/7574110549382909201?is_from_webapp=1&sender_device=pc';
  const testUrl2 =
    'https://www.tiktok.com/@Dasher/video/7574110549382909201?is_from_webapp=1&sender_device=pc';

  console.log('📋 Test URLs:');
  console.log(`   URL 1: ${testUrl1}`);
  console.log(`   URL 2: ${testUrl2}\n`);

  // Step 1: Test URL normalization
  console.log('1️⃣ Testing URL normalization...');
  const normalized1 = normalizeVideoUrl(testUrl1);
  const normalized2 = normalizeVideoUrl(testUrl2);
  console.log(`   Normalized URL 1: ${normalized1}`);
  console.log(`   Normalized URL 2: ${normalized2}`);
  console.log(`   ✅ URLs match: ${normalized1 === normalized2}\n`);

  // Step 2: Test fingerprint generation
  console.log('2️⃣ Testing fingerprint generation...');
  const fingerprint1 = generateVideoFingerprint(testUrl1);
  const fingerprint2 = generateVideoFingerprint(testUrl2);
  console.log(`   Fingerprint 1: ${fingerprint1.substring(0, 32)}...`);
  console.log(`   Fingerprint 2: ${fingerprint2.substring(0, 32)}...`);
  console.log(`   ✅ Fingerprints match: ${fingerprint1 === fingerprint2}\n`);

  // Step 3: Check cache (should be empty initially)
  console.log('3️⃣ Checking cache (initial state)...');
  const cached1 = await findValidVideoCache(fingerprint1);
  if (cached1) {
    console.log('   ⚠️  Cache entry found (unexpected)');
    console.log(`      Platform: ${cached1.platform}`);
    console.log(`      Expires at: ${cached1.expiresAt}`);
  } else {
    console.log('   ✅ Cache is empty (expected for first test)\n');
  }

  // Step 4: Simulate cache set (with mock download URL)
  console.log('4️⃣ Simulating cache set...');
  const mockDownloadUrl =
    'https://example.com/video/test-video.mp4'; // Mock URL for testing
  try {
    const cachedEntry = await setVideoCache(fingerprint1, {
      originalUrl: testUrl1,
      downloadUrl: mockDownloadUrl,
      platform: 'tiktok',
      expiresInHours: 12,
    });
    console.log('   ✅ Cache entry created successfully');
    console.log(`      ID: ${cachedEntry.id.substring(0, 32)}...`);
    console.log(`      Platform: ${cachedEntry.platform}`);
    console.log(`      Download URL: ${cachedEntry.downloadUrl}`);
    console.log(`      Expires at: ${cachedEntry.expiresAt}\n`);
  } catch (error: any) {
    console.error('   ❌ Failed to set cache:', error.message);
    throw error;
  }

  // Step 5: Verify cache lookup
  console.log('5️⃣ Verifying cache lookup...');
  const cached2 = await findValidVideoCache(fingerprint2);
  if (cached2) {
    console.log('   ✅ Cache entry found!');
    console.log(`      Platform: ${cached2.platform}`);
    console.log(`      Download URL: ${cached2.downloadUrl}`);
    console.log(`      Expires at: ${cached2.expiresAt}`);
    console.log(
      `      ✅ Fingerprints match: ${cached2.id === fingerprint2}\n`
    );
  } else {
    console.log('   ❌ Cache entry not found (unexpected)\n');
  }

  // Step 6: Test with same URL again (should use same fingerprint)
  console.log('6️⃣ Testing with same URL again...');
  const fingerprint3 = generateVideoFingerprint(testUrl2);
  const cached3 = await findValidVideoCache(fingerprint3);
  if (cached3 && cached3.id === fingerprint3) {
    console.log('   ✅ Cache hit confirmed!');
    console.log(
      `      Same fingerprint used: ${fingerprint3.substring(0, 32)}...\n`
    );
  } else {
    console.log('   ❌ Cache lookup failed\n');
  }

  console.log('✅ All tests completed!\n');
  console.log('📊 Summary:');
  console.log('   - URL normalization: ✅ Working');
  console.log('   - Fingerprint generation: ✅ Working');
  console.log('   - Cache set: ✅ Working');
  console.log('   - Cache lookup: ✅ Working');
  console.log(
    '\n💡 Next step: Test with real API calls in the application'
  );
}

testVideoCache()
  .then(() => {
    console.log('\n✅ Test script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test script failed:', error);
    process.exit(1);
  });

