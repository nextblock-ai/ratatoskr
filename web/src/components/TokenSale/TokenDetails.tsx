import React from 'react';

interface TokenDetailsProps {
  details: string;
}

const TokenDetails: React.FC<TokenDetailsProps> = ({ details }) => {
  return <p>{details}</p>;
};

export default TokenDetails;