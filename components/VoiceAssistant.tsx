
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { VOICES, BASE_SYSTEM_INSTRUCTION } from '../constants';
import { type TranscriptMessage } from '../types';
import { MicrophoneIcon, StopIcon, UserIcon, GeminiIcon } from './icons';

// Define a type for the Live Session for better type safety
type LiveSession = {
  sendRealtimeInput: (input: object) => void;
  close: () => void;
};

// Define the structure for an audio node pair for interruption handling
interface AudioNodePair {
  source: AudioBufferSourceNode;
  gainNode: GainNode;
}

export const VoiceAssistant: React.FC = () => {
  const [sessionActive, setSessionActive] = useState(false);
  const [status, setStatus] = useState('Disconnected. Press Start to begin.');
  const [conversationTranscript, setConversationTranscript] = useState<TranscriptMessage[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>(VOICES[0]);
  const [customPrompt, setCustomPrompt] = useState('');
  const [isRecording, setIsRecording] = useState(false);

  const clientRef = useRef<GoogleGenAI | null>(null);
  const sessionRef = useRef<LiveSession | null>(null);

  // Refs for audio input (user microphone)
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

  // Refs for audio output (Gemini response)
  const outputContextRef = useRef<AudioContext | null>(null);
  const sourcesRef = useRef<Set<AudioNodePair>>(new Set());
  const nextStartTimeRef = useRef<number>(0);
  const transcriptContainerRef = useRef<HTMLDivElement>(null);

  // Initialize the Gemini client
  useEffect(() => {
    if (process.env.API_KEY) {
      clientRef.current = new GoogleGenAI({ apiKey: process.env.API_KEY });
    } else {
      setStatus('API_KEY environment variable not set.');
      console.error('API_KEY environment variable not set.');
    }
  }, []);
  
  // Auto-scroll transcript
  useEffect(() => {
    if (transcriptContainerRef.current) {
      transcriptContainerRef.current.scrollTop = transcriptContainerRef.current.scrollHeight;
    }
  }, [conversationTranscript]);

  const playAudioData = useCallback(async (float32Array: Float32Array) => {
    if (!outputContextRef.current) return;
    if (outputContextRef.current.state === 'suspended') {
      await outputContextRef.current.resume();
    }

    const sampleRate = 24000;
    const audioBuffer = outputContextRef.current.createBuffer(1, float32Array.length, sampleRate);
    audioBuffer.getChannelData(0).set(float32Array);

    nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputContextRef.current.currentTime);

    const source = outputContextRef.current.createBufferSource();
    source.buffer = audioBuffer;
    const gainNode = outputContextRef.current.createGain();
    gainNode.gain.value = 1.0;
    source.connect(gainNode);
    gainNode.connect(outputContextRef.current.destination);

    const audioNodePair: AudioNodePair = { source, gainNode };
    sourcesRef.current.add(audioNodePair);

    source.addEventListener('ended', () => {
      sourcesRef.current.delete(audioNodePair);
    });

    source.start(nextStartTimeRef.current);
    nextStartTimeRef.current += audioBuffer.duration;
  }, []);

  const handleInterrupt = useCallback(() => {
    console.log('INTERRUPT received. Fading out audio...');
    if (!outputContextRef.current) return;
    
    const currentTime = outputContextRef.current.currentTime;
    const fadeOutDuration = 0.03; // 30ms fadeout

    sourcesRef.current.forEach((pair) => {
      pair.gainNode.gain.setValueAtTime(pair.gainNode.gain.value, currentTime);
      pair.gainNode.gain.linearRampToValueAtTime(0, currentTime + fadeOutDuration);
      
      // Stop the source after the fadeout is complete
      try {
        pair.source.stop(currentTime + fadeOutDuration);
      } catch (e) {
        // Ignore errors if source is already stopped
      }
    });

    // Clear the set after a short delay to ensure cleanup
    setTimeout(() => {
        sourcesRef.current.clear();
    }, fadeOutDuration * 1000 + 50);

    nextStartTimeRef.current = 0;
  }, []);

  const handleGeminiMessage = useCallback(async (message: any) => {
    if (message.serverContent?.interrupted) {
        handleInterrupt();
    }
    
    if (message.serverContent?.modelTurn?.parts) {
      for (const part of message.serverContent.modelTurn.parts) {
        if (part.inlineData?.data) {
          const base64 = part.inlineData.data;
          const byteArray = new Uint8Array(atob(base64).split('').map(c => c.charCodeAt(0)));
          const int16Array = new Int16Array(byteArray.buffer);
          const float32 = new Float32Array(int16Array.length);
          for (let i = 0; i < int16Array.length; i++) {
            float32[i] = int16Array[i] / 32768.0;
          }
          await playAudioData(float32);
        }
        if (part.text) {
          setConversationTranscript(prev => {
            const lastMessage = prev[prev.length - 1];
            if (lastMessage && lastMessage.role === 'ai') {
              lastMessage.text += part.text;
              return [...prev.slice(0, -1), lastMessage];
            }
            return [...prev, { role: 'ai', text: part.text }];
          });
        }
      }
    }
    
    if (message.serverContent?.inputTranscription?.text) {
        const userText = message.serverContent.inputTranscription.text;
        setConversationTranscript(prev => {
          const lastMessage = prev[prev.length - 1];
          if (lastMessage && lastMessage.role === 'user') {
            lastMessage.text = userText;
            return [...prev.slice(0, -1), lastMessage];
          }
          return [...prev, { role: 'user', text: userText }];
        });
    }
  }, [playAudioData, handleInterrupt]);

  const initSession = useCallback(async () => {
    if (!clientRef.current) {
      setStatus('Gemini Client not initialized.');
      return;
    }

    setStatus('Connecting...');
    setConversationTranscript([]);
    outputContextRef.current = new AudioContext({ sampleRate: 24000 });

    const finalSystemInstruction = `${BASE_SYSTEM_INSTRUCTION}\n\n${customPrompt}`;

    try {
      const session = await clientRef.current.live.connect({
        model: 'gemini-live-2.5-flash-preview',
        callbacks: {
          onopen: () => setStatus('Connected. You can start speaking.'),
          onmessage: handleGeminiMessage,
          onerror: (e) => {
            console.error('Session error:', e);
            setStatus('Connection error. Please try again.');
            setSessionActive(false);
          },
          onclose: (e) => {
            console.log('Session closed:', e?.reason);
            setStatus('Disconnected. Press Start to begin.');
            setSessionActive(false);
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: selectedVoice } }
          },
          systemInstruction: { parts: [{ text: finalSystemInstruction }] }
        }
      });
      sessionRef.current = session as LiveSession;
      setSessionActive(true);
    } catch (e) {
      console.error("Failed to connect:", e);
      setStatus('Failed to connect. Check console for details.');
      setSessionActive(false);
    }
  }, [customPrompt, selectedVoice, handleGeminiMessage]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
      processorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);

      processorRef.current.onaudioprocess = (e) => {
        const float32 = e.inputBuffer.getChannelData(0);
        const int16 = new Int16Array(float32.length);
        for (let i = 0; i < float32.length; i++) {
          int16[i] = Math.max(-1, Math.min(1, float32[i])) * 32767;
        }
        const base64 = btoa(String.fromCharCode(...new Uint8Array(int16.buffer)));

        if (sessionRef.current) {
          sessionRef.current.sendRealtimeInput({
            media: { data: base64, mimeType: "audio/pcm;rate=16000" }
          });
        }
      };

      sourceRef.current.connect(processorRef.current);
      processorRef.current.connect(audioContextRef.current.destination);
      streamRef.current = stream;
      setIsRecording(true);

    } catch (error) {
      console.error('Error starting recording:', error);
      setStatus('Microphone access denied.');
      setSessionActive(false); // Ensure we don't stay in an active state
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (processorRef.current) processorRef.current.disconnect();
    if (sourceRef.current) sourceRef.current.disconnect();
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
    }
    setIsRecording(false);
  }, []);

  const closeSession = useCallback(() => {
    stopRecording();
    handleInterrupt(); // Ensure all audio is stopped
    
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }
    if (outputContextRef.current && outputContextRef.current.state !== 'closed') {
      outputContextRef.current.close();
    }
    setSessionActive(false);
  }, [stopRecording, handleInterrupt]);

  const handleStartStop = async () => {
    if (sessionActive) {
      closeSession();
    } else {
      await initSession();
      await startRecording();
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (sessionActive) {
        closeSession();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const TranscriptLine: React.FC<{ msg: TranscriptMessage }> = ({ msg }) => {
    const isUser = msg.role === 'user';
    return (
      <div className={`flex items-start gap-3 my-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
        {!isUser && <GeminiIcon className="w-6 h-6 text-indigo-400 flex-shrink-0 mt-1" />}
        <div className={`p-3 rounded-lg max-w-lg ${isUser ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-200'}`}>
          <p className="text-base whitespace-pre-wrap">{msg.text}</p>
        </div>
        {isUser && <UserIcon className="w-6 h-6 text-gray-400 flex-shrink-0 mt-1" />}
      </div>
    );
  };

  return (
    <div className="bg-gray-800 rounded-xl shadow-2xl p-6 border border-gray-700 max-w-4xl w-full flex flex-col h-[80vh]">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label htmlFor="voice" className="block text-sm font-medium text-gray-400 mb-1">Voice Personality</label>
          <select id="voice" value={selectedVoice} onChange={(e) => setSelectedVoice(e.target.value)} disabled={sessionActive} className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white focus:ring-2 focus:ring-indigo-500 disabled:opacity-50">
            {VOICES.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="prompt" className="block text-sm font-medium text-gray-400 mb-1">Custom Instruction</label>
          <input id="prompt" type="text" value={customPrompt} onChange={(e) => setCustomPrompt(e.target.value)} placeholder="e.g., Act as a pirate" disabled={sessionActive} className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white focus:ring-2 focus:ring-indigo-500 disabled:opacity-50" />
        </div>
      </div>

      <div className="flex items-center justify-center gap-4 mb-4">
        <button
          onClick={handleStartStop}
          className={`px-8 py-4 rounded-full text-lg font-semibold flex items-center gap-2 transition-all duration-300 ease-in-out transform hover:scale-105
            ${sessionActive ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}
        >
          {sessionActive ? <StopIcon className="w-6 h-6" /> : <MicrophoneIcon className="w-6 h-6" />}
          <span>{sessionActive ? 'Stop Session' : 'Start Session'}</span>
        </button>
      </div>
      <div className="text-center text-gray-400 text-sm mb-4 h-5">{status}</div>

      <div ref={transcriptContainerRef} className="flex-grow bg-gray-900 rounded-lg p-4 overflow-y-auto border border-gray-700">
        {conversationTranscript.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            Conversation will appear here...
          </div>
        ) : (
          conversationTranscript.map((msg, index) => <TranscriptLine key={index} msg={msg} />)
        )}
      </div>
    </div>
  );
};
