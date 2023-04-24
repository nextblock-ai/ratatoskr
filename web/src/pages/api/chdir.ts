import type { NextApiRequest, NextApiResponse } from 'next';

// this API route accepts a GET request with a query parameter named path
// and calls the chdir() function to change the current working directory
export default function handler(req: NextApiRequest, res: NextApiResponse<any>) {
  let path: any = req.query.path;
  if (path) {
    path = Array.isArray(path) ? path[0] : path;
  }
  process.chdir(path);
  res.status(200).json({ message: 'ok' });
}

