#!/bin/sh
set -e

cd "$CI_WORKSPACE"

# Xcode Cloud images don't include Node.js by default.
# https://www.richinfante.com/2024/11/18/running-expo-prebuild-in-xcode-cloud
brew install node

corepack enable
corepack prepare pnpm@10.13.1 --activate
pnpm install --frozen-lockfile

# Xcode Cloud sets CI=TRUE (uppercase), which crashes Expo's env parsing
# ("GetEnv.NoBoolean: TRUE is not a boolean"). Override it for this call.
CI="true" npx expo prebuild --platform ios --no-install

cd ios
pod install
