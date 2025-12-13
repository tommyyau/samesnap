#!/usr/bin/env bash
set -euo pipefail

NVM_VERSION="v0.39.7"

if [ -d "$HOME/.nvm" ]; then
  echo "nvm already installed – updating to ${NVM_VERSION}..."
  cd "$HOME/.nvm"
  git fetch --tags origin
  git checkout "${NVM_VERSION}"
  cd -
else
  echo "Installing nvm ${NVM_VERSION}..."
  curl -o- "https://raw.githubusercontent.com/nvm-sh/nvm/${NVM_VERSION}/install.sh" | bash
fi

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

nvm install 20
nvm alias default 20
nvm use 20

node -v
npm -v
