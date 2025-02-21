import ffmpeg from 'fluent-ffmpeg';
//import ffmpegStatic from 'ffmpeg-static';
import { promisify } from 'util';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

import { path as ffmpegPath } from '@ffmpeg-installer/ffmpeg';

// Set ffmpeg path
console.log("FFmpeg path:", ffmpegPath);
ffmpeg.setFfmpegPath(ffmpegPath!);

export interface ProcessedAudio {
    buffer: Buffer;
    sampleRate: number;
    mimeType: string;
}

function runFFmpeg(inputPath: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .audioFrequency(16000)
        .audioChannels(1)
        .audioCodec('pcm_s16le')
        .format('wav')
        .on('start', (commandLine) => {
          console.log('FFmpeg command:', commandLine);
        })
        .on('error', (err) => {
          console.error('FFmpeg error:', err);
          reject(err);
        })
        .on('end', () => {
          console.log('FFmpeg processing finished');
          resolve();
        })
        .save(outputPath);
    });
  }
  

  export async function processAudio(blob: Blob | null): Promise<ProcessedAudio> {
    console.log("processAudio called");
    if (!blob) throw new Error('No audio data received');
    
    try {
      const arrayBuffer = await blob.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
  
      const tempDir = path.join(process.cwd(), 'tmp');
      await mkdir(tempDir, { recursive: true });
  
      const inputFileName = path.join(tempDir, `${uuidv4()}.webm`);
      const outputFileName = path.join(tempDir, `${uuidv4()}.wav`);
  
      await writeFile(inputFileName, buffer);
      console.log("Wrote input file successfully");
  
      await runFFmpeg(inputFileName, outputFileName);
  
      const outputBuffer = await readFile(outputFileName);
      
      await unlink(inputFileName);
      await unlink(outputFileName);
  
      return {
        buffer: outputBuffer,
        sampleRate: 16000,
        mimeType: 'audio/wav'
      };
    } catch (error) {
      console.error("processAudio error:", error);
      throw new Error(`Audio processing failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  

// Helper function to read file as Buffer
async function readFile(path: string): Promise<Buffer> {
    return promisify(fs.readFile)(path);
}
