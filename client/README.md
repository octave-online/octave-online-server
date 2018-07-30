Octave Online Server: Client
============================

This directory contains the web frontend code for Octave Online.

## Installation

Before you can run any of the build scripts, you will need to install Node.JS.

Once Node.JS is installed, install the Octave Online Client dependencies like so:

    npm install
    npm run bower install

Note:
**npm** is used to manage the build system dependencies.
**Bower** is a front-end dependency manager.

Finally, you need to create a file *config.json* in this directory.  Use the same format as in the Octave Online Server: Back Server project.  If both projects are running on the same host, you can use a symlink.

## Building

To build the distribution version of Octave Online Client, simply run Grunt:

    npm run grunt

**Grunt** is a build system, kind-of like **make** or **Ant** but for JavaScript.

While you are developing, you can run `grunt watch` to automatically compile the TypeScript and SCSS when changes are made.
