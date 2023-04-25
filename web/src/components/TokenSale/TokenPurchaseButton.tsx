import React from 'react';

interface TokenPurchaseButtonProps {
  onClick: () => void;
}

// we use tailwind to style our button

const TokenPurchaseButton: React.FC<TokenPurchaseButtonProps> = ({ onClick }) => {
  return <button className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
   onClick={onClick}>Purchase</button>;
};

export default TokenPurchaseButton;