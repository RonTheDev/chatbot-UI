import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import "./index.css";

interface Message {
  sender: "user" | "bot";
  text: string;
}

const FLASK_SERVER_URL = "https://flask-voice-server.onrender.com"; // ✅ your Flask URL

export default function Chatbot() {
  const [messages, setMessages] = useState<Message[]>([
    { sender: "bot", text: "ברוך הבא, איך אפשר לעזור?" },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    window.speechSynthesis.getVoices(); // preload voices
  }, []);

  const startListening = () => {
    const SpeechRecognition =
      (window as any).webkitSpeechRecognition ||
      (window as any).SpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = "he-IL";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = async (event: any) => {
      const transcript = event.results[0][0].transcript;
      console.log("🎙️ User said:", transcript);

      // ✅ Add user transcript to chat
      setMessages((prev) => [...prev, { sender: "user", text: transcript }]);

      try {
        const response = await fetch(`${FLASK_SERVER_URL}/speak`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: transcript }),
        });

        if (!response.ok) throw new Error("TTS Request failed");

        // ✅ Extract audio + bot reply text
        const blob = await response.blob();
        const audioUrl = URL.createObjectURL(blob);
        const botReply = response.headers.get("X-Bot-Reply") || "";

        const audio = new Audio(audioUrl);
        audio.play();

        // ✅ Add bot reply to chat
        setMessages((prev) => [...prev, { sender: "bot", text: botReply }]);

        // ✅ Loop after speaking
        audio.onended = () => {
          if (isVoiceMode) {
            setTimeout(() => startListening(), 300);
          }
        };
      } catch (err) {
        console.error("TTS Error:", err);
        setMessages((prev) => [
          ...prev,
          { sender: "bot", text: "מצטער, הייתה שגיאה בהשמעת קול." },
        ]);
        if (isVoiceMode) {
          setTimeout(() => startListening(), 1500);
        }
      }
    };

    recognition.onerror = () => {
      if (isVoiceMode) {
        setTimeout(() => startListening(), 1000);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    setIsListening(true);
    recognition.start();
  };

  const handleMicToggle = () => {
    const newState = !isVoiceMode;
    setIsVoiceMode(newState);

    if (newState) {
      startListening();
    } else {
      recognitionRef.current?.stop();
      window.speechSynthesis.cancel();
      setIsListening(false);
    }
  };

  const handleSend = () => {
    if (!input.trim()) return;
    const newMessage: Message = { sender: "user", text: input };
    setMessages((prev) => [...prev, newMessage]);
    setInput("");
    setIsTyping(true);

    setTimeout(() => {
      const botMessage: Message = {
        sender: "bot",
        text: "הבוט עונה בהודעה כתובה :)",
      };
      setMessages((prev) => [...prev, botMessage]);
      setIsTyping(false);
    }, 1000);
  };

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-[#0c0f1a] text-white flex flex-col items-center justify-center p-4 font-sans relative"
    >
      {/* 🔊 Glow Overlay in Voice Mode */}
      {isVoiceMode && (
        <div className="absolute inset-0 z-40 flex items-center justify-center">
          <div className="voice-pulse-circle"></div>
        </div>
      )}

      {/* 💬 Chat Container */}
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

          {!isVoiceMode && isTyping && (
            <div className="text-sm text-gray-400 mt-2">...הבוט מקליד</div>
          )}
        </div>

        {/* ✏️ Text Input */}
        {!isVoiceMode && (
          <div className="p-3 border-t border-gray-700 bg-gray-800 flex items-center gap-2">
            <input
              type="text"
              className="flex-1 bg-gray-700 text-white p-2 rounded-xl outline-none text-right"
              placeholder="כתוב את ההודעה שלך..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
            />
            <button
              onClick={handleSend}
              className="px-4 py-2 bg-green-600 rounded-xl hover:bg-green-500 transition"
            >
              שלח
            </button>
          </div>
        )}
      </div>

      {/* 🎤 Mic Toggle */}
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
