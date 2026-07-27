const fs = require("fs");
const path = require("path");

const workspaceRoot = path.resolve(__dirname, "..");
const mobileRoot = path.join(workspaceRoot, "artifacts/mobile");
const workspaceNodeModules = fs.realpathSync(
  path.join(workspaceRoot, "node_modules"),
);
const mobileNodeModules = fs.realpathSync(
  path.join(mobileRoot, "node_modules"),
);
const { getDefaultConfig } = require(
  path.join(mobileNodeModules, "expo/metro-config"),
);

const config = getDefaultConfig(mobileRoot);

config.watchFolders = [
  workspaceRoot,
  mobileNodeModules,
  workspaceNodeModules,
];
config.resolver.nodeModulesPaths = [
  mobileNodeModules,
  workspaceNodeModules,
];
config.resolver.unstable_enableSymlinks = true;
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  "@workspace/api-client-react": path.join(
    workspaceRoot,
    "lib/api-client-react",
  ),
};

module.exports = config;
