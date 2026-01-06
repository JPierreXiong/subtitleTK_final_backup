/**
 * Cleanup Service
 * Handles temporary file cleanup
 */

import fs from 'fs';

/**
 * Clean up temporary files
 * @param filePaths Array of file paths to delete
 */
export async function cleanupTempFiles(filePaths: string[]): Promise<void> {
  for (const filePath of filePaths) {
    if (!filePath) continue;

    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`[Cleanup] Deleted temporary file: ${filePath}`);
      }
    } catch (error: any) {
      console.warn(`[Cleanup] Failed to delete file ${filePath}`, {
        error: error.message,
      });
      // Don't throw - continue cleaning up other files
    }
  }
}

