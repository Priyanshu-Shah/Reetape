import { NextResponse } from "next/server";
import { processAudio, ProcessedAudio } from "@/app/audio/processor";
import { SpeechClient } from '@google-cloud/speech';
import fetch from "node-fetch";
import { Readable, Stream } from "stream";
import { pipeline } from "stream/promises";
import { fetchGeminiResponse, streamGeminiResponse } from "@/app/api/chat/gemini";
import { v4 as uuidv4 } from "uuid";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { createWriteStream } from "fs";
import { PassThrough } from "stream";

const credentials = JSON.parse(process.env.NEXT_PUBLIC_GOOGLE_APPLICATION_CREDENTIALS_JSON!);
const speechClient = new SpeechClient({ credentials });

async function generateTTS(text: string): Promise<{ filename: string }> {
  try {
    const filename = `tts-${uuidv4()}.mp3`;
    const dir = path.join(process.cwd(), "public/audio");
    await mkdir(dir, { recursive: true }); // Ensure directory exists
    const filePath = path.join(dir, filename);
    
    // Get a streaming response from PlayHT
    const response = await fetch("https://api.play.ht/api/v2/tts/stream", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.PLAYHT_API_KEY}`,
        "X-USER-ID": process.env.PLAYHT_USER_ID!,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg"
      },
      body: JSON.stringify({
        text: text,
        voice: "s3://voice-cloning-zero-shot/d9ff78ba-d016-47f6-b0ef-dd630f59414e/female-cs/manifest.json",
        quality: "draft",
        output_format: "mp3",
        voice_engine: "PlayHT2.0",
        sample_rate: 24000
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`PlayHT TTS Error: ${response.status} - ${errorData}`);
    }

    // Stream the response to a file
    const fileStream = createWriteStream(filePath);
    const responseBody = response.body;
    
    if (!responseBody) {
      throw new Error("No response body received from PlayHT");
    }
    
    // Create a readable stream from the response body
    const readableStream = Readable.fromWeb(responseBody as any);
    
    // Pipe the stream to the file
    await pipeline(readableStream, fileStream);
    
    return { filename };
  } catch (error) {
    console.error("TTS Error:", error);
    throw new Error("Speech synthesis failed");
  }
}


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
export async function POST(req: Request) {
  try {
    const startTime = Date.now();
    console.log("Request received");

    const formDataStart = Date.now();
    const formData = await req.formData();
    console.log(`FormData processing time: ${Date.now() - formDataStart}ms`);

    const audioStart = Date.now();
    const audioBlob = formData.get("audio") as Blob | null;
    console.log("Audio blob extracted");
    console.log(`Audio extraction time: ${Date.now() - audioStart}ms`);

    const processStart = Date.now();
    const processedAudio = await processAudio(audioBlob);
    console.log("Audio processed");
    console.log(`Audio processing time: ${Date.now() - processStart}ms`);

    const transcriptStart = Date.now();
    const transcript = await generateSTT(processedAudio);
    console.log("Transcript:", transcript);
    console.log(`STT generation time: ${Date.now() - transcriptStart}ms`);

    // Check if the client supports streaming
    const wantsStream = Boolean(formData.get("stream") === "true");
    
    if (wantsStream) {
      // Create a stream response
      const stream = new PassThrough();
      
      // Start the response early
      const responseStream = new Response(stream as any, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
      
      // Start streaming the LLM response
      streamGeminiResponse(transcript, (token) => {
        // Send each token as an SSE event
        stream.write(`data: ${JSON.stringify({ type: 'token', content: token })}\n\n`);
      }).then(async () => {
        // When LLM streaming is complete, generate TTS
        try {
          const fullText = await fetchGeminiResponse(transcript);
          const ttsAudio = await generateTTS(fullText);
          
          // Send the audio URL as an event
          stream.write(`data: ${JSON.stringify({ 
            type: 'audio', 
            url: `/audio/${ttsAudio.filename}`,
            text: fullText 
          })}\n\n`);
          
          stream.end("data: [DONE]\n\n");
        } catch (error) {
          console.error("Error generating TTS:", error);
          stream.write(`data: ${JSON.stringify({ 
            type: 'error', 
            message: 'Error generating audio'
          })}\n\n`);
          stream.end();
        }
      }).catch((error) => {
        console.error("Error in stream:", error);
        stream.write(`data: ${JSON.stringify({ 
          type: 'error', 
          message: error.message || 'Stream error'
        })}\n\n`);
        stream.end();
      });
      
      return responseStream;
    } else {
      // Non-streaming path (existing implementation)
      const responseStart = Date.now();
      const geminiResponse = await fetchGeminiResponse(transcript);
      console.log("AI response received");
      console.log(`AI response time: ${Date.now() - responseStart}ms`);

      const ttsStart = Date.now();
      const ttsAudio = await generateTTS(geminiResponse);
      console.log("TTS audio:", ttsAudio);
      console.log(`TTS generation time: ${Date.now() - ttsStart}ms`);

      console.log(`Total time: ${Date.now() - startTime}ms`);

      return NextResponse.json({
        text: geminiResponse,
        audio: `/audio/${ttsAudio.filename}`,
      });
    }
  } catch (error) {
    console.error("Error in API route:", error);
    return NextResponse.json({ err: error }, { status: 500 });
  }
}