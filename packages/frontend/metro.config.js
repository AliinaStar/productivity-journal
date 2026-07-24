const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Для monorepo - дивимося на всі workspace packages.
// Додаємо workspaceRoot ДО дефолтних watchFolders, а не замінюємо їх, інакше
// expo-doctor скаржиться, що частина дефолтних записів зникла.
config.watchFolders = [...config.watchFolders, workspaceRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

config.resolver.platforms = ['ios', 'android', 'web'];

// Bundle Markdown files as plain strings (see md-transformer.js) so the privacy
// policy can be imported straight from docs/privacy-policy.md.
config.transformer.babelTransformerPath = require.resolve('./md-transformer.js');
config.resolver.sourceExts.push('md');

module.exports = config;