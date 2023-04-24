import React from 'react';

interface TokenPurchaseButtonProps {
  onClick: () => void;
}

const TokenPurchaseButton: React.FC<TokenPurchaseButtonProps> = ({ onClick }) => {
  return <button onClick={onClick}>Purchase</button>;
};

export default TokenPurchaseButton;