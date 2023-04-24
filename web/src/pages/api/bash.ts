// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from 'next'
import shell from 'shelljs'

type Data = {
  name: string
}

// this API route accepts a GET request with a query parameter named command
// the API runs the command using shelljs and returns the output
export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  let command: any = req.query.command
  if (command) {
    command = Array.isArray(command) ? command[0] : command
  }
  const output = shell.exec(command, { silent: true }).stdout
  res.status(200).json({ name: output })
}
