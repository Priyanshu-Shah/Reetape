import { NextResponse } from 'next/server';
import { processAudio } from '@/app/audio/processor';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const audioBlob = formData.get('audio') as Blob | null;
    const audioWAV = await processAudio(audioBlob);
    const transcript = await generateSTT(audioWAV)
    const geminiResponse = await GeminiResponse(transcript);
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
