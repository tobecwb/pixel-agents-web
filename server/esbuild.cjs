const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

function copyDir(src, dst) {
  if (!fs.existsSync(src)) return false;
  if (fs.existsSync(dst)) {
    fs.rmSync(dst, { recursive: true });
  }
  fs.cpSync(src, dst, { recursive: true });
  return true;
}

async function main() {
  const buildOptions = {
    entryPoints: ['src/index.ts'],
    bundle: true,
    format: 'cjs',
    minify: production,
    sourcemap: !production,
    platform: 'node',
    target: 'node18',
    outfile: 'dist/index.cjs',
    external: ['ws', 'pngjs'],
    banner: {
      js: '#!/usr/bin/env node',
    },
  };

  if (watch) {
    const ctx = await esbuild.context(buildOptions);
    await ctx.watch();
    console.log('✓ Server watching for changes...');
  } else {
    await esbuild.build(buildOptions);
    console.log('✓ Server bundled → dist/index.cjs');
  }

  // Copy assets
  const assetsSrc = path.join(__dirname, '..', 'webview-ui', 'public', 'assets');
  const assetsDst = path.join(__dirname, 'dist', 'assets');
  if (copyDir(assetsSrc, assetsDst)) {
    console.log('✓ Copied assets/ → dist/assets/');
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
