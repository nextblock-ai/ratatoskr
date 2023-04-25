import React from 'react';

interface TokenPriceProps {
  price: number;
}

const TokenPrice: React.FC<TokenPriceProps> = ({ price }) => {
  return (<p className="text-lg text-gray-800 mt-2">Price: {price}</p>)
};

export default TokenPrice;
