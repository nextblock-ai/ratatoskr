// EditorComponent.tsx
import React, { useState, useEffect, useCallback } from 'react';
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
    const [editorValue, setEditorValue] = useState([runnerText]);
    const getEditorString = useCallback((): string => editorValue.join("\n") + '\n\n', [editorValue]);
    const getEditorLastLine = () => editorValue[editorValue.length - 1];
    const [conversation, setConversation] = useState([{
        "role": "system",
        "content": script.script
    }]);

    const [whoseTurn, setWhoseTurn] = useState("assistant");
    const [firstTime, setFirstTime] = useState(true);

    useEffect(() => {
        if(!firstTime) return;
        setFirstTime(false);
        axios.post("/api/chat", {messages: conversation}).then((res: any) => {
            let response = res.data.result;
            response = response.script ? response.script : response;
            conversation.push({
                "role": "assistant",
                "content": response
            });
            setWhoseTurn("user");
            editorValue.push(response);
            setEditorValue(editorValue);
        });;
    }, [conversation, editorValue, getEditorString, runnerText]);

    const textChange = (value: string) => {
        let lastLine = editorValue[editorValue.length - 1].length === 0 ? '' : editorValue[editorValue.length - 1];
        
        editorValue.push(value);
        setEditorValue(editorValue);
        
        if(value.endsWith("\n") && whoseTurn === "user") {
            conversation.push({
                "role": "user",
                "content": getEditorLastLine()
            });
            axios.post("/api/chat", {messages:conversation}).then((res: any) => {
                let response = res.data.result;
                response = response.script ? response.script : response;
                conversation.push({
                    "role": "assistant",
                    "content": response
                });
                setWhoseTurn("assistant");
                editorValue.push(response);
                setEditorValue(editorValue);
            });
        } else {
            if(value.endsWith("\n")) setWhoseTurn("user");
        }
    }

    return (
        <SimpleMDE
            value={editorValue.join('\n')}
            options={options}
            style={style}
            onChange={textChange}
        />
    )

}