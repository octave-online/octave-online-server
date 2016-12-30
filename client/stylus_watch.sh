#!/bin/bash
# Small script to run Stylus in live watch mode.  Useful when editing Stylus files.
# You must have Stylus and Kouto-Swiss installed: npm install -g stylus kouto-swiss
# Note that the SVG icons won't work with this method.  You must use "grunt stylus".

stylus --watch --use kouto-swiss -o app/css/themes app/styl/themes
