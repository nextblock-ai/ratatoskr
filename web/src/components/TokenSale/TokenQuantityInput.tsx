import React, { ChangeEvent } from 'react';

interface TokenQuantityInputProps {
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

const TokenQuantityInput: React.FC<TokenQuantityInputProps> = ({ onChange }) => {
  return (
    <input type="number" min="1" onChange={onChange} placeholder="Quantity" />
  );
};

export default TokenQuantityInput;