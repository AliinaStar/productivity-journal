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

module.exports = config;