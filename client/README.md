Octave Online Server: Client
============================

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

Octave Online Server is licensed under the [GNU Affero General Public License](https://en.wikipedia.org/wiki/Affero_General_Public_License).

> Octave Online Server is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
>
> Octave Online Server is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU Affero General Public License for more details.

A copy of the license can be found in COPYING.

Note: You may contact webmaster@octave-online.net to inquire about other options for licensing Octave Online Server.
