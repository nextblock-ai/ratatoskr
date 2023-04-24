// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import { commitCompletion } from '@/utils'
import type { NextApiRequest, NextApiResponse } from 'next'

type Data = {
  fileUpdates: string[],
  consoleUpdates: string[],
}

// this API route accepts a GET request with a query parameter named command
// the API runs the command using shelljs and returns the output
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data | { name: string }>
) {
  // get the request method 
  const method = req.method
  if(!method || method !== 'POST') {
    res.status(405).json({ name: 'Method Not Allowed' })
    return
  }
  let commitData: any = req.body
  if(!commitData) {
    res.status(400).json({ name: 'Bad Request' })
    return
  }
  if(!commitData.updatedFilePatches || !commitData.bashCommands || !commitData.updatedFileExplanations || !commitData.updatedFileDiffs) {
    res.status(400).json({ name: 'Bad Request' })
    return
  }
  const result = await commitCompletion(commitData);
  res.status(200).json({ ...result })
}
