import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import "./index.css";

interface Message {
  sender: "user" | "bot";
  text: string;
}

const FLASK_SERVER_URL = "https://flask-voice-server.onrender.com";

// URL regex pattern
const URL_PATTERN = /https?:\/\/\S+/g;

// Function to replace URLs with clickable links
const formatMessageWithLinks = (text: string) => {
  const parts = [];
  const urls = text.match(URL_PATTERN) || [];
  let lastIndex = 0;

  if (urls.length === 0) {
    return text;
  }

  urls.forEach((url, i) => {
    const index = text.indexOf(url, lastIndex);
    if (index > lastIndex) {
      parts.push(text.substring(lastIndex, index));
    }
    parts.push(
      <a 
        key={i} 
        href={url} 
        target="_blank" 
        rel="noopener noreferrer"
        className="text-blue-300 underline break-all hover:text-blue-200"
      >
        קישור
      </a>
    );
    lastIndex = index + url.length;
  });

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return <>{parts}</>;
};

export default function Chatbot() {
  const [messages, setMessages] = useState<Message[]>([
    { sender: "bot", text: "ברוך הבא, איך אפשר לעזור?" },
  ]);
  const [inputText, setInputText] = useState("");
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorCount, setErrorCount] = useState(0);
  const [audioPlaybackInProgress, setAudioPlaybackInProgress] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const voiceLoopRef = useRef<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the bottom of messages container whenever messages update
  useEffect(() => {  }
  }, [messages]);

  // Monitor voice mode state
  useEffect(() => {
    console.log("Voice mode changed:", isVoiceMode);
    voiceLoopRef.current = isVoiceMode;
    
    // Reset error count when toggling voice mode
    setErrorCount(0);
    
    // Clean up function to handle component unmount or voice mode deactivation
    return () => {
      cleanupVoiceResources();
    };
  }, [isVoiceMode]);

  const cleanupVoiceResources = () => {
    console.log("Cleaning up voice resources");
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
    setAudioPlaybackInProgress(false);
  };

  const handleTextSubmit = async () => {
    if (!inputText.trim()) return;
    const userText = inputText.trim();
    setInputText("");
    setMessages((prev) => [...prev, { sender: "user", text: userText }]);

    try {
      setIsProcessing(true);
     const res = await fetch(`${FLASK_SERVER_URL}/text-stream`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ prompt: userText }),
});

if (!res.ok || !res.body) {
  throw new Error(`Server returned status: ${res.status}`);
}

const reader = res.body.getReader();
const decoder = new TextDecoder("utf-8");
let botText = "";

