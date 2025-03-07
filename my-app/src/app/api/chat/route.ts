import { NextResponse } from "next/server";
import { processAudio, ProcessedAudio } from "@/app/audio/processor";
import { fetchGeminiResponse } from "@/app/api/chat/gemini";
import { v4 as uuidv4 } from "uuid";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { SpeechClient } from '@google-cloud/speech';
import fetch from "node-fetch";
import { createWriteStream } from "fs";
import { Buffer } from "buffer";

// Initialize the Speech client with proper typing
const credentials = JSON.parse(
  process.env.NEXT_PUBLIC_GOOGLE_APPLICATION_CREDENTIALS_JSON!
);

const speechClient = new SpeechClient({ credentials });
// TTS Generation using ElevenLabs
async function generateTTS(text: string): Promise<{ filename: string }> {
  try {
    const ttsStartTime = Date.now();
    console.log(`Starting TTS for text (${text.length} chars)...`);
    
    // Create unique filename and directory structure
    const filename = `tts-${uuidv4()}.mp3`;
    const dir = path.join(process.cwd(), "public/audio");
    await mkdir(dir, { recursive: true }); // Ensure directory exists
    const filePath = path.join(dir, filename);
    
    // ElevenLabs API requires an API key
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      throw new Error("ELEVENLABS_API_KEY is not defined in environment variables");
    }
    
    // Default to "Rachel" voice - one of ElevenLabs' default voices
    const voiceId = "21m00Tcm4TlvDq8ikWAM"; // Rachel voice
    
    // Call ElevenLabs API
    const apiCallStart = Date.now();
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": apiKey,
        },
        body: JSON.stringify({
          text: text,
          model_id: "eleven_turbo_v2",
          output_format: "mp3_44100_128",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.5,
            use_speaker_boost: true,
          },
        }),
      }
    );
    console.log(`ElevenLabs API initial response received in ${Date.now() - apiCallStart}ms`);

    if (!response.ok) {
      let errorText = await response.text();
      console.error("ElevenLabs API Error:", response.status, errorText);
      throw new Error(`ElevenLabs TTS Error: ${response.status} - ${errorText}`);
    }

    // Handle streaming response
    if (!response.body) {
      throw new Error("No response body received from ElevenLabs");
    }

    // Create a write stream to save the audio to a file
    const writeStream = createWriteStream(filePath);
    
    // Start processing and measuring stream
    const streamStart = Date.now();
    console.log("Processing audio stream...");

    // Read the stream from ElevenLabs and write it to the file
    const streamPromise = new Promise<void>((resolve, reject) => {
      response.body?.pipe(writeStream);
      
      writeStream.on("finish", () => {
        const streamTime = Date.now() - streamStart;
        console.log(`Audio stream processed and saved in ${streamTime}ms`);
        console.log(`Total TTS operation completed in ${Date.now() - ttsStartTime}ms`);
        resolve();
      });
      
      writeStream.on("error", (err) => {
        console.error("Error writing audio file:", err);
        reject(err);
      });
    });

    await streamPromise;
    return { filename };
    
  } catch (error: any) {
    console.error("TTS Error:", error);
    throw new Error(`Speech synthesis failed: ${error.message}`);
  }
}


// STT Conversion with detailed timing
async function generateSTT(audioData: ProcessedAudio): Promise<string> {
  try {
    const sttStartTime = Date.now();
    console.log(`Starting STT for audio (${audioData.buffer.length} bytes, ${audioData.sampleRate} Hz)...`);
    
    const apiCallStart = Date.now();
    const [response] = await speechClient.recognize({
      audio: {
        content: audioData.buffer.toString("base64"),
      },
      config: {
        encoding: "LINEAR16",
        sampleRateHertz: audioData.sampleRate,
        languageCode: "en-US",
        enableAutomaticPunctuation: true,
        model: "latest_long",
      },
    });
    console.log(`Google Cloud STT API call completed in ${Date.now() - apiCallStart}ms`);

    const transcript = response.results
      ?.map((result) => result.alternatives?.[0]?.transcript)
      .join(" ") || "";
      
    console.log(`Total STT operation completed in ${Date.now() - sttStartTime}ms`);
    console.log(`Transcript word count: ${transcript.split(' ').length}`);
    
    return transcript;
  } catch (error) {
    console.error("STT Error:", error);
    throw new Error("Speech recognition failed");
  }
}


