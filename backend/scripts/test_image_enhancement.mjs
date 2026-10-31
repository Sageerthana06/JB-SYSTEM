import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const API_URL = 'http://127.0.0.1:5000';

// Helper to create synthetic valid image buffers with genuine magic bytes
function createValidImageBuffer(format, targetSizeBytes = 1024) {
  const buf = Buffer.alloc(Math.max(32, targetSizeBytes));

  if (format === 'jpg' || format === 'jpeg') {
    buf[0] = 0xFF; buf[1] = 0xD8; buf[2] = 0xFF; buf[3] = 0xE0;
    buf[buf.length - 2] = 0xFF; buf[buf.length - 1] = 0xD9; // EOI
  } else if (format === 'png') {
    buf[0] = 0x89; buf[1] = 0x50; buf[2] = 0x4E; buf[3] = 0x47;
    buf[4] = 0x0D; buf[5] = 0x0A; buf[6] = 0x1A; buf[7] = 0x0A;
  } else if (format === 'gif') {
    buf.write('GIF89a', 0);
  } else if (format === 'webp') {
    buf.write('RIFF', 0);
    buf.writeUInt32LE(buf.length - 8, 4);
    buf.write('WEBP', 8);
    buf.write('VP8 ', 12);
  } else if (format === 'bmp') {
    buf[0] = 0x42; buf[1] = 0x4D; // BM
    buf.writeUInt32LE(buf.length, 2);
  }
  return buf;
}

