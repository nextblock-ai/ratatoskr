// file for the ace editor component

import React, { useEffect, useRef } from 'react';
import ace from 'ace-builds';

const AceEditorComponent = ({ content, onChange, onSubmit, submitOnEnter }) => {
  const editorRef = useRef(null);

  useEffect(() => {
    const editor = ace.edit(editorRef.current);
    editor.setValue(content);
    editor.on('change', onChange);

    if (submitOnEnter) {
      editor.commands.addCommand({
        name: 'submitOnEnter',
        bindKey: { win: 'Enter', mac: 'Enter' },
        exec: onSubmit,
      });
    }
  }, [content, onChange, onSubmit, submitOnEnter]);

  return <div ref={editorRef} style={{ width: '100%', height: '100%' }}></div>;
};

module.exports = {}
