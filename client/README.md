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

## License

Copyright (c) 2015 Shane Carr

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to use, copy, merge, and modify the Software, subject to the following conditions: The above copyright notice and this License shall be included in all copies or substantial portions of the Software.

Persons obtaining a copy of the Software may not publish, distribute, sublicense, and/or sell the Software or substantial portions of the Software under the terms of this License.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