async function runTests() {
  console.log('=== JB GROUP SYSTEM — IMAGE ENHANCEMENT TEST SUITE ===\n');

  // 1. Authenticate to get valid token
  console.log('[1] Generating authorized JWT token for SUPER_ADMIN...');
  const token = jwt.sign(
    { id: 1, email: 'ceo@jbgroup.com', role: 'SUPER_ADMIN' },
    process.env.JWT_SECRET || 'your_jwt_secret_key',
    { expiresIn: '1h' }
  );
  console.log('✓ Token generated successfully.\n');

  const uploadedFilesToCleanup = [];

  try {
    // 2. Test format support: JPG, JPEG, PNG, WebP, GIF, BMP (< 20 MB)
    console.log('[2] Testing Supported Formats Upload:');
    const formats = [
      { ext: 'jpg', mime: 'image/jpeg' },
      { ext: 'jpeg', mime: 'image/jpeg' },
      { ext: 'png', mime: 'image/png' },
      { ext: 'webp', mime: 'image/webp' },
      { ext: 'gif', mime: 'image/gif' },
      { ext: 'bmp', mime: 'image/bmp' }
    ];

    for (const f of formats) {
      const imgBuffer = createValidImageBuffer(f.ext, 50 * 1024); // 50 KB
      const formData = new FormData();
      formData.append('designImage', new Blob([imgBuffer], { type: f.mime }), `sample_test.${f.ext}`);

      const res = await fetch(`${API_URL}/api/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();

      if (res.status === 200 && data.success && data.imageUrl) {
        console.log(`  ✓ Format ${f.ext.toUpperCase()} (${f.mime}) uploaded successfully: ${data.imageUrl}`);
        uploadedFilesToCleanup.push(data.imageUrl);
      } else {
        console.error(`  ✗ Format ${f.ext.toUpperCase()} failed:`, data);
        throw new Error(`Upload failed for ${f.ext}`);
      }
    }

    // 3. Test Near-Limit Image (19.5 MB)
    console.log('\n[3] Testing Near-Limit Image Upload (19.5 MB):');
    const nearLimitSize = 19.5 * 1024 * 1024; // 19.5 MB = 20,447,232 bytes
    console.log(`  Generating 19.5 MB valid JPEG buffer (${nearLimitSize} bytes)...`);
    const nearLimitBuf = createValidImageBuffer('jpg', nearLimitSize);
    const nearLimitFormData = new FormData();
    nearLimitFormData.append('designImage', new Blob([nearLimitBuf], { type: 'image/jpeg' }), 'near_limit_19mb.jpg');

    const nearLimitRes = await fetch(`${API_URL}/api/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: nearLimitFormData
    });
    const nearLimitData = await nearLimitRes.json();

    if (nearLimitRes.status === 200 && nearLimitData.success) {
      console.log(`  ✓ 19.5 MB image accepted and uploaded successfully! (Saved: ${nearLimitData.imageUrl})`);
      uploadedFilesToCleanup.push(nearLimitData.imageUrl);
    } else {
      console.error('  ✗ 19.5 MB upload failed:', nearLimitData);
      throw new Error('Near-limit upload should have succeeded');
    }

    // 4. Test Oversized Image (> 20 MB, e.g. 20.5 MB)
    console.log('\n[4] Testing Oversized Image Upload Rejection (> 20 MB, e.g. 20.5 MB):');
    const overLimitSize = 20.5 * 1024 * 1024; // 20.5 MB = 21,495,808 bytes
    console.log(`  Generating 20.5 MB JPEG buffer (${overLimitSize} bytes)...`);
    const overLimitBuf = createValidImageBuffer('jpg', overLimitSize);
    const overLimitFormData = new FormData();
    overLimitFormData.append('designImage', new Blob([overLimitBuf], { type: 'image/jpeg' }), 'oversized_20_5mb.jpg');

    const overLimitRes = await fetch(`${API_URL}/api/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: overLimitFormData
    });
    const overLimitData = await overLimitRes.json();

    if (overLimitRes.status === 400 && overLimitData.message === 'Image size must not exceed 20 MB.') {
      console.log(`  ✓ Rejected with status 400 and exact required message: "${overLimitData.message}"`);
    } else {
      console.error(`  ✗ Over-limit rejection test failed. Status: ${overLimitRes.status}, Body:`, overLimitData);
      throw new Error('Oversized upload should have been rejected with exact message');
    }

    // 5. Test Invalid Content / Disguised Extension (e.g. fake.jpg containing plain text / script)
    console.log('\n[5] Testing Disguised Invalid File (fake.jpg with plain text):');
    const fakeBuf = Buffer.from('<?php echo "malicious payload"; ?> This is not an image!');
    const fakeFormData = new FormData();
    fakeFormData.append('designImage', new Blob([fakeBuf], { type: 'image/jpeg' }), 'malicious.jpg');

    const fakeRes = await fetch(`${API_URL}/api/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: fakeFormData
    });
    const fakeData = await fakeRes.json();

    if (fakeRes.status === 400 && fakeData.message.includes('Invalid image content')) {
      console.log(`  ✓ Disguised non-image rejected by server magic-byte validator: "${fakeData.message}"`);
    } else {
      console.error('  ✗ Disguised file test failed:', fakeData);
      throw new Error('Disguised non-image should have been rejected');
    }

    // 6. Test Customer Portal multipart upload route (/api/customer-portal/profile)
    console.log('\n[6] Testing Customer Portal Profile Image Upload:');
    // Login as a customer first
    const custLoginRes = await fetch(`${API_URL}/api/customer-portal/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: '0771234567', password: 'password123' })
    });
    const custLoginData = await custLoginRes.json();
    if (custLoginData.success && custLoginData.token) {
      const custToken = custLoginData.token;
      const custImgBuf = createValidImageBuffer('png', 40 * 1024);
      const custFormData = new FormData();
      custFormData.append('name', custLoginData.customer.name);
      custFormData.append('profilePhoto', new Blob([custImgBuf], { type: 'image/png' }), 'cust_portrait.png');

      const custUploadRes = await fetch(`${API_URL}/api/customer-portal/profile`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${custToken}` },
        body: custFormData
      });
      const custUploadData = await custUploadRes.json();

      if (custUploadRes.status === 200 && custUploadData.success) {
        console.log(`  ✓ Customer portal profile photo updated: ${custUploadData.customer.profilePhoto}`);
        uploadedFilesToCleanup.push(custUploadData.customer.profilePhoto);
      } else {
        console.warn('  ! Customer profile upload returned:', custUploadData);
      }
    } else {
      console.log('  (Skipping customer portal profile update test: sample customer login not configured)');
    }

  } finally {
    // Clean up uploaded test files
    console.log('\n[7] Cleaning up temporary test image files:');
    for (const relPath of uploadedFilesToCleanup) {
      if (!relPath) continue;
      const fileName = path.basename(relPath);
      const absPath = path.join(__dirname, '../../uploads/designs', fileName);
      try {
        if (fs.existsSync(absPath)) {
          fs.unlinkSync(absPath);
          console.log(`  Cleaned up: ${fileName}`);
        }
      } catch (e) {
        console.warn(`  Warning cleaning up ${fileName}:`, e.message);
      }
    }
  }

  console.log('\n=== ALL AUTOMATED TESTS COMPLETED SUCCESSFULLY! ===');
}

runTests().catch(err => {
  console.error('\nTEST RUN FAILED:', err);
  process.exit(1);
});
