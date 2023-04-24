// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from 'next'
import { getCompletion } from '@/gpt'

// this API route accepts a GET request with a query parameter named command
// the API runs the command using shelljs and returns the output
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<any>
) {
  // get request method
  const method = req.method
  if(method === 'POST') {
    console.log('MESSAGES', req.body.messages)
    console.log('MESSAGES', req.body.messages[0])
    const complete = await getCompletion(req.body.messages);
    res.status(200).json({ result: complete })
  } else if(method === 'GET') {
    const complete = await getCompletion(req.query.q);
    res.status(200).json({ result: complete })
  }
  else {
    res.status(403).json({ error: 'Invalid request method' })
  }
}
