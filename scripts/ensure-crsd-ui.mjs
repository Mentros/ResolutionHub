import { execSync } from 'node:child_process';
import { existsSync, lstatSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const linkedRoot = join(root, 'node_modules', '@mentros', 'crsd-ui');
const linkedBundle = join(linkedRoot, 'fesm2022', 'mentros-crsd-ui.mjs');
const siblingLib = join(root, '..', 'CursedUiLibrary');
const siblingPkg = join(siblingLib, 'package.json');
const siblingBundle = join(siblingLib, 'dist', 'ui', 'fesm2022', 'mentros-crsd-ui.mjs');
const siblingSource = join(siblingLib, 'libs', 'ui', 'src', 'public-api.ts');

function mtime(path) {
  try {
    return statSync(path).mtimeMs;
  } catch {
    return 0;
  }
}

function isLinkedInstall() {
  try {
    return existsSync(linkedRoot) && lstatSync(linkedRoot).isSymbolicLink();
  } catch {
    return false;
  }
}

function failMissingLibrary() {
  console.error(
    [
      'Missing @mentros/crsd-ui.',
      'Clone CursedUiLibrary next to ResolutionHub, then run:',
      '  cd ../CursedUiLibrary && npm install && npm run build',
      '  cd ../ResolutionHub && npm install',
    ].join('\n'),
  );
  process.exit(1);
}

if (!existsSync(siblingPkg)) {
  if (existsSync(linkedBundle)) {
    process.exit(0);
  }
  failMissingLibrary();
}

const distStale =
  !existsSync(siblingBundle) || mtime(siblingSource) > mtime(siblingBundle);

if (distStale) {
  console.log('Building @mentros/crsd-ui in ../CursedUiLibrary...');
  execSync('npm run build', { cwd: siblingLib, stdio: 'inherit' });
}

const copiedInstallIsStale =
  existsSync(linkedBundle) &&
  !isLinkedInstall() &&
  mtime(siblingBundle) > mtime(linkedBundle);

const needsInstall = !existsSync(linkedBundle) || copiedInstallIsStale;

if (needsInstall) {
  console.log('Linking @mentros/crsd-ui...');
  execSync('npm install', { cwd: root, stdio: 'inherit' });
}

if (!existsSync(linkedBundle)) {
  console.error('Could not install @mentros/crsd-ui after building the library.');
  process.exit(1);
}
