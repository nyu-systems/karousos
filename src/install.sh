#!/bin/bash

cd compiler
rm -r node_modules
cp -r ../backup-node-modules/compiler node_modules

cd ../server-lib
rm -r node_modules
cp -r ../backup-node-modules/server-lib node_modules

cd ../verifier-lib
rm -r node_modules
cp -r ../backup-node-modules/verifier-lib node_modules

cd ../runServer
rm -r node_modules
cp -r ../backup-node-modules/runServer node_modules

cd ../runVerifier
rm -r node_modules
cp -r ../backup-node-modules/runVerifier node_modules

cd ../karousos_utils
rm -r node_modules
cp -r ../backup-node-modules/karousos_utils node_modules

cd ../initWiki
rm -r node_modules
cp -r ../backup-node-modules/initWiki node_modules

cd ..
