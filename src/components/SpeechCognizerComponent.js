// file for the speech cognizer omponent

import React, { useEffect, useRef } from 'react';

const SpeechCognizerComponent = ({ listening, onInterim, onComplete }) => {
  const recognitionRef = useRef(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = true;

    recognitionRef.current.onresult = (event) => {
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
  }, []);

  useEffect(() => {
    if (listening) {
      recognitionRef.current.start();
    } else {
      recognitionRef.current.stop();
    }
  }, [listening]);

  return null;
};

export default SpeechCognizerComponent;
module.exports = {}