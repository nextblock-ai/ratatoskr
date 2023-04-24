import React, { useState } from "react";
import { Modal, Tree, Tabs } from "antd";
import { Diff } from "react-diff-view";
import SimpleMDE from "react-simplemde-editor";
import dynamic from "next/dynamic";

const Split = dynamic(
  async () => {
    const def = await import("@geoffcox/react-splitter");
    return def.Split;
  },
  { ssr: false }
);
const { TreeNode } = Tree;
const { TabPane } = Tabs;

const ReviewAndApproveModal = ({ visible, onOkay, onCancel, data }: any) => {
  const [selectedFile, setSelectedFile] = useState(null);
  if(!data) return null;
  const treeData = data && data.updatedFilePatches && data.updatedFilePatches.map((item: any) => {
    if (item.type === 'folder') {
        return {
            title: item.name,
            key: item.name,
            children: item.children.map((child: any) => {
                return {
                    title: child.name,
                    key: child.name,
                }
            })
        }
    }
    return {
        title: item.name,
        key: item.name,
    }
  });

  const handleFileSelect = (selectedKeys: any) => {
    setSelectedFile(selectedKeys[0]);
  };

  const renderTreeNodes = (fileKeys: any) =>
  fileKeys && fileKeys.map((fileKey: any) => {
      if (fileKey.children) {
        return (
          <TreeNode title={fileKey.title} key={fileKey.key} dataRef={fileKey}>
            {renderTreeNodes(fileKey.children)}
          </TreeNode>
        );
      }
      return <TreeNode key={...fileKey} />;
    });

  return (
    <Modal title="Basic Modal" open={visible} onOk={onOkay} onCancel={onCancel}>
      <Split>
        <div className="file-tree">
          <Tree onSelect={handleFileSelect}>
            {renderTreeNodes(treeData)}
          </Tree>
        </div>
        <div className="diff-and-explanation">
          <Tabs>
            {treeData && treeData.map((fileKey: any, index: any) => (
              <TabPane tab={fileKey} key={index}>
                <Diff
                  viewType="split"
                  oldValue={data.originalFileContents[fileKey]}
                  newValue={data.updatedFileContents[fileKey]}
                />
                <SimpleMDE  
                  value={data.updatedFileContents[fileKey]}
                  onChange={() => {}}
                  options={{
                    spellChecker: false,
                    toolbar: false,
                    status: false,
                  }}
                />
              </TabPane>
            ))}
          </Tabs>
        </div>
      </Split>
  </Modal>
  );
};

export default ReviewAndApproveModal;
