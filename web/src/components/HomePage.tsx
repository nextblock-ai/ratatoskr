// file for the HomePage component
import { Layout, Tree } from "antd";
import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import axios from "axios";
import 'easymde/dist/easymde.min.css';
import ScriptRunner from "./ScriptRunner";

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
  const [ isScript, setIsScript ] = useState(false);

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

  useEffect(() => {
    async function fetchData() {
        const res = await axios.get("/api/tree");
        setTreeData(res.data.tree);
    }
    fetchData();
  }, []);


  const handleContentChange = (value: string) => {};
  const handleCommandChange = async (value: string) => {
    // if the command ends with a newline, then execute it
    const parts = value.split("\n");
    const lastpart = parts[parts.length - 1].trim();
    if (lastpart.length === 0) {
      setCommandBusy(true)
      console.log('querying', value)
      const md = await axios.post("/api/command", { command: value });
      if (md.data) {
        setCommandBusy(false)
        setCommand("");
        // update the tree
        // setModalData({
        //     bashCommands: md.data.bashCommands,
        //     updatedFilePatches: md.data.updatedFilePatches,
        //     conversationalResponse: md.data.conversationalResponse,
        // });
        // setModalVisible(true);
        // const response = await axios.post('/api/commit', md);
        setCommentary(commentary + "\n" + JSON.stringify(md.data));
      }
      if (md.data && md.data.conversationalResponse) {
        setCommentary(md.data.conversationalResponse);
      }
    }
  };
  return (
    <div style={{ display: "flex", flexDirection: "row", height: "100%" }}>
    <Split horizontal minPrimarySize="80%">
        <div style={{ flexGrow: 1, height: '100%' }}>
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
