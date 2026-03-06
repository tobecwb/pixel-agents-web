#!/bin/bash
# Run Pixel Agents from anywhere
# Usage: ./pixel-agents.sh [start|dev|build|install]

# Resolve symlinks to find the real script directory
SOURCE="$0"
while [ -L "$SOURCE" ]; do
  DIR="$(cd "$(dirname "$SOURCE")" && pwd)"
  SOURCE="$(readlink "$SOURCE")"
  [[ "$SOURCE" != /* ]] && SOURCE="$DIR/$SOURCE"
done
DIR="$(cd "$(dirname "$SOURCE")" && pwd)"

case "${1:-start}" in
  install)
    echo "Installing dependencies..."
    (cd "$DIR" && npm install)
    (cd "$DIR/server" && npm install)
    (cd "$DIR/webview-ui" && npm install)
    echo "Building..."
    (cd "$DIR" && npm run build:server)
    ;;
  build)
    echo "Building..."
    (cd "$DIR" && npm run build:server)
    ;;
  start)
    if [ ! -f "$DIR/server/dist/index.cjs" ]; then
      echo "Server not built yet. Run './pixel-agents.sh install' first."
      exit 1
    fi
    echo "Starting Pixel Agents..."
    node "$DIR/server/dist/index.cjs" --open "${@:2}"
    ;;
  dev)
    echo "Starting dev server..."
    (cd "$DIR" && npm run dev)
    ;;
  *)
    echo "Usage: pixel-agents [start|dev|build|install]"
    echo "  start   - Build and start server (default)"
    echo "  dev     - Start dev server with hot reload"
    echo "  build   - Build for production"
    echo "  install - Install all dependencies"
    exit 1
    ;;
esac
