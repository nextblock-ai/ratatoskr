// a location bar react component - accepts a path and a callback and displays the path and calls the callback when the path is changed
// leverages ant.design components
import React, { useState } from 'react';
import { Breadcrumb, Input } from 'antd';

interface LocationBarProps {
    path: string;
    onPathChanged: (path: string) => void;
}

const LocationBar: React.FC<LocationBarProps> = ({ path, onPathChanged }) => {
    const [location, setLocation] = useState(path);
    const onLocationChanged = (event: React.ChangeEvent<HTMLInputElement>) => {
        setLocation(event.target.value);
    };
    const onLocationBlur = () => {
        onPathChanged(location);
    };
    return (
        <Breadcrumb>
            <Breadcrumb.Item>
                <Input
                    value={location}
                    onChange={onLocationChanged}
                    onBlur={onLocationBlur}
                />
            </Breadcrumb.Item>
        </Breadcrumb>
    );
};

export default LocationBar;