import { getCompletion } from '@/gpt';
import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';

// this API route accepts a GET request with a query parameter named path
// and calls the chdir() function to change the current working directory
export default function handler(req: NextApiRequest, res: NextApiResponse<any>) {
  let path: any = req.query.path;
  if (path) {
    path = Array.isArray(path) ? path[0] : path;
  }
  const fileData = fs.readFileSync(path, 'utf8');
  getCompletion([
    {
      role: 'system',
      content: 'You are an expert code summarization bot. You summarize source code into a short description and usage examples if appropriate',
    },
    {
      role: 'user',
      content: 'Summarize the source code below into a short description and a usage example if appropriate:\n\n' + fileData,
    }
  ], {
    model: 'gpt-3.5-turbo',
    max_tokens: 1024,
    temperature: 0.01,
  }).then((completion: any) => {
    res.status(200).json({ message: completion });
  });
}

