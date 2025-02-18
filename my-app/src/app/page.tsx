'use client';
import MicButton from '@/app/components/MicButton';
//import { initializeVoiceStream } from '@/app/audio/webrtc';

export default function HomePage() {

  // useEffect(() => {
  //   const init = async () => {
  //     const { peerConnection: pc } = await initializeVoiceStream();
  //     peerConnection.current = pc;
  //   };
  //   init();
  // }, []);

  // const handleAudioData = async (blob: Blob) => {
  //   const response = await fetch('/api/chat', {
  //     method: 'POST',
  //     body: blob
  //   });
    
  //   const {text, audio } = await response.json();
  //   // Play TTS audio
  //   console.log(text);
  //   new Audio(audio).play();
  // };

  return (
    <main>
      <div className="w-full h-screen bg-zinc-900 text-white p-10">
        <h1>Reetape AI Customer Support</h1>
        <br />
        <MicButton 
        // StartRecording = {() => audioContext.current?.resume()}
        // StartRecording = {handleAudioData}
        />
      </div>
    </main>
  );
}
