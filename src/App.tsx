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
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const startListening = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

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
        const formData = new FormData();
        formData.append("audio", audioBlob, "input.webm");

        console.log("🎙️ Sending audio to server...");

        try {
          const response = await fetch(`${FLASK_SERVER_URL}/transcribe`, {
            method: "POST",
            body: formData,
          });

          const result = await response.json();
          const transcript = result.transcription || "";

          if (!transcript) throw new Error("No transcription received");

          setMessages((prev) => [
            ...prev,
            { sender: "user", text: transcript },
          ]);

          const ttsRes = await fetch(`${FLASK_SERVER_URL}/speak`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: transcript }),
          });

          const ttsBlob = await ttsRes.blob();
          const audioUrl = URL.createObjectURL(ttsBlob);
          const audio = new Audio(audioUrl);

          setMessages((prev) => [
            ...prev,
            { sender: "bot", text: "(🔊 קול הופעל על ידי OpenAI TTS)" },
          ]);

          audio.onended = () => {
            console.log("🔁 Finished speaking, restarting loop");
            if (isVoiceMode) startListening(); // loop
          };

          audio.onerror = (e) => {
            console.error("Audio error", e);
            if (isVoiceMode) setTimeout(() => startListening(), 1000);
          };

          audio.play();
        } catch (err) {
          console.error("Voice flow error:", err);
          setMessages((prev) => [
            ...prev,
            { sender: "bot", text: "מצטער, הייתה שגיאה בתהליך השמע." },
          ]);
          if (isVoiceMode) setTimeout(() => startListening(), 1000);
        }
      };

      setIsListening(true);
      mediaRecorder.start();

      setTimeout(() => {
        if (mediaRecorder.state !== "inactive") {
          mediaRecorder.stop();
        }
      }, 4000); // listen for 4 seconds
    } catch (err) {
      console.error("🎤 Mic error:", err);
      setIsListening(false);
    }
  };

  const handleMicToggle = () => {
    const newState = !isVoiceMode;
    setIsVoiceMode(newState);

    if (newState) {
      console.log("🎤 Voice mode ON");
      startListening();
    } else {
      console.log("❌ Voice mode OFF");
      mediaRecorderRef.current?.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      setIsListening(false);
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
            messages.map((msg, index) => (
              <div
                key={index}
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
        onClick={handleMicToggle}
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
