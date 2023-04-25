import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import config from '../../../config.json';

type Data = {
  tree: any[];
};

function buildTree(rootPath: string): any[] {
  const filesAndFolders = fs.readdirSync(rootPath);
  const tree = filesAndFolders.map((item) => {
    if(item === '.next' || item === 'node_modules' || item === '.git') return null;
    const itemPath = path.join(rootPath, item);
    const stats = fs.statSync(itemPath);

    if (stats.isDirectory()) {
      return {
        title: item,
        key: itemPath,
        type: 'directory',
        children: buildTree(itemPath),
      };
    } else {
      return {
        title: item,
        key: itemPath,
        type: 'file',
      };
    }
  });

  return tree.filter((item) => item !== null);
}

export default function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  const cwd = config.path;
  const tree = buildTree(cwd);

  res.status(200).json({ tree });
}