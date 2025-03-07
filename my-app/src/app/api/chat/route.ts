import { NextResponse } from "next/server";
import { processAudio, ProcessedAudio } from "@/app/audio/processor";
import { fetchGeminiResponse } from "@/app/api/chat/gemini";
import { SpeechClient } from "@google-cloud/speech";
//import { Storage } from '@google-cloud/storage';
import { v4 as uuidv4 } from "uuid";
import { mkdir } from "fs/promises";
import path from "path";
import fs from "fs";

// Initialize the Speech client with proper typing
const credentials = JSON.parse(
  process.env.NEXT_PUBLIC_GOOGLE_APPLICATION_CREDENTIALS_JSON!
);

const speechClient = new SpeechClient({ credentials });

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

async function generateTTS(text: string) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Orca } = require("@picovoice/orca-node");
    const accessKey = "+PNFFTmIMG0/vhJjkhBD+v6xUSKQ71ljhRLNOo3+8CeHJxLae4t08w==";
    const orca = new  Orca(accessKey);
    
    // Create a streaming instance
    const stream = orca.streamOpen();
    
    // Generate a unique filename
    const filename = `tts-${uuidv4()}.mp3`;
    const dir = path.join(process.cwd(), "public/audio");
    await mkdir(dir, { recursive: true });
    const filePath = path.join(dir, filename);
    
    // Create a write stream
    const fileStream = fs.createWriteStream(filePath);
    
    // Process text in chunks for streaming
    // You can split the text or process it as it comes from the LLM
    const chunks = text.match(/.{1,100}(?:\s|$)/g) || [text];
    
    for (const chunk of chunks) {
      const audioChunk = stream.synthesize(chunk);
      fileStream.write(audioChunk);
    }
    
    // Flush any remaining audio
    const finalChunk = stream.flush();
    if (finalChunk) {
      fileStream.write(finalChunk);
    }
    
    fileStream.end();
    stream.close();
    
    return { filename };
  } catch (error) {
    console.error("TTS Error:", error);
    throw new Error("Speech synthesis failed");
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