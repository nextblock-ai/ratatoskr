import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import config from '../../config';

function buildTree(rootPath: string): any[] {
  const filesAndFolders = fs.readdirSync(rootPath);
  const tree = filesAndFolders.map((item) => {
    const itemPath = path.join(rootPath, item);
    const stats = fs.statSync(itemPath);

    if (stats.isDirectory()) {
      return {
        name: item,
        type: 'directory',
        children: buildTree(itemPath),
      };
    } else {
      return {
        name: item,
        type: 'file',
      };
    }
  });

  return tree;
}

export default function handler(req: NextApiRequest, res: NextApiResponse<any>) {
  // get the request method
  const method = req.method;
  const cwd = config.path;

  if (method === 'GET') {
    let loc = req.query.path || ''
    loc = Array.isArray(loc) ? loc[0] : loc;
    if(fs.lstatSync(loc).isDirectory()) {
      const tree = buildTree(loc);
      res.status(200).json({ tree });
    } else {
      const file = fs.readFileSync(loc, 'utf8');
      res.status(200).json({ file });
    }
  } else if (method === 'POST') {
    const { filePath, fileContent } = req.body;
    if (!fs.existsSync(filePath)) {
      // error
      res.status(400).json({ message: 'File not found' });
    } else {
      fs.writeFileSync(filePath, fileContent);
      res.status(200).json({ message: 'File updated successfully' });
    }
  } else if (method === 'PUT') {
    const { filePath, fileContent } = req.body;
    if (fs.existsSync(filePath)) {
      // error
      res.status(400).json({ message: 'File already exists' });
    } else {
      fs.writeFileSync(filePath, fileContent);
      res.status(201).json({ message: 'File created successfully' });
    }
  } else if (method === 'DELETE') {
    const { filePath } = req.body;
    if (!fs.existsSync(filePath)) {
      // error
      res.status(400).json({ message: 'File not found' });
    } else {
      fs.unlinkSync(filePath);
      res.status(200).json({ message: 'File deleted successfully' });
    }
  } else {
    // Unsupported method
    res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
    res.status(405).end(`Method ${method} Not Allowed`);
  }
}