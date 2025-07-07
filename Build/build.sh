#!/bin/bash

# Define paths
SRC_DIR="./public"
DIST_DIR="./dist"
ASSETS_DIR="$DIST_DIR/assets"


# Copy robots.txt to dist/
cp "$SRC_DIR/robots.txt" "$DIST_DIR/"

# Copy favicon.ico and favicon.png to dist/assets/
cp "$SRC_DIR/favicon.ico" "$ASSETS_DIR/"
cp "$SRC_DIR/favicon.png" "$ASSETS_DIR/"

# Find and replace "/a with "a in dist/index.html
sed -i 's/\/a/a/g' "$DIST_DIR/index.html"

echo "Files copied successfully."