setMessages((prev) => [...prev, { sender: "bot", text: "" }]); // Placeholder

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  const chunk = decoder.decode(value, { stream: true });
  botText += chunk;

  setMessages((prev) =>
    prev.map((msg, i) =>
      i === prev.length - 1 && msg.sender === "bot"
        ? { ...msg, text: botText }
        : msg
    )
  );
}

    } catch (err) {
      console.error("Text request error:", err);
      setMessages((prev) => [...prev, { sender: "bot", text: "שגיאה בקבלת תשובה. נסה שוב." }]);
    } finally {
      setIsProcessing(false);
    }
  };

  const startVoiceLoop = async () => {
    if (!voiceLoopRef.current) return;
    
    // Don't start a new recording if audio is playing
    if (audioPlaybackInProgress) {
      console.log("Audio playback in progress, delaying voice loop restart");
      return;
    }
    
    // If we've had too many consecutive errors, exit voice mode
    if (errorCount > 3) {
      setMessages((prev) => [...prev, { 
        sender: "bot", 
        text: "יותר מדי שגיאות ברצף. מצב קולי מושבת." 
      }]);
      setIsVoiceMode(false);
      return;
    }
    
    setIsListening(true);
    setIsProcessing(false);
    
    try {
      console.log("Starting recording...");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        if (!voiceLoopRef.current) return;
        
        console.log("Recording stopped, processing audio...");
        setIsListening(false);
        setIsProcessing(true);
        
        if (audioChunksRef.current.length === 0) {
          console.error("No audio chunks recorded");
          setErrorCount(prev => prev + 1);
          setTimeout(() => startVoiceLoop(), 1000);
          return;
        }
        
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm"
        });

        // Clean up audio chunks
        audioChunksRef.current = [];

        const formData = new FormData();
        formData.append("audio", audioBlob, "recording.webm");

        try {
          // Step 1: Send audio for transcription
          console.log("Sending audio for transcription...");
          const res = await fetch(`${FLASK_SERVER_URL}/transcribe`, {
            method: "POST",
            body: formData,
          });
          
          if (!res.ok) {
            throw new Error(`Transcription failed with status: ${res.status}`);
          }
          
          const data = await res.json();
          console.log("Transcription result:", data);
          
          const userText = data.transcription ? data.transcription.trim() : "";

          if (!userText) {
            console.log("Empty transcription, restarting loop");
            // Don't count empty transcriptions as errors
            setTimeout(() => startVoiceLoop(), 500);
            return;
          }

          // Step 2: Add user message to chat
          setMessages((prev) => [...prev, { sender: "user", text: userText }]);

          // Step 3: Get response and audio in one go
          console.log("Getting voice response...");
          const voiceRes = await fetch(`${FLASK_SERVER_URL}/voice-response`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: userText }),
          });

          if (!voiceRes.ok) {
            throw new Error(`Voice response failed with status: ${voiceRes.status}`);
          }

          // Reset error count on success
          setErrorCount(0);
          
          const audioData = await voiceRes.blob();
          
          // Get the base64 encoded response text header and decode it
          const responseTextB64 = voiceRes.headers.get('X-Response-Text-B64');
          let responseText = "";
          
          if (responseTextB64) {
            try {
              // Decode the base64 header to get the Hebrew text
              responseText = atob(responseTextB64);
              // Convert from binary string to UTF-8
              responseText = new TextDecoder("utf-8").decode(
                new Uint8Array([...responseText].map(c => c.charCodeAt(0)))
              );
            } catch (e) {
              console.error("Failed to decode response text:", e);
              responseText = "(תוכן התשובה לא זמין)";
            }
          }
          
          // Add bot message with the text response
          setMessages((prev) => [
            ...prev,
            { sender: "bot", text: responseText || "(🔊 קול הופעל)" },
          ]);

          // Set flag to prevent new recordings during audio playback
          setAudioPlaybackInProgress(true);

          // Play the audio response
          console.log("Playing audio response...");
          const audioURL = URL.createObjectURL(audioData);
          const audio = new Audio(audioURL);
          audioRef.current = audio;
          
          // Set up multiple ways to detect audio completion for better reliability
          return new Promise<void>((resolve) => {
            let hasResolved = false;
            
            const finishPlayback = () => {
              if (!hasResolved) {
                hasResolved = true;
                setAudioPlaybackInProgress(false);
                resolve();
                URL.revokeObjectURL(audioURL);
                console.log("Audio playback finished");
              }
            };
            
            // Method 1: onended event
            audio.onended = finishPlayback;
            
            // Method 2: ontimeupdate as backup
            audio.ontimeupdate = () => {
              if (audio.currentTime > 0 && audio.duration > 0 && 
                  audio.currentTime >= audio.duration - 0.1) {
                finishPlayback();
              }
            };
            
            // Method 3: Fallback timer based on audio duration
            audio.onloadedmetadata = () => {
              const duration = Math.max(audio.duration * 1000 + 500, 3000);
              setTimeout(finishPlayback, duration);
            };
            
            // Method 4: Absolute fallback with a longer timeout (15s)
            setTimeout(finishPlayback, 15000);
            
            // Method 5: Error handler
            audio.onerror = (e) => {
              console.error("Audio playback error:", e);
              finishPlayback();
            };
            
            // Start playing
            audio.play().catch(err => {
              console.error("Audio play() error:", err);
              finishPlayback();
            });
          }).finally(() => {
            // Continue the voice loop after playback and a small delay
            if (voiceLoopRef.current) {
              console.log("Voice loop continuing...");
              setIsProcessing(false);
              // Add a small delay before starting the next recording
              setTimeout(() => {
                if (voiceLoopRef.current && !audioPlaybackInProgress) {
                  startVoiceLoop();
                }
              }, 800);
            }
          });
        } catch (err) {
          console.error("Voice flow error:", err);
          
          // Increment error count
          setErrorCount(prev => prev + 1);
          
          setMessages((prev) => [
            ...prev,
            { sender: "bot", text: "שגיאה בזיהוי קול או השמעה. מנסה שוב..." },
          ]);
          
          // Try again with backoff
          const backoff = Math.min(errorCount * 1000, 5000);
          if (voiceLoopRef.current) {
            setIsProcessing(false);
            setAudioPlaybackInProgress(false);
            setTimeout(startVoiceLoop, backoff);
          }
        }
      };

      mediaRecorder.start();
      console.log("Media recorder started");

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
              console.log("Silence detected, stopping recording");
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
      setErrorCount(prev => prev + 1);
      
      setMessages((prev) => [
        ...prev,
        { sender: "bot", text: "שגיאה בגישה למיקרופון. מנסה שוב..." },
      ]);
      
      // Try to restart after error with backoff
      const backoff = Math.min(errorCount * 1000, 5000);
      if (voiceLoopRef.current) {
        setAudioPlaybackInProgress(false);
        setTimeout(startVoiceLoop, backoff);
      }
    }
  };

  const toggleVoiceMode = () => {
    const newState = !isVoiceMode;
    setIsVoiceMode(newState);

    if (newState) {
      voiceLoopRef.current = true;
      setErrorCount(0);
      setAudioPlaybackInProgress(false);
      startVoiceLoop();
    } else {
      voiceLoopRef.current = false;
      cleanupVoiceResources();
    }
  };

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-gradient-to-b from-[#0c0f1a] to-[#161b2e] text-white flex flex-col items-center justify-center p-4 font-sans relative"
    >
      {/* Status indicators for voice mode - ONLY CENTER OVERLAY */}
      <AnimatePresence>
        {isVoiceMode && (isListening || isProcessing) && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 flex items-center justify-center"
          >
            {isListening && (
              <div className="flex flex-col items-center">
                <div className="voice-pulse-circle"></div>
                <motion.p 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-lg text-green-400 font-medium mt-6 animate-pulse"
                >
                  מקשיב...
                </motion.p>
              </div>
            )}
            {isProcessing && (
              <div className="flex flex-col items-center">
                <div className="processing-indicator p-8 rounded-full bg-gray-800 bg-opacity-70 shadow-lg">
                  <div className="loading-spinner"></div>
                </div>
                <motion.p 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-lg text-yellow-400 font-medium mt-4"
                >
                  מעבד...
                </motion.p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="w-full max-w-md h-[600px] bg-gray-800 bg-opacity-90 backdrop-blur-sm rounded-2xl shadow-2xl flex flex-col overflow-hidden z-10 border border-gray-700">
        {/* Header - UPDATED TITLE */}
        <div className="p-4 bg-gray-900 border-b border-gray-700 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">תות תקשורת ותוצאות</h2>
        </div>
        
        {/* Messages container */}
       <div
  className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin"
  ref={messagesEndRef}
>
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
                className={`p-3 rounded-2xl max-w-xs text-right break-words shadow-md ${
                  msg.sender === "user"
                    ? "bg-blue-600 text-white self-end"
                    : "bg-gray-700 text-white self-start"
                }`}
              >
                {typeof msg.text === 'string' && msg.text.match(URL_PATTERN) 
                  ? formatMessageWithLinks(msg.text)
                  : msg.text}
              </motion.div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        {!isVoiceMode && (
          <div className="flex p-3 border-t border-gray-700 bg-gray-900">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !isProcessing && handleTextSubmit()}
              placeholder="כתוב הודעה..."
              disabled={isProcessing}
              className="flex-1 bg-gray-800 text-white px-4 py-3 rounded-l-xl focus:outline-none focus:ring-1 focus:ring-blue-500 border border-gray-700"
            />
            <button
              onClick={handleTextSubmit}
              disabled={isProcessing || !inputText.trim()}
              className={`px-5 rounded-r-xl transition-colors duration-200 flex items-center justify-center ${
                isProcessing || !inputText.trim() 
                  ? "bg-gray-600 cursor-not-allowed" 
                  : "bg-blue-600 hover:bg-blue-500"
              }`}
            >
              {isProcessing ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                "שלח"
              )}
            </button>
          </div>
        )}
      </div>

      {/* Voice mode toggle button */}
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={toggleVoiceMode}
        className={`fixed bottom-8 right-8 w-16 h-16 z-50 rounded-full flex items-center justify-center text-white text-2xl font-bold shadow-lg transition-all duration-300 ${
          isVoiceMode
            ? isProcessing 
              ? "bg-yellow-600 animate-pulse"
              : isListening
                ? "bg-green-600 animate-pulse-glow" 
                : "bg-green-600"
            : "bg-red-600 hover:bg-red-500"
        }`}
        title="הפעל / כבה מצב קולי"
      >
        <span className="text-2xl">🎤</span>
      </motion.button>

      {/* REMOVED DUPLICATE STATUS INDICATOR */}
    </div>
  );
}
