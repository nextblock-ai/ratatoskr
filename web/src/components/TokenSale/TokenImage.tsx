import React from 'react';

interface TokenImageProps {
  imageUrl: string;
}

const TokenImage: React.FC<TokenImageProps> = ({ imageUrl }) => {
  return <img src={imageUrl} alt="Token" />;
};

export default TokenImage;