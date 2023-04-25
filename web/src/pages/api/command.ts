// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import { commandLoop } from '@/command'
import type { NextApiRequest, NextApiResponse } from 'next'

// this API route accepts a GET request with a query parameter named command
// the API runs the command using shelljs and returns the output
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<any>
) {
  let command: any = req.body
  command = Array.isArray(command) ? command[0].command.trim() : command.command.trim()
  console.log(`Received command: ${command}`)
  const output = await commandLoop(command)
  res.status(200).json({ ...output })
}
