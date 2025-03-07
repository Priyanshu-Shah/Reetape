import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<Response> {
  try {
    const body = await req.json();
    const text = body.text;
    
    if (!text) {
      return NextResponse.json({ error: "Missing text parameter" }, { status: 400 });
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "ELEVENLABS_API_KEY is not defined" }, { status: 500 });
    }

    // Default to "Rachel" voice
    const voiceId = body.voiceId || "21m00Tcm4TlvDq8ikWAM";
    
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
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("ElevenLabs API Error:", response.status, errorText);
      return NextResponse.json(
        { error: `ElevenLabs TTS Error: ${errorText}` }, 
        { status: response.status }
      );
    }

    // Forward the streaming response directly to the client
    return new Response(response.body, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Transfer-Encoding': 'chunked'
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