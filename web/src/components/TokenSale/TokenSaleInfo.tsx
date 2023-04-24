import React from 'react';
import TokenName from './TokenName';
import TokenDescription from './TokenDescription';
import TokenDetails from './TokenDetails';
import TokenImage from './TokenImage';
import TokenPrice from './TokenPrice';

interface TokenSaleInfoProps {
  name: string;
  description: string;
  details: string;
  imageUrl: string;
  price: number;
}

const TokenSaleInfo: React.FC<TokenSaleInfoProps> = ({
  name,
  description,
  details,
  imageUrl,
  price,
}) => {
  return (
    <div>
      <TokenName name={name} />
      <TokenDescription description={description} />
      <TokenDetails details={details} />
      <TokenImage imageUrl={imageUrl} />
      <TokenPrice price={price} />
    </div>
  );
};

export default TokenSaleInfo;