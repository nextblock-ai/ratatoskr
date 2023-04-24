// EditorComponent.tsx
import React, { useState, useEffect } from 'react';
import SimpleMDE from 'react-simplemde-editor';
import 'easymde/dist/easymde.min.css';
import { Spin } from 'antd';

export default function EditorComponent(value: any, onChange: any, options?: any, style?: any) {
    const [busy, setBusy] = useState(false);
    const [editorValue, setEditorValue] = useState(value);
    if(options && options.busy !== busy) setBusy(options && options.busy);
    if(value !== editorValue) setEditorValue(value);
    if(busy) {
        return (
            <div className="spinner">
                <Spin />
            </div>
        )
    } else 
        return (
            <SimpleMDE
                value={editorValue}
                onChange={onChange}
                options={options}
                style={style}
            />
        )
}