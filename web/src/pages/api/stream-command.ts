// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from 'next'
import { getCompletion } from '@/gpt'

// this API route accepts a GET request with a query parameter named command
// the API runs the command using shelljs and returns the output
export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<any>
) {

}
