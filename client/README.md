Octave Online Client
====================

This repository contains the web frontend code for Octave Online.

## Installation

Before you can run any of the build scripts, you will need to install Node.JS.

Once Node.JS is installed, you will need Grunt and Bower.

    npm install -g grunt-cli
    npm install -g bower

Now, install the Octave Online Client dependencies like so:

    npm install
    bower install

Note:
**npm** is used to manage the build system dependencies.
**Bower** is a front-end dependency manager.

## Building

To build the distribution version of Octave Online Client, simply run Grunt:

    grunt

**Grunt** is a build system, kind-of like **make** or **Ant** but for JavaScript.

While you are developing, you can run `grunt watch` to automatically compile the TypeScript and SCSS when changes are made.
