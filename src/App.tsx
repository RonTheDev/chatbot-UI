import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import "./index.css"; // Make sure this file exists for animations

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
  const [voiceMode, setVoiceMode] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // preload voices
    window.speechSynthesis.getVoices();
  }, []);

  const speakText = (text: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "he-IL";
    const voices = speechSynthesis.getVoices();
    utterance.voice = voices.find((v) => v.lang === "he-IL") || null;
    speechSynthesis.speak(utterance);
  };

  const handleSend = (msg: string) => {
    if (!msg.trim()) return;

    const newMessage: Message = { sender: "user", text: msg };
    setMessages((prev) => [...prev, newMessage]);
    setIsTyping(true);

    setTimeout(() => {
      const botReply = "הבוט עונה בקול בלבד."; // Simulated response
      const botMessage: Message = { sender: "bot", text: botReply };

      if (!voiceMode) setMessages((prev) => [...prev, botMessage]);

      speakText(botReply);
      setIsTyping(false);
      if (voiceMode) {
        setIsRecording(false);
        setVoiceMode(false);
      }
    }, 1500);
  };

  const handleVoiceClick = () => {
    if (!("webkitSpeechRecognition" in window)) {
      alert("דפדפן זה לא תומך בזיהוי קולי. נסה בכרום.");
      return;
    }

    const SpeechRecognition =
      (window as any).webkitSpeechRecognition ||
      (window as any).SpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = "he-IL";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      handleSend(transcript);
    };

    recognition.onerror = () => {
      alert("שגיאה בזיהוי קולי");
      setIsRecording(false);
      setVoiceMode(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
    setVoiceMode(true);
    setIsRecording(true);
    recognition.start();
  };

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-[#0c0f1a] text-white flex flex-col items-center justify-center p-4 font-sans relative"
    >
      {voiceMode && (
        <div className="absolute inset-0 flex items-center justify-center z-50">
          <div className="voice-pulse-circle"></div>
        </div>
      )}

      <div className="w-full max-w-md h-[600px] bg-gray-800 rounded-2xl shadow-xl flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {!voiceMode &&
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

          {!voiceMode && isTyping && (
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
            title="הפעל מצב קולי"
          >
            🎤
          </button>

          {!voiceMode && (
            <>
              <input
                type="text"
                className="flex-1 bg-gray-700 text-white p-2 rounded-xl outline-none text-right"
                placeholder="כתוב את ההודעה שלך..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend(input)}
              />

              <button
                onClick={() => handleSend(input)}
                className="px-4 py-2 bg-green-600 rounded-xl hover:bg-green-500 transition"
              >
                שלח
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
