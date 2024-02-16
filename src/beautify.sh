#!/bin/bash

cd compiler
find . -type f \( -iname "*.js" -not -path "./node_modules/*" \) -exec bash -c 'for pathname do js-beautify "$pathname" -o "$pathname"; done' bash {} +

cd ../karousos_utils
find . -type f \( -iname "*.js" -not -path "./node_modules/*" \) -exec bash -c 'for pathname do js-beautify "$pathname" -o "$pathname"; done' bash {} +

cd ../server-lib
find . -type f \( -iname "*.js" -not -path "./node_modules/*" \) -exec bash -c 'for pathname do js-beautify "$pathname" -o "$pathname"; done' bash {} +

cd ../verifier-lib
find . -type f \( -iname "*.js" -not -path "./node_modules/*" \) -exec bash -c 'for pathname do js-beautify "$pathname" -o "$pathname"; done' bash {} +

cd ..
