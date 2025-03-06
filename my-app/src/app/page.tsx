'use client'
import { useState, useRef, useEffect } from 'react';
import { FaMicrophone, FaStop, FaVolumeUp } from "react-icons/fa";

// Simple toast notification
interface ToastProps {
  message: string;
  type: string;
  onClose: () => void;
}

const Toast = ({ message, type, onClose }: ToastProps) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 5000);
    
    return () => clearTimeout(timer);
  }, [onClose]);
  
  return (
    <div className={`toast ${type}`}>
      <div className="toast-message">{message}</div>
      <button onClick={onClose} className="toast-close">×</button>
      
      <style jsx>{`
        .toast {
          position: fixed;
          bottom: 20px;
          right: 20px;
          padding: 12px 16px;
          border-radius: 4px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
          display: flex;
          align-items: center;
          justify-content: space-between;
          min-width: 300px;
          z-index: 1000;
        }
        .error {
          background-color: #ffebee;
          color: #c62828;
          border-left: 4px solid #c62828;
        }
        .info {
          background-color: #e3f2fd;
          color: #0277bd;
          border-left: 4px solid #0277bd;
        }
        .toast-close {
          background: none;
          border: none;
          font-size: 20px;
          cursor: pointer;
          margin-left: 16px;
          color: inherit;
        }
      `}</style>
    </div>
  );
};

