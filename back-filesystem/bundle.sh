#/bin/bash

if [[ -e bundle ]]; then
	rm -rf bundle;
fi

mkdir bundle;
cp -rL node_modules bundle;
cp -rL src bundle;
cp -rL git bundle;
cp app.js bundle;
cp package.json bundle;
cp Dockerfile bundle;

docker build -t oo/files bundle;

rm -rf bundle;
