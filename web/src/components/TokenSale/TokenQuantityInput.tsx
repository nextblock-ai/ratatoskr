import React, { ChangeEvent } from 'react';

interface TokenQuantityInputProps {
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

const TokenQuantityInput: React.FC<TokenQuantityInputProps> = ({ onChange }) => {
  return (
    <input type="number" min="1" onChange={onChange} placeholder="Quantity" className="border border-gray-300 px-3 py-2 rounded mt-4" />
  );
};

export default TokenQuantityInput;
