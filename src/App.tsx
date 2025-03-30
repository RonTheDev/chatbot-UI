import { useState, useEffect, useRef } from "react";
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
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    window.speechSynthesis.getVoices();
  }, []);

  const startVoiceLoop = async () => {
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
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        });
        console.log("🎙️ Sending audio to server...");
        const formData = new FormData();
        formData.append("audio", audioBlob, "recording.webm");

        try {
          const res = await fetch(`${FLASK_SERVER_URL}/transcribe`, {
            method: "POST",
            body: formData,
          });
          const data = await res.json();
          if (!data.transcription) throw new Error("No transcription received");

          const userText = data.transcription.trim();
          setMessages((prev) => [...prev, { sender: "user", text: userText }]);

          const ttsRes = await fetch(`${FLASK_SERVER_URL}/speak`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: userText }),
          });

          const audioData = await ttsRes.blob();
          const audioURL = URL.createObjectURL(audioData);
          const audio = new Audio(audioURL);

          setMessages((prev) => [
            ...prev,
            { sender: "bot", text: "(🔊 קול הופעל על ידי OpenAI TTS)" },
          ]);

          audio.onended = () => {
            console.log("🔁 Finished speaking, restarting loop");
            if (isVoiceMode) startVoiceLoop();
          };

          audio.play();
        } catch (err) {
          console.error("Voice flow error:", err);
          setMessages((prev) => [
            ...prev,
            { sender: "bot", text: "שגיאה בזיהוי קול או השמעה." },
          ]);
          if (isVoiceMode) setTimeout(startVoiceLoop, 1000);
        }
      };

      mediaRecorder.start();

      // Silence detection loop
      const checkSilence = () => {
        analyser.getByteTimeDomainData(dataArray);
        const maxAmplitude = Math.max(
          ...dataArray.map((v) => Math.abs(v - 128))
        );

        if (maxAmplitude < 5) {
          if (!silenceTimerRef.current) {
            silenceTimerRef.current = setTimeout(() => {
              mediaRecorder.stop();
              audioContext.close();
            }, 2000); // 2 sec silence = stop
          }
        } else {
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
          }
        }

        if (mediaRecorder.state === "recording") {
          requestAnimationFrame(checkSilence);
        }
      };

      checkSilence();
    } catch (err) {
      console.error("🎤 Mic error:", err);
    }
  };

  const toggleVoiceMode = () => {
    const newState = !isVoiceMode;
    setIsVoiceMode(newState);
    console.log(newState ? "🎤 Voice mode ON" : "❌ Voice mode OFF");

    if (newState) {
      startVoiceLoop();
    } else {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    }
  };

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-[#0c0f1a] text-white flex flex-col items-center justify-center p-4 font-sans relative"
    >
      {isVoiceMode && (
        <div className="absolute inset-0 z-40 flex items-center justify-center">
          <div className="voice-pulse-circle"></div>
        </div>
      )}

      <div className="w-full max-w-md h-[600px] bg-gray-800 rounded-2xl shadow-xl flex flex-col overflow-hidden z-10">
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {!isVoiceMode &&
            messages.map((msg, i) => (
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
