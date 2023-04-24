import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse<any>) {
  const cwd = process.cwd();
  res.status(200).json({ cwd });
}