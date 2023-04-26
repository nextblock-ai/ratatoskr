import axios from 'axios';
import config from '@/config';

function playAudio(audioData: any) {
    return new Promise(function (resolve, reject) {
        var audio = new Audio();
        audio.addEventListener('error', function (err) {
            reject(err);
        }, false);
        audio.addEventListener('ended', function () {
            resolve(undefined);
        }, false);
        audio.src = 'data:audio/mp3;base64,' + audioData;
        audio.play();
    });
}

function generateAudio(
    phrase: string,
    voiceSettings = {
        name: "en-US-Wavenet-C",
        languageCode: "en-US"
    },
    playbackSettings = {
        onStart: () => { },
        onEnd: () => { },
        onError: () => { }
    }) {
    return new Promise((resolve, reject) => {
        // create the request body
        const requestBody = {
            input: { ssml: phrase },
            voice: {
                name: "en-US-Wavenet-C",
                languageCode: "en-US"
            },
            audioConfig: { audioEncoding: "mp3" }
        };
        axios.post(
            "https://texttospeech.googleapis.com/v1/text:synthesize?key=AIzaSyDnUfbzrUfwwJGCUGsy3L7K3mdcsM6b8rU",
            requestBody).
        then(function (response) {
            // check the response status
            if (response.status !== 200) {
                reject(new Error(`Request failed with status code ${response.status}`));
            }
            // get the response body
            resolve(response.data.audioContent);
        }).catch(function (error) { reject(error); });
    });
}

async function speakPhrase(phrase: string, voiceSettings: any, playbackSettings: any) {
    const audioData = await generateAudio(
        phrase,
        voiceSettings,
        playbackSettings);
    playAudio(audioData);
}

// this react component accepts a phrase attribute and a voiceSettings attribute and a placebackSettings attribute and speaks the phrase using the voiceSettings and playbackSettings then calls the onComplete callback
function SpeechSynthesisComponent(props: any) {
    const { phrase, voiceSettings, playbackSettings, onComplete } = props;
    speakPhrase(phrase, voiceSettings, playbackSettings).then(() => {
    const { phrase, voiceSettings, playbackSettings, onComplete } = props;
    if(onComplete) onComplete();
    });
    return null;
}

export default SpeechSynthesisComponent;
