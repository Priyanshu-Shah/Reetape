'use client';
import MicButton from '@/app/components/MicButton';
import { initializeVoiceStream } from '@/app/audio/webrtc';
import { useEffect, useRef } from 'react';

export default function HomePage() {
  const peerConnection = useRef<RTCPeerConnection | null>(null);

  useEffect(() => {
    const init = async () => {
      const { peerConnection: pc } = await initializeVoiceStream();
      peerConnection.current = pc;
    };
    init();
  }, []);

  const handleAudioData = async (blob: Blob) => {
    try {
      const formData = new FormData();
      formData.append('audio', blob, 'recording.wav');
  
      const response = await fetch('/api/chat/route', {
        method: 'POST',
        body: formData
      });
  
      if (!response.ok) {
        throw new Error('Failed to fetch response from server');
      }
  
      const { audio } = await response.json();

      if (audio) {
        new Audio(audio).play();
      } else {
        console.error('No audio URL received');
      }
    } catch (error) {
      console.error('Error in handleAudioData:', error);
    }
  };
  

  return (
    <main className="flex items-center justify-center h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-700 text-white p-10">
      <div className="w-full max-w-md bg-white/10 backdrop-blur-md p-8 rounded-xl shadow-lg border border-white/20 text-center">
        <h1 className="text-3xl font-bold tracking-wide text-white">
          Reetape AI Customer Support
        </h1>
        <p className="text-gray-300 mt-2">
          Speak to get instant AI-powered assistance.
        </p>
        <div className="mt-6">
          <MicButton StartRecording={handleAudioData} />
        </div>
      </div>
    </main>
  );
}
