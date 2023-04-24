import React from 'react';

interface TokenPriceProps {
  price: number;
}

const TokenPrice: React.FC<TokenPriceProps> = ({ price }) => {
  return <p>Price: {price}</p>;
};

export default TokenPrice;