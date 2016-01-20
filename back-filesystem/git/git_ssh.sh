#!/bin/bash

# Get the directory of this file
# http://stackoverflow.com/a/246128/1407170
KEY_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Specify the private key file with the -i option
ssh -i $KEY_DIR/key.pem $1 $2
