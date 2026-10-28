import { execSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, rmSync, statSync, symlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const linkedRoot = join(root, 'node_modules', '@mentros', 'crsd-ui');
const linkedBundle = join(linkedRoot, 'fesm2022', 'mentros-crsd-ui.mjs');
const linkedTypes = join(linkedRoot, 'types', 'mentros-crsd-ui.d.ts');
const siblingLib = join(root, '..', 'CursedUiLibrary');
const siblingPkg = join(siblingLib, 'package.json');
const siblingDist = join(siblingLib, 'dist', 'ui');
const siblingBundle = join(siblingDist, 'fesm2022', 'mentros-crsd-ui.mjs');
const siblingSource = join(siblingLib, 'libs', 'ui', 'src', 'public-api.ts');

function mtime(path) {
  try {
    return statSync(path).mtimeMs;
  } catch {
    return 0;
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

function pointsAtSiblingDist() {
  if (!existsSync(linkedRoot)) {
    return false;
  }

  try {
    const stat = lstatSync(linkedRoot);
    if (!stat.isSymbolicLink()) {
      return false;
    }

    const resolved = statSync(linkedRoot);
    const distResolved = statSync(siblingDist);
    return resolved.dev === distResolved.dev && resolved.ino === distResolved.ino;
  } catch {
    return false;
  }
}

function linkLocalPackage() {
  const mentrosDir = join(root, 'node_modules', '@mentros');
  mkdirSync(mentrosDir, { recursive: true });

  if (existsSync(linkedRoot)) {
    rmSync(linkedRoot, { recursive: true, force: true });
  }

  const linkType = process.platform === 'win32' ? 'junction' : 'dir';
  symlinkSync(siblingDist, linkedRoot, linkType);
}

if (!existsSync(siblingPkg)) {
  if (existsSync(linkedBundle) && existsSync(linkedTypes)) {
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

if (!existsSync(siblingBundle)) {
  failMissingLibrary();
}

const installBroken =
  !existsSync(linkedBundle) ||
  !existsSync(linkedTypes) ||
  !pointsAtSiblingDist() ||
  mtime(siblingBundle) > mtime(linkedBundle);

if (installBroken) {
  console.log('Linking @mentros/crsd-ui -> ../CursedUiLibrary/dist/ui');
  linkLocalPackage();
}

if (!existsSync(linkedBundle) || !existsSync(linkedTypes)) {
  console.error('Could not link @mentros/crsd-ui after building the library.');
  process.exit(1);
}
