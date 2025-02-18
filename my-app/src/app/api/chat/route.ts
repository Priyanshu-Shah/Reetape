import { NextResponse } from 'next/server';
import { processAudio, ProcessedAudio} from '@/app/audio/processor';
import { fetchGeminiResponse } from '@/app/api/chat/gemini';
import { SpeechClient } from '@google-cloud/speech';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
// import { Storage } from '@google-cloud/storage';
import { v4 as uuidv4 } from 'uuid';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';

// Configure Google Cloud clients
const speechClient = new SpeechClient({
    keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
});

const ttsClient = new TextToSpeechClient({
    keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
});

// STT Conversion
async function generateSTT(audioData: ProcessedAudio): Promise<string> {
    try {
        const [response] = await speechClient.recognize({
            audio: {
                content: audioData.buffer.toString('base64')
            },
            config: {
                encoding: 'LINEAR16',
                sampleRateHertz: audioData.sampleRate,
                languageCode: 'en-US',
                enableAutomaticPunctuation: true,
                model: 'latest_long'
            }
        });
        
        return response.results
            ?.map(result => result.alternatives?.[0]?.transcript)
            .join(' ') || '';
    } catch (error) {
        console.error('STT Error:', error);
        throw new Error('Speech recognition failed');
    }
  }

// TTS Generation
async function generateTTS(text: string): Promise<{ filename: string }> {
    try {
        const [response] = await ttsClient.synthesizeSpeech({
            input: { text },
            voice: {
                languageCode: 'en-US',
                name: 'en-US-Studio-O',
                ssmlGender: 'FEMALE'
            },
            audioConfig: {
                audioEncoding: 'MP3',
                speakingRate: 1.0,
                pitch: 0
            }
        });

        const filename = `tts-${uuidv4()}.mp3`;
        
        const dir = path.join(process.cwd(), 'public/audio');
        await mkdir(dir, { recursive: true }); // Ensure the directory exists

        const filePath = path.join(dir, filename);
        await writeFile(filePath, response.audioContent as Buffer, 'binary');

        
        return { filename };
    } catch (error) {
        console.error('TTS Error:', error);
        throw new Error('Speech synthesis failed');
    }
}


export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const audioBlob = formData.get('audio') as Blob | null;
    const processedAudio = await processAudio(audioBlob);
    const transcript = await generateSTT(processedAudio)
    const geminiResponse = await fetchGeminiResponse(transcript);
    const ttsAudio = await generateTTS(geminiResponse);
    console.log(req);

    return NextResponse.json({
      text: geminiResponse,
      audio: `/audio/${ttsAudio.filename}`
    });
  } 
  catch (error) {
    return NextResponse.json(
      { error: error},
      { status: 500 }
    );
  }
}
