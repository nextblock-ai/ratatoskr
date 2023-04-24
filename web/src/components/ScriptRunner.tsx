// EditorComponent.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import 'easymde/dist/easymde.min.css';
import dynamic from "next/dynamic";
import 'easymde/dist/easymde.min.css';
import axios from "axios";
const SimpleMDE = dynamic(() => import("react-simplemde-editor"), {
    ssr: false,
});

export default function ScriptRunner(script: any, options?: any, style?: any) {
    const [busy, setBusy] = useState(false);
    if(options && options.busy !== busy) setBusy(options && options.busy);
    const runnerText = `
    # ScriptRunner
    `
    const conversationRef = useRef([{
        "role": "system",
        "content": script.script
    }]);

    const [whoseTurn, setWhoseTurn] = useState("assistant");
    const [firstTime, setFirstTime] = useState(true);

    let getEditorString: any = conversationRef.current
        .map((ev: { content: any; }, i: any) => ev.content)
        .slice(1)
    getEditorString.unshift(runnerText);
    getEditorString = getEditorString
        .join("\n\n") + '\n\n'

        
    useEffect(() => {
        if(!firstTime) return;
        setFirstTime(false);
        axios.post("/api/chat", {messages: conversationRef.current}).then((res: any) => {
            let response = res.data.result;
            conversationRef.current.push({
                "role": "assistant",
                "content": response.script ? response.script : response
            });
            setWhoseTurn("user");
        });;
    }, [firstTime, conversationRef]);

    const spinnerText = "<span class=\"autosave\">Assistant is typing...</span>";

    const textChange = (value: string) => {
        const hitEnter = value.endsWith("\n");
        if (!hitEnter || whoseTurn === 'assistant') return;
    
        let lastLine: any = value.split("\n");
        lastLine = lastLine[lastLine.length - 2];
    
        const lastResponse = conversationRef.current[conversationRef.current.length - 1];
    
        if (lastResponse.role === "assistant" && lastResponse.content === lastLine) {
            return;
        }
    
        conversationRef.current.push({
            "role": "user",
            "content": lastLine
        });
    
        setWhoseTurn("assistant");
    
        // Insert spinner text into the editor content
        const editor = document.querySelector(".editor-statusbar");
        if (editor) {
            const span = document.createElement("span");
            span.classList.add("autosave");
            span.innerHTML = spinnerText;
            span.id = 'autosave'
            editor.appendChild(span);
        }
    
        axios.post("/api/chat", { messages: conversationRef.current }).then((res: any) => {
            // Remove spinner text from the editor content
            if (editor) {
                const autosave = document.querySelector("#autosave");
                if(autosave) autosave.parentNode?.removeChild(autosave);
            }
    
            let response2 = res.data.result;
            conversationRef.current.push({
                "role": "assistant",
                "content": response2.script ? response2.script : response2
            });
            setWhoseTurn("user");
        });
    };

    return (
        <SimpleMDE
            value={getEditorString}
            options={options}
            style={style}
            onChange={textChange}
        />
    )

}