// file for the HomePage component

import React from 'react';
import { Layout, Tree } from 'antd';
import AceEditorComponent from '../components/AceEditorComponent';
import SplitterComponent from '../components/SplitterComponent';

const { Sider, Content, Footer } = Layout;

// treeview is on the left, content on the right. a splitter separates the two, allowing for resizing
// in the content area, there is a content area and a tabview area. A horiontal splitter separates the two, allowing for resizing
const HomePage = () => {
    const onSelect = (selectedKeys, info) => {
        console.log('selected', selectedKeys, info);
        return (<Layout>
            <Sider width={200} className="site-layout-background">
                <Tree
                    defaultExpandedKeys={['0-0-0', '0-0-1']}
                    defaultSelectedKeys={['0-0-0', '0-0-1']}
                    defaultCheckedKeys={['0-0-0', '0-0-1']}
                    onSelect={onSelect}
                    treeData={[
                        {
                            title: 'parent 1',
                            key: '0-0',
                            children: [
                                {
                                    title: 'parent 1-0',
                                    key: '0-0-0',
                                    children: [
                                        { title: 'leaf', key: '0-0-0-0' },
                                        { title: 'leaf', key: '0-0-0-1' },
                                    ],
                                },
                                {
                                    title: 'parent 1-1',
                                    key: '0-0-1',
                                    children: [
                                        { title: 'leaf', key: '0-0-1-0' },
                                    ],
                                },
                            ],
                        },
                    ]}
                />
            </Sider>
            <Layout style={{ padding: '0 24px 24px' }}>
                <Content
                    className="site-layout-background"
                    style={{
                        padding: 24,
                        margin: 0,
                        minHeight: 280,
                    }}
                >
                    <SplitterComponent direction="horizontal">
                        <AceEditorComponent />
                        <AceEditorComponent />
                    </SplitterComponent>
                </Content>
            </Layout>
        </Layout>);
    }
};

export default HomePage;
