import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import "./index.css";

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
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    window.speechSynthesis.getVoices(); // preload voices
  }, []);

  const speakText = (text: string, onEnd?: () => void) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "he-IL";
    const voices = speechSynthesis.getVoices();
    utterance.voice = voices.find((v) => v.lang === "he-IL") || null;
    if (onEnd) utterance.onend = onEnd;
    speechSynthesis.speak(utterance);
  };

  const startListening = () => {
    const SpeechRecognition =
      (window as any).webkitSpeechRecognition ||
      (window as any).SpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = "he-IL";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      console.log("🎙️ User said:", transcript);

      const botResponse = generateBotResponse(transcript);
      speakText(botResponse, () => {
        if (isVoiceMode) {
          setTimeout(() => startListening(), 400);
        }
      });
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

  const generateBotResponse = (input: string): string => {
    if (input.includes("מה קורה")) return "הכל מצוין, תודה ששאלת!";
    if (input.includes("מי אתה")) return "אני הבוט החכם שלך, תמיד כאן בשבילך.";
    return "הבנתי אותך. בוא נמשיך לדבר.";
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
      {/* Glow overlay for voice mode */}
      {isVoiceMode && (
        <div className="absolute inset-0 z-40 flex items-center justify-center">
          <div className="voice-pulse-circle"></div>
        </div>
      )}

      {/* Chat UI container */}
      <div className="w-full max-w-md h-[600px] bg-gray-800 rounded-2xl shadow-xl flex flex-col overflow-hidden z-10">
        {/* Messages */}
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

        {/* Input + Buttons */}
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

      {/* Mic toggle button */}
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
