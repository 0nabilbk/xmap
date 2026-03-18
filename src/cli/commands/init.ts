import { existsSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pc from 'picocolors';

const CONFIG_TEMPLATE = `import { defineConfig } from 'xmap';

export default defineConfig({
  url: 'http://localhost:3000',
  startPath: '/',
  maxPages: 100,
  ignore: [
    '/api/**',
    '/_next/**',
    '/static/**',
  ],
  auth: {
    loginPath: '/login',
  },
  // sections: {
  //   dashboard: { label: 'Dashboard', color: '#171717', routes: ['/dashboard/**'] },
  // },
  // workflows: [],
  iframe: {
    width: 1440,
    height: 900,
    scale: 0.22,
  },
});
`;

export async function init() {
  const cwd = process.cwd();
  const configPath = resolve(cwd, 'xmap.config.ts');

  // Write config
  if (existsSync(configPath)) {
    console.log(pc.yellow('xmap.config.ts already exists, skipping.'));
  } else {
    writeFileSync(configPath, CONFIG_TEMPLATE, 'utf8');
    console.log(pc.green('Created xmap.config.ts'));
  }

  // Add .xmap/ to .gitignore
  const gitignorePath = resolve(cwd, '.gitignore');
  if (existsSync(gitignorePath)) {
    const content = readFileSync(gitignorePath, 'utf8');
    if (!content.includes('.xmap/')) {
      appendFileSync(gitignorePath, '\n# xmap crawl output\n.xmap/\n');
      console.log(pc.green('Added .xmap/ to .gitignore'));
    } else {
      console.log(pc.dim('.xmap/ already in .gitignore'));
    }
  } else {
    writeFileSync(gitignorePath, '# xmap crawl output\n.xmap/\n', 'utf8');
    console.log(pc.green('Created .gitignore with .xmap/'));
  }

  console.log();
  console.log(pc.bold('Next steps:'));
  console.log(`  1. Edit ${pc.cyan('xmap.config.ts')} with your app's URL`);
  console.log(`  2. Start your app`);
  console.log(`  3. Run ${pc.cyan('xmap crawl')} to discover screens`);
  console.log(`  4. Run ${pc.cyan('xmap dev')} to view the map`);
}
