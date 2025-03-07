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

// TTS Generation using ElevenLabs with streaming support
async function generateTTS(text: string): Promise<{ filename: string }> {
  try {
    // Create unique filename and directory structure
    const filename = `tts-${uuidv4()}.mp3`;
    const dir = path.join(process.cwd(), "public/audio");
    await mkdir(dir, { recursive: true }); // Ensure directory exists
    const filePath = path.join(dir, filename);
    
    console.log("Generating speech with ElevenLabs for text:", text.substring(0, 50) + "...");
    
    // ElevenLabs API requires an API key
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      throw new Error("ELEVENLABS_API_KEY is not defined in environment variables");
    }
    
    // Default to "Rachel" voice - one of ElevenLabs' default voices
    const voiceId = "21m00Tcm4TlvDq8ikWAM"; // Rachel voice
    
    // Call ElevenLabs streaming API
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
          },
        }),
      }
    );

    if (!response.ok) {
      let errorText = await response.text();
      console.error("ElevenLabs API Error:", response.status, errorText);
      throw new Error(`ElevenLabs TTS Error: ${response.status} - ${errorText}`);
    }

    // Handle streaming response
    // Handle streaming response
    if (!response.body) {
      throw new Error("No response body received from ElevenLabs");
    }

    // Create a write stream to save the audio to a file
    const writeStream = createWriteStream(filePath);

    // CHANGE THIS PART - Remove the double promise pattern
    // Pipe the response stream directly to the file
    await new Promise<void>((resolve, reject) => {
      response.body?.pipe(writeStream);
      writeStream.on("finish", () => {
        console.log(`Audio file saved to ${filePath}`);
        resolve();
      });
      writeStream.on("error", (err) => {
        console.error("Error writing audio file:", err);
        reject(err);
      });
    });
    
    return { filename };
    
  } catch (error: any) {
    console.error("TTS Error:", error);
    throw new Error(`Speech synthesis failed: ${error.message}`);
  }
}



// STT Conversion
async function generateSTT(audioData: ProcessedAudio): Promise<string> {
  try {
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

    return (
      response.results
        ?.map((result) => result.alternatives?.[0]?.transcript)
        .join(" ") || ""
    );
  } catch (error) {
    console.error("STT Error:", error);
    throw new Error("Speech recognition failed");
  }
}

export async function POST(req: Request) {
  try {
    const startTime = Date.now();
    console.log("Request received");
    
    // Check if client wants streaming
    const wantsStreaming = req.headers.get('x-use-streaming') === 'true';
    
    const formData = await req.formData();
    const audioBlob = formData.get("audio") as Blob | null;
    
    const processedAudio = await processAudio(audioBlob);
    const transcript = await generateSTT(processedAudio);
    console.log("Transcript:", transcript);
    
    const geminiResponse = await fetchGeminiResponse(transcript);
    console.log("AI response received");

    if (wantsStreaming) {
      // For streaming, return just the text and information needed for streaming
      return NextResponse.json({
        text: geminiResponse,
        streamingEnabled: true,
        streamText: geminiResponse
      });
    } else {
      // Traditional response path - existing code
      const ttsAudio = await generateTTS(geminiResponse);
      
      return NextResponse.json({
        text: geminiResponse,
        audio: `/audio/${ttsAudio.filename}`,
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