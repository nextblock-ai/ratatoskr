import dynamic from 'next/dynamic'

const TokenSalePage = dynamic(() => import("@/components/TokenSale/TokenSalePage"), {
  ssr: false,
});

export default function Home() {
  return (
    <TokenSalePage />
  )
}
