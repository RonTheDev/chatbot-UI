// App.tsx

import { useState, useRef } from "react";
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
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = Ref<MediaStream | null>(null);
  const silenceTimerRef = Ref<NodeJS.Timeout | null>(null);

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

        const formData = new FormData();
        formData.append("audio", audioBlob, "recording.webm");

        try {
          const res = await fetch(`${FLASK_SERVER_URL}/transcribe`, {
            method: "POST",
            body: formData,
          });
          const data = await res.json();
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
          setMessages((prev) => [...prev, { sender: "bot", text: "(🔊 קול הופעל על ידי OpenAI TTS)" }]);

          audio.onended = () => {
            if (isVoiceMode) {
              setTimeout(() => startVoiceLoop(), 300); // short delay between loops
            }
          };

          audio.play();
        } catch (err) {
          console.error("Voice flow error:", err);
          setMessages((prev) => [...prev, { sender: "bot", text: "שגיאה בזיהוי קול או השמעה." }]);
          if (isVoiceMode) setTimeout(() => startVoiceLoop(), 1000);
        }
      };

      mediaRecorder.start();

      const checkSilence = () => {
        analyser.getByteTimeDomainData(dataArray);
        const maxAmplitude = Math.max(...dataArray.map((v) => Math.abs(v - 128)));
        if (maxAmplitude < 5) {
          if (!silenceTimerRef.current) {
            silenceTimerRef.current = setTimeout(() => {
              mediaRecorder.stop();
              audioContext.close();
            }, 1500); // silence duration
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
      console.error("Mic error:", err);
    }
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
        body: JSON.stringify({ prompt
