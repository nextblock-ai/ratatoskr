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
        <div className="m-2">
        <Input
            value={location}
            onChange={onLocationChanged}
            onBlur={onLocationBlur}
            className="border border-gray-300 rounded"
        />
        </div>
    );
};

export default LocationBar;