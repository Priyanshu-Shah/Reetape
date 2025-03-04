// app/components/MicButton.tsx
'use client';
import { useEffect, useRef, useState} from 'react';

interface MicButtonProps {
  onRecordingComplete: (blob: Blob) => void;
}

export default function MicButton({ onRecordingComplete }: MicButtonProps) {
  let Recording = false;
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const silenceDetectionTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    console.log('Initializing AudioContext and AnalyserNode...');
    audioContextRef.current = new AudioContext();
    analyserRef.current = audioContextRef.current.createAnalyser();
    analyserRef.current.fftSize = 2048; // Set FFT size for frequency analysis
    console.log('AudioContext and AnalyserNode initialized:', analyserRef.current);
  }, []);  

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      const source = audioContextRef.current!.createMediaStreamSource(stream);
      source.connect(analyserRef.current!);
      
      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.start(500);
      Recording = true;
      setIsRecording(true);
      startSilenceDetection();
    } catch (err) {
      console.error('Error accessing microphone:', err);
      alert('Failed to access microphone. Please check your permissions.');
    }
  };

  const stopRecording = async () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      Recording = false;
      setIsRecording(false);
  
      if (silenceDetectionTimeout.current) {
        clearTimeout(silenceDetectionTimeout.current);
        silenceDetectionTimeout.current = null;
      }
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
      onRecordingComplete(audioBlob);
    }
  };

  const startSilenceDetection = () => {
    console.log('entered silence detection');
    
    const checkAudioLevel = () => {
      if (!analyserRef.current || !Recording) {
        console.log('Analyser node not initialized or recording stopped', analyserRef.current, Recording);
        return;
      }
  
      const buffer = new Uint8Array(analyserRef.current.fftSize);
      analyserRef.current.getByteTimeDomainData(buffer);
  
      const sum = buffer.reduce((acc, val) => acc + Math.abs(val - 128), 0);
      const avg = sum / buffer.length;
  
      if (avg < 25) {
        if (!silenceDetectionTimeout.current) {
          silenceDetectionTimeout.current = setTimeout(() => {
            stopRecording();
          }, 3000);
        }
      } else {
        clearTimeout(silenceDetectionTimeout.current!);
        silenceDetectionTimeout.current = null;
      }
      requestAnimationFrame(checkAudioLevel);
    };
  
    checkAudioLevel();
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