import React from 'react';

interface TokenNameProps {
  name: string;
}

const TokenName: React.FC<TokenNameProps> = ({ name }) => {
  return <h2>{name}</h2>;
};

export default TokenName;