'use client';
import { useState } from 'react';
import MicButton from '@/app/components/MicButton';
//import startRecording from '@/app/components/MicButton';

export default function HomePage() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // const handleAudioData = async (blob: Blob) => {
  //   setIsProcessing(true);
  //   setError(null);
  //   try {
  //     const formData = new FormData();
  //     formData.append('audio', blob, 'recording.wav');

  //     console.log('form created: ', blob);
      
  //     const response = await fetch('/api/chat', {
  //       method: 'POST',
  //       body: formData
  //     });

  //     console.log(response);
  
  //     if (!response.ok) {
  //       throw new Error('Failed to fetch response from server');
  //     }
  
  //     const { audio } = await response.json();

  //     if (audio) {
  //       new Audio(audio).play();
  //       startRecording();
  //     } else {
  //       throw new Error('No audio URL received');
  //     }

  //   } catch (error) {
  //     console.error('Error in handleAudioData:', error);
  //     setError('An error occurred. Please try again.');
  //   } finally {
  //     setIsProcessing(false);
  //   }
  // };

  const handleAudioData = async (blob: Blob) => {
    setIsProcessing(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('audio', blob, 'recording.wav');
  
      console.log('form created: ', blob);
      
      const response = await fetch('/api/chat', {
        method: 'POST',
        body: formData
      });
  
      console.log(response);
  
      if (!response.ok) {
        throw new Error('Failed to fetch response from server');
      }
  
      const { audio } = await response.json();
  
      if (audio) {
        const audioPlayer = new Audio(audio);
        audioPlayer.onended = () => {
          console.log('Audio playback finished. Starting recording...');
        };
  
        audioPlayer.play();
      } else {
        throw new Error('No audio URL received');
      }
  
    } catch (error) {
      console.error('Error in handleAudioData:', error);
      setError('An error occurred. Please try again.');
    } finally {
      setIsProcessing(false);
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
          <MicButton onRecordingComplete={handleAudioData} />
        </div>
        {isProcessing && <p className="mt-4 text-blue-300">Processing your request...</p>}
        {error && <p className="mt-4 text-red-400">{error}</p>}
      </div>
    </main>
  );
}
