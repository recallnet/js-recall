#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e
# Pipelines return the exit status of the last command to exit with a non-zero status
set -o pipefail

# GitHub details
if [ -n "${GITHUB_TOKEN}" ]; then
  REPO_URL="https://${GITHUB_TOKEN}@github.com/recallnet/fonts.git"
else
  REPO_URL="git@github.com:recallnet/fonts.git"
fi
FONTS_DIR=""
OUTPUT_DIR="src/fonts"
OUTPUT_FILE="src/index.ts"

rm -rf src

# Create output directory if it doesn't exist
mkdir -p "${OUTPUT_DIR}"

# Only proceed if PRIVATE_FONTS environment variable is set
if [ -n "${PRIVATE_FONTS}" ] && [ "${PRIVATE_FONTS}" != "false" ] && [ "${PRIVATE_FONTS}" != "0" ]; then
  # Create temp directory
  TEMP_DIR=$(mktemp -d)

  # Clone repository
  git clone --depth 1 "${REPO_URL}" "${TEMP_DIR}"

  # Copy font files
  cp "${TEMP_DIR}/${FONTS_DIR}"/*.{woff2,woff} "${OUTPUT_DIR}/"

  # Clean up
  rm -rf "${TEMP_DIR}"

  # Count the number of files copied
  FONT_COUNT=$(find "${OUTPUT_DIR}" -type f -name "*.woff*" | wc -l)
  if [ "$FONT_COUNT" -eq 1 ]; then
    FILES_WORD="file"
  else
    FILES_WORD="files"
  fi
  echo "${FONT_COUNT} font ${FILES_WORD} downloaded to ${OUTPUT_DIR}."

  cp scripts/private-fonts.ts.template "${OUTPUT_FILE}"

  echo "Copied private fonts TS template to ${OUTPUT_FILE}."
else
  cp scripts/open-fonts.ts.template "${OUTPUT_FILE}"

  echo "Copied open fonts TS template to ${OUTPUT_FILE}."
fi
