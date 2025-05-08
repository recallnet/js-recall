# This script generates the competition api openapi spec json file
# then generates the api sdk from the json spec

cd apps/api
npm run generate-docs

cd ../../packages/api-sdk
speakeasy run

cd ../../
# TODO: we have to run fix the formatting because both generators result is text that does not pass our lints
npm run format
