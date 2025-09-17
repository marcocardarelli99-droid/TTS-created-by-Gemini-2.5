
import React from 'react';
import { VoiceAssistant } from './components/VoiceAssistant';

const App: React.FC = () => {
  return (
    <div className="bg-gray-900 min-h-screen text-white flex flex-col items-center justify-center p-4 font-sans">
      <div className="w-full max-w-4xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-100">
            Gemini Live TTS
          </h1>
          <p className="text-lg text-gray-400 mt-2">
            Real-time voice conversations with Gemini
          </p>
        </header>
        <main>
          <VoiceAssistant />
        </main>
      </div>
    </div>
  );
};

export default App;
