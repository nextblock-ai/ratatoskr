import React from 'react';
import TokenQuantityInput from './TokenQuantityInput';
import TokenPurchaseButton from './TokenPurchaseButton';

interface TokenSaleFormProps {
  onQuantityChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onPurchaseClick: () => void;
}

const TokenSaleForm: React.FC<TokenSaleFormProps> = ({
  onQuantityChange,
  onPurchaseClick,
}) => {
  return (
    <div>
      <TokenQuantityInput onChange={onQuantityChange} />
      <TokenPurchaseButton onClick={onPurchaseClick} />
    </div>
  );
};

export default TokenSaleForm;