export async function POST(req: Request) {
  try {
    const totalStartTime = Date.now();
    console.log("== API Request Started ==");
    
    // Check if client wants streaming
    const wantsStreaming = req.headers.get('x-use-streaming') === 'true';
    console.log(`Streaming mode: ${wantsStreaming ? "enabled" : "disabled"}`);
    
    // Timing: Form data parsing
    const formDataStart = Date.now();
    const formData = await req.formData();
    const formDataTime = Date.now() - formDataStart;
    console.log(`✓ Form data parsed in ${formDataTime}ms`);
    
    // Timing: Audio processing
    const audioProcessingStart = Date.now();
    const audioBlob = formData.get("audio") as Blob | null;
    const processedAudio = await processAudio(audioBlob);
    const audioProcessingTime = Date.now() - audioProcessingStart;
    console.log(`✓ Audio processed in ${audioProcessingTime}ms`);
    
    // Timing: Speech-to-Text
    const sttStart = Date.now();
    const transcript = await generateSTT(processedAudio);
    const sttTime = Date.now() - sttStart;
    console.log(`✓ Speech-to-Text completed in ${sttTime}ms`);
    console.log(`Transcript: "${transcript.substring(0, 100)}${transcript.length > 100 ? '...' : ''}"`);
    
    // Timing: AI Model Response
    const modelStart = Date.now();
    const geminiResponse = await fetchGeminiResponse(transcript);
    const modelTime = Date.now() - modelStart;
    console.log(`✓ AI response generated in ${modelTime}ms`);
    console.log(`Response: "${geminiResponse.substring(0, 100)}${geminiResponse.length > 100 ? '...' : ''}"`);

    if (wantsStreaming) {
      // For streaming, return just the text and information needed for streaming
      console.log("Returning streaming information to client");
      return NextResponse.json({
        text: geminiResponse,
        streamingEnabled: true,
        streamText: geminiResponse,
        timing: {
          audio_processing: audioProcessingTime,
          stt: sttTime,
          ai_response: modelTime,
          total: Date.now() - totalStartTime
        }
      });
    } else {
      // Traditional response path - existing code
      const ttsStart = Date.now();
      const ttsAudio = await generateTTS(geminiResponse);
      const ttsTime = Date.now() - ttsStart;
      console.log(`✓ Text-to-Speech completed in ${ttsTime}ms`);
      
      const totalTime = Date.now() - totalStartTime;
      console.log(`== Total API processing time: ${totalTime}ms ==`);
      console.log("Performance breakdown:");
      console.log(`- Audio Processing: ${audioProcessingTime}ms (${(audioProcessingTime/totalTime*100).toFixed(1)}%)`);
      console.log(`- Speech-to-Text: ${sttTime}ms (${(sttTime/totalTime*100).toFixed(1)}%)`);
      console.log(`- AI Response: ${modelTime}ms (${(modelTime/totalTime*100).toFixed(1)}%)`);
      console.log(`- Text-to-Speech: ${ttsTime}ms (${(ttsTime/totalTime*100).toFixed(1)}%)`);
      
      return NextResponse.json({
        text: geminiResponse,
        audio: `/audio/${ttsAudio.filename}`,
        timing: {
          audio_processing: audioProcessingTime,
          stt: sttTime,
          ai_response: modelTime,
          tts: ttsTime,
          total: totalTime
        }
      });
    }
  } catch (error) {
    // Existing error handling code
    console.error("Error in API route:", error);
    return NextResponse.json({ 
      error: "Error processing request",
      message: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}