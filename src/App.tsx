import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import "./index.css";

interface Message {
  sender: "user" | "bot";
  text: string;
}

const FLASK_SERVER_URL = "https://flask-voice-server.onrender.com";

export default function Chatbot() {
  const [messages, setMessages] = useState<Message[]>([
    { sender: "bot", text: "ברוך הבא, איך אפשר לעזור?" },
  ]);
  const [inputText, setInputText] = useState("");
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const voiceLoopRef = useRef<boolean>(false);

  // Monitor voice mode state
  useEffect(() => {
    voiceLoopRef.current = isVoiceMode;
    
    // Clean up function to handle component unmount or voice mode deactivation
    return () => {
      cleanupVoiceResources();
    };
  }, [isVoiceMode]);

  const cleanupVoiceResources = () => {
    // Stop any ongoing recording
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    
    // Stop the audio stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    // Stop any playing audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    
    setIsListening(false);
    setIsProcessing(false);
  };

  const handleTextSubmit = async () => {
    if (!inputText.trim()) return;
    const userText = inputText.trim();
    setInputText("");
    setMessages((prev) => [...prev, { sender: "user", text: userText }]);

    try {
      const res = await fetch(`${FLASK_SERVER_URL}/text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: userText }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, { sender: "bot", text: data.reply }]);
    } catch (err) {
      console.error("Text request error:", err);
    }
  };

  const startVoiceLoop = async () => {
    if (!voiceLoopRef.current) return;
    
    setIsListening(true);
    setIsProcessing(false);
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        if (!voiceLoopRef.current) return;
        
        setIsListening(false);
        setIsProcessing(true);
        
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        });

        // Clean up audio chunks
        audioChunksRef.current = [];

        const formData = new FormData();
        formData.append("audio", audioBlob, "recording.webm");

        try {
          // Step 1: Send audio for transcription
          const res = await fetch(`${FLASK_SERVER_URL}/transcribe`, {
            method: "POST",
            body: formData,
          });
          
          if (!res.ok) {
            throw new Error(`Transcription failed with status: ${res.status}`);
          }
          
          const data = await res.json();
          const userText = data.transcription.trim();

          if (!userText) {
            throw new Error("Empty transcription received");
          }

          // Step 2: Add user message to chat
          setMessages((prev) => [...prev, { sender: "user", text: userText }]);

          // Step 3: Get response and audio in one go (optimized backend endpoint)
          const voiceRes = await fetch(`${FLASK_SERVER_URL}/voice-response`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: userText }),
          });

          if (!voiceRes.ok) {
            throw new Error(`Voice response failed with status: ${voiceRes.status}`);
          }

          const audioData = await voiceRes.blob();
          const responseTextHeader = voiceRes.headers.get('X-Response-Text');
          
          // Add bot message with the text response
          if (responseTextHeader) {
            setMessages((prev) => [
              ...prev,
              { sender: "bot", text: responseTextHeader },
            ]);
          } else {
            setMessages((prev) => [
              ...prev,
              { sender: "bot", text: "(🔊 קול הופעל)" },
            ]);
          }

          // Play the audio response
          const audioURL = URL.createObjectURL(audioData);
          const audio = new Audio(audioURL);
          audioRef.current = audio;
          
          // Set up multiple ways to detect audio completion for better reliability
          return new Promise<void>((resolve) => {
            let hasResolved = false;
            
            const finishPlayback = () => {
              if (!hasResolved) {
                hasResolved = true;
                resolve();
                URL.revokeObjectURL(audioURL);
              }
            };
            
            // Method 1: onended event
            audio.onended = finishPlayback;
            
            // Method 2: ontimeupdate as backup
            audio.ontimeupdate = () => {
              if (audio.currentTime > 0 && audio.currentTime >= audio.duration - 0.1) {
                finishPlayback();
              }
            };
            
            // Method 3: Fallback timer based on audio duration
            audio.onloadedmetadata = () => {
              const duration = audio.duration * 1000 + 500; // Duration in ms plus buffer
              setTimeout(finishPlayback, duration);
            };
            
            // Method 4: Absolute fallback
            setTimeout(finishPlayback, 10000); // 10 second absolute maximum
            
            // Start playing
            audio.play().catch(err => {
              console.error("Audio playback error:", err);
              finishPlayback();
            });
          });
        } catch (err) {
          console.error("Voice flow error:", err);
          setMessages((prev) => [
            ...prev,
            { sender: "bot", text: "שגיאה בזיהוי קול או השמעה." },
          ]);
        } finally {
          // Wait a moment before starting the next loop
          if (voiceLoopRef.current) {
            setIsProcessing(false);
            setTimeout(startVoiceLoop, 500);
          }
        }
      };

      mediaRecorder.start();

      // Silence detection to automatically stop recording
      const silenceThreshold = 5;
      let silenceStart: number | null = null;
      const silenceDuration = 2000; // 2 seconds of silence

      const checkSilence = () => {
        if (!voiceLoopRef.current || mediaRecorder.state !== "recording") return;
        
        analyser.getByteTimeDomainData(dataArray);
        const maxAmplitude = Math.max(
          ...dataArray.map((v) => Math.abs(v - 128))
        );

        const now = Date.now();
        
        if (maxAmplitude < silenceThreshold) {
          // Start counting silence if not already
          if (silenceStart === null) {
            silenceStart = now;
          } else if (now - silenceStart >= silenceDuration) {
            // Stop recording after silence duration
            if (mediaRecorder.state === "recording") {
              mediaRecorder.stop();
              audioContext.close();
              return; // Exit the loop
            }
          }
        } else {
          // Reset silence counter on sound
          silenceStart = null;
        }
        
        // Continue checking
        requestAnimationFrame(checkSilence);
      };

      checkSilence();
    } catch (err) {
      console.error("Mic error:", err);
      setIsListening(false);
      setIsProcessing(false);
      
      // Try to restart after error
      if (voiceLoopRef.current) {
        setTimeout(startVoiceLoop, 2000);
      }
    }
  };

  const toggleVoiceMode = () => {
    const newState = !isVoiceMode;
    setIsVoiceMode(newState);

    if (newState) {
      voiceLoopRef.current = true;
      startVoiceLoop();
    } else {
      voiceLoopRef.current = false;
      cleanupVoiceResources();
    }
  };

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-[#0c0f1a] text-white flex flex-col items-center justify-center p-4 font-sans relative"
    >
      {isVoiceMode && (
        <div className="absolute inset-0 z-40 flex items-center justify-center">
          {isListening ? (
            <div className="voice-pulse-circle"></div>
          ) : isProcessing ? (
            <div className="processing-indicator">מעבד...</div>
          ) : null}
        </div>
      )}

      <div className="w-full max-w-md h-[600px] bg-gray-800 rounded-2xl shadow-xl flex flex-col overflow-hidden z-10">
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex items-end ${
                msg.sender === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className={`p-3 rounded-2xl max-w-xs text-right whitespace-pre-line ${
                  msg.sender === "user"
                    ? "bg-blue-600 text-white self-end"
                    : "bg-gray-700 text-white self-start"
                }`}
              >
                {msg.text}
              </motion.div>
            </div>
          ))}
        </div>

        {!isVoiceMode && (
          <div className="flex p-2 border-t border-gray-700">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleTextSubmit()}
              placeholder="כתוב הודעה..."
              className="flex-1 bg-gray-900 text-white px-4 py-2 rounded-l-xl focus:outline-none"
            />
            <button
              onClick={handleTextSubmit}
              className="bg-blue-600 hover:bg-blue-500 px-4 rounded-r-xl"
            >
              שלח
            </button>
          </div>
        )}
      </div>

      <button
        onClick={toggleVoiceMode}
        className={`fixed bottom-8 right-8 w-14 h-14 z-50 rounded-full text-white text-2xl font-bold shadow-lg transition ${
          isVoiceMode
            ? "bg-green-600 animate-pulse-glow"
            : "bg-red-600 hover:bg-red-500"
        }`}
        title="הפעל / כבה מצב קולי"
      >
        🎤
      </button>
    </div>
  );
}
