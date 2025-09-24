#!/usr/bin/env node
/**
 * Generate audio file list from the audio directory
 * This script scans the audio folder and creates a JSON file with all MP3 files
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.join(__dirname, '..');
const audioDir = path.join(projectRoot, 'audio');
const outputFile = path.join(projectRoot, 'data', 'audio-files.json');

function generateAudioFileList() {
  try {
    // Ensure data directory exists
    const dataDir = path.dirname(outputFile);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Read audio directory
    if (!fs.existsSync(audioDir)) {
      console.error(`Audio directory not found: ${audioDir}`);
      process.exit(1);
    }

    const files = fs.readdirSync(audioDir);
    
    // Filter for MP3 files and sort them
    const mp3Files = files
      .filter(file => file.toLowerCase().endsWith('.mp3'))
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

    if (mp3Files.length === 0) {
      console.warn('No MP3 files found in audio directory');
    }

    // Create the audio file data structure
    const audioData = {
      generatedAt: new Date().toISOString(),
      totalFiles: mp3Files.length,
      files: mp3Files.map(filename => ({
        filename,
        title: filename.replace(/\.mp3$/i, '').replace(/_/g, ' '),
        path: `audio/${filename}`
      }))
    };

    // Write the JSON file
    fs.writeFileSync(outputFile, JSON.stringify(audioData, null, 2));
    
    console.log(`✅ Generated audio file list with ${mp3Files.length} files`);
    console.log(`📄 Output: ${outputFile}`);
    
    // List the files found
    console.log('\n📂 Audio files found:');
    mp3Files.forEach((file, index) => {
      console.log(`   ${index + 1}. ${file}`);
    });
    
  } catch (error) {
    console.error('❌ Error generating audio file list:', error);
    process.exit(1);
  }
}

generateAudioFileList();