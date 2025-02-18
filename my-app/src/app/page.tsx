'use client';
import MicButton from '@/app/components/MicButton';
import { initializeVoiceStream } from '@/app/audio/webrtc';
import { useEffect, useRef } from 'react';

export default function HomePage() {
  const peerConnection = useRef<RTCPeerConnection | null>(null);

  useEffect(() => {
    const init = async () => {
      const { peerConnection: pc } = await initializeVoiceStream();
      peerConnection.current = pc;  // ✅ Now `peerConnection.current` is valid
    };
    init();
  }, []);

  const handleAudioData = async (blob: Blob) => {
    try {
      const formData = new FormData();
      formData.append('audio', blob, 'recording.wav'); // ✅ Wrap Blob inside FormData
  
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
    <main>
      <div className="w-full h-screen bg-zinc-900 text-white p-10">
        <h3>Reetape AI Customer Support</h3>
        <br />
        <MicButton StartRecording={handleAudioData} />
      </div>
    </main>
  );
}
