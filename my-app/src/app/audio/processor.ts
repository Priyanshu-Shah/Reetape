import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
// import { PassThrough } from 'stream';
import { promisify } from 'util';
import { writeFile, unlink } from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegStatic!);

export interface ProcessedAudio {
    buffer: Buffer;
    sampleRate: number;
    mimeType: string;
}

export async function processAudio(blob: Blob | null): Promise<ProcessedAudio> {
    if (!blob) throw new Error('No audio data received');
    
    try {
        // Convert Blob to Buffer
        const arrayBuffer = await blob.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Create temporary file
        const tempFileName = `/tmp/${uuidv4()}.webm`;
        await writeFile(tempFileName, buffer);

        // Convert audio to Google STT compatible format
        return new Promise((resolve, reject) => {
            ffmpeg(tempFileName)
                .audioFrequency(16000)
                .audioChannels(1)
                .audioCodec('pcm_s16le') // LINEAR16 encoding
                .format('wav')
                .on('end', async () => {
                    try {
                        const outputBuffer = await readFile(tempFileName);
                        await unlink(tempFileName);
                        
                        resolve({
                            buffer: outputBuffer,
                            sampleRate: 16000,
                            mimeType: 'audio/wav'
                        });
                    } catch (err) {
                        reject(err);
                    }
                })
                .on('error', reject)
                .save(tempFileName);
        });
    } catch (error) {
        throw new Error(`Audio processing failed: ${error instanceof Error ? error.message : error}`);
    }
}

// Helper function to read file as Buffer
async function readFile(path: string): Promise<Buffer> {
    return promisify(fs.readFile)(path);
}