export default function Home() {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [response, setResponse] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: string } | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    audioPlayerRef.current = new Audio();
    
    audioPlayerRef.current.onplay = () => setIsAudioPlaying(true);
    audioPlayerRef.current.onended = () => setIsAudioPlaying(false);
    audioPlayerRef.current.onerror = () => {
      setIsAudioPlaying(false);
      showToast("Error playing audio response", "error");
    };
    
    return () => {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current.src = '';
      }
    };
  }, []);
  
  const showToast = (message: string, type: string) => {
    setToast({ message, type });
  };

  const dismissToast = () => {
    setToast(null);
  };

  const toggleRecording = async () => {
    if (isRecording) {
      stopRecording();
    } else {
      await startRecording();
    }
  };

  const startRecording = async () => {
    try {
      setError(null);
      setResponse("");
      audioChunksRef.current = [];
      
      // Stop any playing audio
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current.src = '';
        setIsAudioPlaying(false);
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Use higher audio quality for better PlayHT speech recognition
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: 128000
      });
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        processAudioInput();
      };
      
      mediaRecorder.start();
      setIsRecording(true);
      
      console.log('Recording started');
    } catch (err) {
      console.error('Error starting recording:', err);
      setError('Error accessing microphone. Please ensure you have granted permission.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      // Stop all tracks in the stream
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      console.log('Recording stopped');
    }
  };

  const processAudioInput = async () => {
    try {
      setIsProcessing(true);
      
      // PlayHT works well with webm format
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      console.log('Audio blob created:', audioBlob.size, 'bytes');
      
      const formData = new FormData();
      formData.append('audio', audioBlob);
      
      console.log('Sending request to server...');
      const response = await fetch('/api/chat', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Server error: ${response.status} - ${errorData}`);
      }
      
      const data = await response.json();
      handleResponseData(data);
    } catch (err) {
      console.error('Error processing audio:', err);
      setError('Failed to process your voice. Please try again.');
      setIsProcessing(false);
    }
  };

  const handleResponseData = (data: { text: string; audio: string }) => {
    try {
      if (data.audio) {
        console.log('Audio response received:', data.audio);
        setResponse(data.text);
        
        if (audioPlayerRef.current) {
          // Create a timestamped URL to avoid browser caching
          const timestampedUrl = `${data.audio}?timestamp=${new Date().getTime()}`;
          audioPlayerRef.current.src = timestampedUrl;
          
          // PlayHT returns mp3 files, ensure audio element can play them
          audioPlayerRef.current.play().catch(error => {
            console.warn('Autoplay prevented:', error);
            showToast("Audio ready. Click to play.", "info");
          });
        }
      } else {
        throw new Error('No audio URL received');
      }
    } catch (error) {
      console.error('Error in handleResponseData:', error);
      setError('Error processing response. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const playAudioAgain = () => {
    if (audioPlayerRef.current && audioPlayerRef.current.src) {
      audioPlayerRef.current.currentTime = 0;
      audioPlayerRef.current.play().catch(err => {
        console.error('Error playing audio:', err);
      });
    }
  };

  return (
    <div className="container">
      <h1 className="title">Voice Assistant</h1>
      
      <div className={`response-box ${isRecording ? 'recording' : ''}`}>
        {response ? (
          <div className="response-content">
            <h3>Response:</h3>
            <p>{response}</p>
            {!isAudioPlaying && (
              <button className="play-button" onClick={playAudioAgain}>
                <FaVolumeUp /> Play Audio Again
              </button>
            )}
          </div>
        ) : (
          <p className="placeholder">
            {isRecording 
              ? "I'm listening... Click stop when done speaking." 
              : isProcessing 
                ? "Processing your request..." 
                : "Click the microphone button to ask me something."}
          </p>
        )}
        
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}
      </div>
      
      <div className="controls">
        <button 
          className={`record-button ${isRecording ? 'recording' : ''}`}
          onClick={toggleRecording}
          disabled={isProcessing}
        >
          {isRecording ? <><FaStop /> Stop</> : <><FaMicrophone /> Start Recording</>}
        </button>
        
        {isProcessing && <div className="spinner"></div>}
      </div>
      
      <p className="hint">Speak clearly into your microphone, and I'll respond when you're done.</p>
      
      {toast && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={dismissToast} 
        />
      )}

      <style jsx>{`
        .container {
          max-width: 800px;
          margin: 0 auto;
          padding: 2rem;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        }
        
        .title {
          font-size: 2.5rem;
          text-align: center;
          margin-bottom: 2rem;
          color: #333;
        }
        
        .response-box {
          border: 1px solid #ddd;
          border-radius: 8px;
          padding: 1.5rem;
          min-height: 200px;
          margin-bottom: 1.5rem;
          background-color: #fff;
          box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
          transition: background-color 0.2s ease;
        }
        
        .response-box.recording {
          background-color: #ffefef;
        }
        
        .placeholder {
          color: #777;
          text-align: center;
        }
        
        .response-content h3 {
          margin-top: 0;
          color: #333;
          font-size: 1.2rem;
        }
        
        .error-message {
          margin-top: 1rem;
          padding: 0.8rem;
          background-color: #ffebee;
          color: #c62828;
          border-radius: 4px;
          border-left: 4px solid #c62828;
        }
        
        .controls {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 1rem;
          margin-bottom: 1.5rem;
        }
        
        .record-button {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px 24px;
          font-size: 1rem;
          font-weight: 600;
          color: white;
          background-color: #2196f3;
          border: none;
          border-radius: 50px;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        
        .record-button:hover {
          background-color: #1976d2;
        }
        
        .record-button:disabled {
          background-color: #bdbdbd;
          cursor: not-allowed;
        }
        
        .record-button.recording {
          background-color: #f44336;
        }
        
        .record-button.recording:hover {
          background-color: #d32f2f;
        }
        
        .play-button {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          font-size: 0.9rem;
          color: #2196f3;
          background: none;
          border: 1px solid #2196f3;
          border-radius: 4px;
          cursor: pointer;
          margin-top: 1rem;
        }
        
        .play-button:hover {
          background-color: #e3f2fd;
        }
        
        .spinner {
          width: 24px;
          height: 24px;
          border: 3px solid rgba(0, 0, 0, 0.1);
          border-radius: 50%;
          border-top-color: #2196f3;
          animation: spin 1s ease-in-out infinite;
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        
        .hint {
          color: #777;
          font-size: 0.9rem;
          text-align: center;
          margin-top: 0;
        }
      `}</style>
    </div>
  );
}