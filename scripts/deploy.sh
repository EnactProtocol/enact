
#!/bin/bash
# move to project directory
cd ..
# Get version from package.json
VERSION=$(node -p "require('./package.json').version")
PACKAGE_NAME=$(node -p "require('./package.json').name")

echo "Building ${PACKAGE_NAME} version ${VERSION}..."

npm run build
npm pack

# Use the dynamically determined filename
npm install -g ./${PACKAGE_NAME}-${VERSION}.tgz

enact --help

npm uninstall -g ${PACKAGE_NAME}

# Then publish
npm publish