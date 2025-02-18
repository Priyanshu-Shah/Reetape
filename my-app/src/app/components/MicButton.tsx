// app/components/MicButton.tsx
'use client';
import { useEffect, useRef, useState } from 'react';

export default function MicButton() {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const silenceDetectionTimeout = useRef<NodeJS.Timeout | null>(null);

  // Initialize audio context and analyzer
  useEffect(() => {
    audioContextRef.current = new AudioContext();
    analyserRef.current = audioContextRef.current.createAnalyser();
    analyserRef.current.fftSize = 2048;
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      // Setup audio processing chain
      const source = audioContextRef.current!.createMediaStreamSource(stream);
      source.connect(analyserRef.current!);
      
      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.start(500); // Collect data every 500ms
      setIsRecording(true);
      startSilenceDetection();
    } catch (err) {
      console.error('Error accessing microphone:', err);
    }
  };

  const stopRecording = async () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
      clearTimeout(silenceDetectionTimeout.current!);
      
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
      await processAudio(audioBlob);
    }
  };

  const startSilenceDetection = () => {
    const checkAudioLevel = () => {
      if (!analyserRef.current) return;

      const buffer = new Uint8Array(analyserRef.current.fftSize);
      analyserRef.current.getByteTimeDomainData(buffer);
      
      const sum = buffer.reduce((acc, val) => acc + Math.abs(val - 128), 0);
      const avg = sum / buffer.length;

      if (avg < 5) { // Silence threshold
        if (!silenceDetectionTimeout.current) {
          silenceDetectionTimeout.current = setTimeout(() => {
            stopRecording();
          }, 1500); // 1.5 seconds of silence
        }
      } else {
        clearTimeout(silenceDetectionTimeout.current!);
        silenceDetectionTimeout.current = null;
      }

      requestAnimationFrame(checkAudioLevel);
    };
    
    checkAudioLevel();
  };

  const processAudio = async (audioBlob: Blob) => {
    try {
      // Send audio to backend
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.wav');

      const response = await fetch('/api/chat/gemini', {
        method: 'POST',
        body: formData
      });

      const { audio: ttsAudio} = await response.json();
      console.log(ttsAudio);
      
      // Play response audio
      const audioBuffer = await audioBlob.arrayBuffer();
      const audioContext = new AudioContext();
      const source = audioContext.createBufferSource();
      source.buffer = await audioContext.decodeAudioData(audioBuffer);
      source.connect(audioContext.destination);
      source.start(0);
    } catch (error) {
      console.error('Audio processing error:', error);
    }
  };

  return (
    <div className="mic-container">
      <button 
        className={`mic-button ${isRecording ? 'recording' : ''}`}
        onClick={isRecording ? stopRecording : startRecording}
      >
        🎤
      </button>
      <p className="status-indicator">
        {isRecording ? 'Recording...' : 'Click to start conversation'}
      </p>
      <style jsx>{`
        .mic-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
        }
        
        .mic-button {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          border: none;
          background: #e0e0e0;
          cursor: pointer;
          transition: all 0.2s;
          font-size: 24px;
        }

        .mic-button.recording {
          background: #ff4444;
          animation: pulse 1.5s infinite;
        }

        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); }
        }

        .status-indicator {
          color: #666;
          font-size: 0.9rem;
        }
      `}</style>
    </div>
  );
}
