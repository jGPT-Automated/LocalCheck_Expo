#!/bin/sh
set -e

cd "$CI_WORKSPACE"

brew install pnpm@10.13.1 2>/dev/null || brew upgrade pnpm 2>/dev/null || true
pnpm install --frozen-lockfile

npx expo prebuild --platform ios --no-install

cd ios
pod install
