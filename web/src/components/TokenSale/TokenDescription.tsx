import React from 'react';

interface TokenDescriptionProps {
  description: string;
}

const TokenDescription: React.FC<TokenDescriptionProps> = ({ description }) => {
  return <p>{description}</p>;
};

export default TokenDescription;