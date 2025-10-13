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
const asmrDir = path.join(audioDir, 'asmr');
const asmrOutputFile = path.join(projectRoot, 'data', 'asmr-layers.json');

function toKebabCase(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'layer';
}

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

    generateASMRManifest();

  } catch (error) {
    console.error('❌ Error generating audio file list:', error);
    process.exit(1);
  }
}

function generateASMRManifest() {
  try {
    const layers = [];
    if (fs.existsSync(asmrDir)) {
      const files = fs
        .readdirSync(asmrDir)
        .filter((file) => file.toLowerCase().endsWith('.webm'))
        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
      files.forEach((filename, index) => {
        const title = filename
          .replace(/\.webm$/i, '')
          .replace(/[_-]+/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        const lane = Math.min(3, 1 + Math.floor(index / 1.5));
        const baseVolume = Number((0.26 + index * 0.05).toFixed(2));
        const rateRange = Number((0.08 + index * 0.03).toFixed(2));
        layers.push({
          id: toKebabCase(title || filename),
          title: title || filename,
          src: `audio/asmr/${filename}`,
          lane,
          baseVolume,
          rateRange,
          baseRate: 1,
        });
      });
    }

    const payload = {
      generatedAt: new Date().toISOString(),
      totalLayers: layers.length,
      layers,
      notes: layers.length
        ? 'Derived from audio/asmr/*.webm files.'
        : 'No .webm layers detected. Drop looped ASMR clips into audio/asmr/.',
    };

    fs.writeFileSync(asmrOutputFile, JSON.stringify(payload, null, 2));

    if (layers.length) {
      console.log(`\n🎧 ASMR layers registered: ${layers.length}`);
      layers.forEach((layer, index) => {
        console.log(`   ${index + 1}. ${layer.title} → ${layer.src}`);
      });
    } else {
      console.log('\n⚠️  No ASMR .webm layers found in audio/asmr/. Manifest written with guidance.');
    }
  } catch (error) {
    console.error('❌ Failed to generate ASMR manifest:', error);
  }
}

generateAudioFileList();