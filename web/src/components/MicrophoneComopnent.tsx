// displays a microphone icon in the lower left corner of the page. When clicked, it starts listening for speech if it is not already listening. If it is listening, it stops listening. The microphone fades in and out when it is listening. When it is not listening, it is grayed out.
// the component has a listening attribute and a onListen event which is called when the user starts or stops listening. The onListen event is passed a boolean value indicating whether the user is listening or not.
import React, { useState } from 'react';

const microphone = '🎤'
const microphoneSlash = '🎤🚫'
const microphoneOff = '🔇'
const microphoneOffSlash = '🔇🚫'
const speaker = '🔊'

const MicrophoneComponent = (props: any) => {
    const [listening, setListening] = useState(true);
    const [animateListening, setAnimateListening] = useState(true);
    const [opacity, setOpacity] = useState(1);
    const [animationDirection, setAnimationDirection] = useState(true);
    
    const toggleListening = () => {
        setListening(!listening);
        setAnimateListening(!animateListening);
        animate();
        if(props.onListen) props.onListen(!listening);
    }

    const animate = () => {
        if(animateListening) {
            if(opacity <= 0.1) {
                setAnimationDirection(false);
            }
            if(opacity >= 1) {
                setAnimationDirection(true);
            }
            if(animationDirection) {
                setOpacity(opacity - 0.1);
            } else {
                setOpacity(opacity + 0.1);
            }
        }
    }

    setInterval(animate, 100);
    
    return (
        <div className="microphone" onClick={toggleListening}>
        {listening ? microphone : microphoneOff}
        </div>
    )
}