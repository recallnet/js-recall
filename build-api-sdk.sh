cd apps/api
npm run generate-openapi
cd ../..

cd packages/api-sdk
npm run build
speakeasy run
cd ../..
