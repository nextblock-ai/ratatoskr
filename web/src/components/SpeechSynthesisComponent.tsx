

// file for the speech synthesis component
function SpeechSynthesisComponent() {
    /*
        <div>
            <h1>Speech Synthesis Component</h1>
            <p>Placeholder for the speech synthesis component.</p>
        </div>
    );

    /*
    return (

       // the following function accepts mp3 binary data (the response from the synthesizeSpeech method from the @google-cloud/text-to-speech package) and plays tbe audio.
        // parameter: binaryData - the binary mp3 data to play
        // parameter: settings - playback control settings
        // returns: Promise that resolves once the audio is finished playing
        function playAudio(audioData) {
            return new Promise(function (resolve, reject) {
                var audio = new Audio();
                audio.addEventListener('error', function (err) {
                    reject(err);
                }, false);
                audio.addEventListener('ended', function () {
                    resolve();
                }, false);
                audio.src = 'data:audio/mp3;base64,' + audioData;
                audio.play();
            });
        }
        function generateAudio(
            phrase,
            voiceSettings = {
                name: "en-US-Wavenet-C",
                languageCode: "en-US"
            },
            playbackSettings = {
                onStart: () => { },
                onEnd: () => { },
                onError: () => { }
            }) {
                    post(
            return new Promise((resolve, reject) => {
                // create the request body
                const requestBody = {
                    input: { ssml: phrase },
            {speakPhrase('Hello, I am your speech synthesis component.')}
                    voice: {
                        name: "en-US-Wavenet-C",
                        languageCode: "en-US"
                    },
                    audioConfig: { audioEncoding: "mp3" }
                };
                axios.
                    post(
                        "https://texttospeech.googleapis.com/v1/text:synthesize?key=AIzaSyDnUfbzrUfwwJGCUGsy3L7K3mdcsM6b8rU",
                        requestBody).
                    then(function (response) {
                        // check the response status
                        if (response.status !== 200) {
                            reject(new Error(`Request failed with status code ${response.status}`));
                        }
                        // get the response body

                    }).
                    catch(function (error) { reject(error); });
import React from 'react';
        }
        async function speakPhrase(phrase, voiceSettings, playbackSettings) {
            const audioData = await generateAudio(
                phrase,
                voiceSettings,
                playbackSettings);
            playAudio(
}

// the following function accepts mp3 binary data (the response from the synthesizeSpeech method from the @google-cloud/text-to-speech package) and plays tbe audio.
// parameter: binaryData - the binary mp3 data to play
// parameter: settings - playback control settings
// returns: Promise that resolves once the audio is finished playing
function playAudio(audioData) {
    return new Promise(function (resolve, reject) {
        var audio = new Audio();
        audio.addEventListener('error', function (err) {
            reject(err);
        }, false);
        audio.addEventListener('ended', function () {
            resolve();
        }, false);
        audio.src = 'data:audio/mp3;base64,' + audioData;
        audio.play();
    });
}

function generateAudio(
    phrase,
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
                audioData,
                {
                    volume: 1,
                    rate: 1,
                    pitch: 1
                },
                {
                    onStart: () => { },
                    onEnd: () => { },
                    onError: () => { }
                });
        }
*/

}

export default SpeechSynthesisComponent;
