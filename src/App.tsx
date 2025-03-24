import { useState, useRef } from "react";
import { motion } from "framer-motion";
import "./index.css"; // 👈 Make sure this exists for custom animations (we'll add it if needed)

interface Message {
  sender: "user" | "bot";
  text: string;
}

export default function Chatbot() {
  const [messages, setMessages] = useState<Message[]>([
    { sender: "bot", text: "ברוך הבא, איך אפשר לעזור?" },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);

  const handleSend = () => {
    if (!input.trim()) return;
    const newMessage: Message = { sender: "user", text: input };
    setMessages((prev) => [...prev, newMessage]);
    setInput("");
    setIsTyping(true);

    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        { sender: "bot", text: "חושב על תשובה..." },
      ]);
      setIsTyping(false);
    }, 1000);
  };

  const handleVoiceClick = () => {
    if (!("webkitSpeechRecognition" in window)) {
      alert("דפדפן זה לא תומך בזיהוי קולי. נסה בכרום.");
      return;
    }

    if (!recognitionRef.current) {
      const SpeechRecognition =
        (window as any).webkitSpeechRecognition ||
        (window as any).SpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.lang = "he-IL";
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
      };

      recognition.onerror = (event: any) => {
        console.error("Voice error:", event.error);
        alert("אירעה שגיאה בזיהוי הקולי");
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
    }

    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      recognitionRef.current.start();
      setIsRecording(true);
    }
  };

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-[#0c0f1a] text-white flex flex-col items-center justify-center p-4 font-sans"
    >
      <div className="w-full max-w-md h-[600px] bg-gray-800 rounded-2xl shadow-xl flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`flex items-end ${
                msg.sender === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {msg.sender === "bot" && (
                <img
                  src="https://i.ibb.co/HC5ZPgD/bot-icon.png"
                  alt="Bot"
                  className="w-8 h-8 rounded-full ml-2"
                />
              )}
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
              {msg.sender === "user" && (
                <img
                  src="https://i.ibb.co/G9DC8S0/user-icon.png"
                  alt="User"
                  className="w-8 h-8 rounded-full mr-2"
                />
              )}
            </div>
          ))}

          {isTyping && (
            <div className="text-sm text-gray-400 mt-2">...הבוט מקליד</div>
          )}
        </div>

        <div className="p-3 border-t border-gray-700 bg-gray-800 flex items-center gap-2">
          <button
            onClick={handleVoiceClick}
            className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-lg transition shadow-lg ${
              isRecording
                ? "bg-green-600 animate-pulse-glow"
                : "bg-red-600 hover:bg-red-500"
            }`}
            title="הקלט קול"
          >
            🎤
          </button>

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
      </div>
    </div>
  );
}
