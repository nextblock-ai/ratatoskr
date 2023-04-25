import React, { useState } from "react";
import TokenSaleInfo from "./TokenSaleInfo";
import TokenSaleForm from "./TokenSaleForm";

const TokenSalePage: React.FC = () => {
    const [quantity, setQuantity] = useState(0);

    const handleQuantityChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setQuantity(parseInt(event.target.value));
    };

    const handlePurchaseClick = () => {
        alert(`Purchased ${quantity} tokens!`);
    };

    return (
        <div className="max-w-2xl mx-auto py-8 px-4">
        <TokenSaleInfo
            name="Example Token"
            description="This is an example token."
            details="More details about the token."
            imageUrl="https://placehold.co/512x512/orange/white"
            price={10}
        />
        <TokenSaleForm
            onQuantityChange={handleQuantityChange}
            onPurchaseClick={handlePurchaseClick}
        />
        </div>
    );
};

export default TokenSalePage;
