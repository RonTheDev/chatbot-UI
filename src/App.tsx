import { useState } from "react";
import { motion } from "framer-motion";

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

  const handleSend = () => {
    if (!input.trim()) return;
    const newMessage: Message = { sender: "user", text: input };
    setMessages((prev) => [...prev, newMessage]);
    setInput("");
    setIsTyping(true);

    // Simulated bot response
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        { sender: "bot", text: "חושב על תשובה..." },
      ]);
      setIsTyping(false);
    }, 800);
  };

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-[#0d0d0d] text-white flex flex-col items-center justify-center p-4 font-sans"
    >
      <div className="w-full max-w-md h-[500px] bg-[#1a1a1a] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
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
                  src="https://i.ibb.co/QY7w3Gc/bot-avatar.png"
                  alt="Bot"
                  className="w-8 h-8 rounded-full ml-2"
                />
              )}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className={`p-3 rounded-2xl max-w-xs text-right text-sm ${
                  msg.sender === "user"
                    ? "bg-green-600 text-white self-end"
                    : "bg-red-600 text-white self-start"
                }`}
              >
                {msg.text}
              </motion.div>
              {msg.sender === "user" && (
                <img
                  src="https://i.ibb.co/9bPpWbn/user-avatar.png"
                  alt="User"
                  className="w-8 h-8 rounded-full mr-2"
                />
              )}
            </div>
          ))}

          {isTyping && (
            <div className="flex justify-start items-center space-x-1">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100"></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200"></div>
            </div>
          )}
        </div>
        <div className="p-3 border-t border-gray-700 bg-[#1a1a1a] flex items-center">
          <input
            type="text"
            className="flex-1 bg-gray-800 text-white p-2 rounded-xl outline-none text-right"
            placeholder="כתוב את ההודעה שלך..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
          />
          <button
            onClick={handleSend}
            className="ml-3 px-4 py-2 bg-green-600 rounded-xl hover:bg-green-500 transition"
          >
            שלח
          </button>
        </div>
      </div>
    </div>
  );
}
