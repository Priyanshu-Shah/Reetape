import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<Response> {
  try {
    const startTime = Date.now();
    console.log("== TTS Stream Request Started ==");
    
    // Parse request body
    const bodyStart = Date.now();
    const body = await req.json();
    const text = body.text;
    console.log(`Request body parsed in ${Date.now() - bodyStart}ms`);
    
    if (!text) {
      console.error("Missing text parameter");
      return NextResponse.json({ error: "Missing text parameter" }, { status: 400 });
    }

    const textLength = text.length;
    console.log(`Processing TTS request for text of length: ${textLength} characters`);

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      console.error("ELEVENLABS_API_KEY is not defined");
      return NextResponse.json({ error: "ELEVENLABS_API_KEY is not defined" }, { status: 500 });
    }

    // Default to "Rachel" voice
    const voiceId = body.voiceId || "21m00Tcm4TlvDq8ikWAM";
    console.log(`Using voice ID: ${voiceId}`);
    
    // Call ElevenLabs streaming API
    const apiCallStart = Date.now();
    console.log("Requesting streaming TTS from ElevenLabs...");
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
    const apiCallTime = Date.now() - apiCallStart;
    console.log(`✓ ElevenLabs API initial response received in ${apiCallTime}ms`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("ElevenLabs API Error:", response.status, errorText);
      return NextResponse.json(
        { error: `ElevenLabs TTS Error: ${errorText}` }, 
        { status: response.status }
      );
    }
    
    // Calculate expected audio length (rough estimate: ~3 chars per second for English)
    const estimatedAudioSeconds = Math.round(text.length / 15);
    console.log(`Estimated audio length: ~${estimatedAudioSeconds} seconds`);

    // Forward the streaming response directly to the client
    console.log(`Total setup time before streaming: ${Date.now() - startTime}ms`);
    console.log("Starting audio stream to client...");
    
    // Return a streaming response
    return new Response(response.body, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Transfer-Encoding': 'chunked',
        'X-Processing-Time': `${Date.now() - startTime}`,
        'X-Text-Length': `${textLength}`,
        'X-Estimated-Audio-Length': `${estimatedAudioSeconds}`
      },
    });
    
  } catch (error) {
    console.error("TTS Stream Error:", error);
    return NextResponse.json({ 
      error: "Error generating speech",
      message: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}