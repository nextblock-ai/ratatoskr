import React from 'react';

interface TokenNameProps {
    name: string;
}

function TokenName({ name }: TokenNameProps) {
    return <h2 className="text-2xl font-bold">{name}</h2>;
};

export default TokenName;
