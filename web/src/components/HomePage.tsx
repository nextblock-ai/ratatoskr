// file for the HomePage component
import { Layout, Tree } from "antd";
import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import axios from "axios";
import 'easymde/dist/easymde.min.css';
import ScriptRunner from "./ScriptRunner";
import LocationBar from "./LocationBar";
import SpeechCognizerComponent from "./SpeechCognizerComponent";

const EditorComponent = dynamic(() => import("react-simplemde-editor"), {
    ssr: false,
});
const ReviewAndApproveModal = dynamic(() => import("./ReviewAndApproveModal"), {
    ssr: false,
});
const Split = dynamic(
    async () => {
        const def = await import("@geoffcox/react-splitter");
        return def.Split;
    },
    { ssr: false }
);

const { Sider, Content, Footer } = Layout;

// treeview is on the left, content on the right. a splitter separates the two, allowing for resizing
// in the content area, there is a content area and a tabview area. A horiontal splitter separates the two, allowing for resizing
const HomePage = () => {
  const [treeData, setTreeData] = useState([]);
  const [content, setContent] = useState(" ");
  const [commentary, setCommentary] = useState(" ");
  const [command, setCommand] = useState(" ");
  const [modalVisible, setModalVisible] = useState(false);
  const [modalData, setModalData] = useState({});
  const [commandBusy, setCommandBusy] = useState(true);
  const [isScript, setIsScript] = useState(false);
  const [path, setPath] = useState("/");
  const [listening, setListening] = useState(true);

  const findTreeData = (name: string, treeData: any) => {
    for (let i = 0; i < treeData.length; i++) {
      if (treeData[i].title === name) {
        return treeData[i];
      }
      if (treeData[i].children) {
        const result: any = findTreeData(name, treeData[i].children);
        if (result) {
          return result;
        }
      }
    }
    return null;
  }

  const self = this;
  function debounce(func:any, wait:any) {
    let timeout: any;
    return  (...args: any[]) => {
      const context = (self as any);
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(context, args), wait);
    };
  }
  async function fetchData() {
    const res = await axios.get("/api/tree");
    setTreeData(res.data.tree);
    const cwd = await axios.get("/api/cwd");
    setPath(cwd.data.cwd);
  }
  useEffect(() => {
    fetchData();
  }, []);

  async function performCommand(value: string) {
    setCommandBusy(true);
    setCommentary("Command: " + value);
    console.log("querying", value);
    const source = new EventSource("/api/stream-command?command=" + encodeURIComponent(value));
  
    source.onopen = (event) => {
      console.log("Connection opened:", event);
    };
  
    source.onmessage = async (event) => {
      const d = JSON.parse(event.data);
      if(!d.data) {
        fetchData();
        return;
      }
      setCommentary(d.data + "\n\n" + commentary);
    };
  
    source.onerror = (event) => {
      console.log("Connection error:", event);
      source.close(); // Close the EventSource when an error occurs
    };
  
    return () => {
      source.close(); // Close the EventSource when the component is unmounted
    };
  }

  const debouncedPerformCommand = debounce(performCommand, 300); 
  
  const handleContentChange = (value: string) => {
    // 
  };
  const handleCommandChange = async (value: string) => {
    // if the command ends with a newline, then execute it
    const parts = value.split("\n");
    const lastpart = parts[parts.length - 1].trim();

    value = value.trim();
    if (lastpart.length === 0 && value && value.length > 0) {
      console.log("executing command", value);
      const command = debouncedPerformCommand(value);
      setCommandBusy(false)
      setCommand("");
    }
  };

  function onInterim(text: string) {
    setCommand(command + text);
  }

  function onComplete(text: string) {
    setCommand(command + text);
  }

  return (
    <div style={{ display: "flex", flexDirection: "row", height: "100%" }}>
    <Split horizontal minPrimarySize="80%">
        <div style={{ flexGrow: 1, height: '100%' }}>
        <SpeechCognizerComponent listening={listening} onInterim={onInterim} onComplete={onComplete} />
            <LocationBar path={path} onPathChanged={setPath} />
            <div style={{ flexGrow: 1, height: '100%' }}>
            <ReviewAndApproveModal
                visible={modalVisible}
                data={modalData}
                onCancel={() => setModalVisible(false)}
            />
            <Split initialPrimarySize="20%">
                <Tree
                defaultExpandedKeys={["0-0-0", "0-0-1"]}
                defaultSelectedKeys={["0-0-0", "0-0-1"]}
                defaultCheckedKeys={["0-0-0", "0-0-1"]}
                onSelect={(selectedKeys, info) => {
                    console.log("selected", selectedKeys, info);
                    // fetch the file contents
                    async function fetchData() {
                        let cwd: any = await axios.get("/api/cwd");
                        cwd = cwd.data.cwd;
                        const pa = selectedKeys[0]
                        let res = await axios.get(`/api/file?path=${pa}`);
                        if (res.data.file) {
                            setContent(res.data.file);
                            if(!(selectedKeys[0] as any).endsWith('.script')) {
                                res = await axios.get(`/api/summary?path=${pa}`);
                                setCommentary(res.data.message);
                                setIsScript(false);
                            } else {
                                setIsScript(true);
                            }
                        } 
                    }
                    fetchData();
                }}
                treeData={treeData}
                />
                <div
                style={{
                    display: "flex",
                    flexDirection: "row",
                    height: "100%",
                }}
                >
                <Split horizontal initialPrimarySize="80%">
                    {isScript && 
                        <ScriptRunner script={content} options={{
                            autoSize: true,
                        }}/>
                    }
                    {!isScript &&
                        <EditorComponent
                            className="full-size"
                            value={content || ''}
                            onChange={handleContentChange}
                            options={{
                                autoSize: true,
                            }}
                        />
                    }
                    <EditorComponent
                    className="full-size"
                    value={commentary || ''}
                    onChange={handleCommandChange}
                    options={{
                        autoSize: true,
                        toolbar: false,
                    }}
                    />
                </Split>
                </div>
            </Split>
            </div>

        </div>
        <EditorComponent
            value={command}
            onChange={handleCommandChange}
            options={{
                maxHeight: "150px",
                minHeight: "150px",
                toolbar: false,
                busy: commandBusy
            }}
            style={{ position: "sticky", bottom: 0, height: "100%" }}
            />
    </Split>
    
    </div>
  );
};

export default HomePage;
