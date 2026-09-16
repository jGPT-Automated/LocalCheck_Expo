#!/bin/sh
set -e

cd "$CI_WORKSPACE"

corepack enable
corepack prepare pnpm@10.13.1 --activate
pnpm install --frozen-lockfile

npx expo prebuild --platform ios --no-install

cd ios
pod install
