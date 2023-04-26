// file for the speech cognizer omponent

import React, { useEffect, useRef } from 'react';

const SpeechCognizerComponent = ({ listening, autoRestart, onInterim, onComplete }: any) => {
  const recognitionRef = useRef(null);
  const wnd = window ? window : null;
  
  useEffect(() => {
    if (!wnd) {
      return;
    }
    const SpeechRecognition = (wnd as any).SpeechRecognition || (wnd as any).webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    (recognitionRef as any).current.continuous = true;
    (recognitionRef as any).current.interimResults = true;

    (recognitionRef as any).current.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
          onComplete(finalTranscript);
        } else {
          interimTranscript += event.results[i][0].transcript;
          onInterim(interimTranscript);
        }
      }
    };
    (recognitionRef as any).onerror = (event: any) => {
      if(autoRestart) {
        (recognitionRef as any).current.start();
      }
    }
  }, []);

  useEffect(() => {
    if (listening) {
      (recognitionRef as any).current.start();
    } else {
      (recognitionRef as any).current.stop();
    }
  }, [listening]);

  return null;
};

export default SpeechCognizerComponent;
