import { useState } from "react";

interface Message {
  sender: "user" | "bot";
  text: string;
}

export default function Chatbot() {
  const [messages, setMessages] = useState<Message[]>([
    { sender: "bot", text: "Welcome, how can I help you today?" },
  ]);
  const [input, setInput] = useState("");

  const handleSend = () => {
    if (!input.trim()) return;
    const newMessage: Message = { sender: "user", text: input };
    setMessages((prev) => [...prev, newMessage]);
    setInput("");

    // Simulated bot response
    setTimeout(() => {
      setMessages((prev) => [...prev, { sender: "bot", text: "Thinking..." }]);
    }, 500);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md h-[500px] bg-gray-800 rounded-2xl shadow-lg flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`p-3 rounded-xl max-w-xs ${
                msg.sender === "user"
                  ? "bg-blue-600 self-end"
                  : "bg-gray-700 self-start"
              }`}
            >
              {msg.text}
            </div>
          ))}
        </div>
        <div className="p-3 border-t border-gray-700 bg-gray-800 flex items-center">
          <input
            type="text"
            className="flex-1 bg-gray-700 text-white p-2 rounded-xl outline-none"
            placeholder="Type your message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
          />
          <button
            onClick={handleSend}
            className="ml-3 px-4 py-2 bg-blue-600 rounded-xl hover:bg-blue-500 transition"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
