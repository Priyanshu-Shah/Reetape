import { NextResponse } from "next/server";
import { processAudio, ProcessedAudio } from "@/app/audio/processor";
import { fetchGeminiResponse } from "@/app/api/chat/gemini";
import { SpeechClient } from "@google-cloud/speech";
import { TextToSpeechClient } from "@google-cloud/text-to-speech";
//import { Storage } from '@google-cloud/storage';
import { v4 as uuidv4 } from "uuid";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

// Configure Google Cloud clients
const credentials = JSON.parse(
  process.env.NEXT_PUBLIC_GOOGLE_APPLICATION_CREDENTIALS_JSON!
);

const speechClient = new SpeechClient({ credentials });
const ttsClient = new TextToSpeechClient({ credentials });

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

// TTS Generation
async function generateTTS(text: string): Promise<{ filename: string }> {
  try {
    const [response] = await ttsClient.synthesizeSpeech({
      input: { text },
      voice: {
        languageCode: "en-US",
        name: "en-US-Studio-O",
        ssmlGender: "FEMALE",
      },
      audioConfig: {
        audioEncoding: "MP3",
        speakingRate: 1.0,
        pitch: 0,
      },
    });

    const filename = `tts-${uuidv4()}.mp3`;

    const dir = path.join(process.cwd(), "public/audio");
    await mkdir(dir, { recursive: true }); // Ensure the directory exists

    const filePath = path.join(dir, filename);
    await writeFile(filePath, response.audioContent as Buffer, "binary");

    return { filename };
  } catch (error) {
    console.error("TTS Error:", error);
    throw new Error("Speech synthesis failed");
  }
}

export async function POST(req: Request) {
  try {
    const startTime = Date.now();
    console.log(req);

    const formDataStart = Date.now();
    const formData = await req.formData();
    console.log(formData);
    console.log(`FormData processing time: ${Date.now() - formDataStart}ms`);

    const audioStart = Date.now();
    const audioBlob = formData.get("audio") as Blob | null;
    console.log("blob: ", audioBlob);
    console.log(`Audio extraction time: ${Date.now() - audioStart}ms`);

    const processStart = Date.now();
    const processedAudio = await processAudio(audioBlob);
    console.log("processedOutput: ", processedAudio);
    console.log(`Audio processing time: ${Date.now() - processStart}ms`);

    const transcriptStart = Date.now();
    const transcript = await generateSTT(processedAudio);
    console.log("transcript: ", transcript);
    console.log(`STT generation time: ${Date.now() - transcriptStart}ms`);

    const responseStart = Date.now();
    const geminiResponse = await fetchGeminiResponse(transcript);
    console.log("llama response: ", geminiResponse);
    console.log(`llama response time: ${Date.now() - responseStart}ms`);

    const ttsStart = Date.now();
    const ttsAudio = await generateTTS(geminiResponse);
    console.log("tts audio: ", ttsAudio);
    console.log(`TTS generation time: ${Date.now() - ttsStart}ms`);

    console.log(`Total time: ${Date.now() - startTime}ms`);

    return NextResponse.json({
      text: geminiResponse,
      audio: `/audio/${ttsAudio.filename}`,
    });
  } catch (error) {
    return NextResponse.json({ err: error }, { status: 500 });
  }
}
