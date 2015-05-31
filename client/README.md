Octave Online Client
====================

This repository contains the web frontend code for Octave Online.

## Installation

Before you can run any of the build scripts, you will need to install Node.JS.

Once Node.JS is installed, you will need Grunt, Bower, and Compass.

    npm install -g grunt-cli
    npm install -g bower
    gem install compass

Note: [Compass](http://compass-style.org/) requires that you have a Ruby runtime running on your machine.  If you don't want to spend the time installing a Ruby runtime, you can manually download *css/main.css* and *css/themes/fire.css* from the web site into the *app/css* and *dist/css* directories (which you will need to make), if you don't plan on customizing the CSS.  Another alternative if you plan on customizing the CSS is to download a program like [Scout](http://mhs.github.io/scout-app/) and let that compile the SCSS code for you.  You need to choose *app/scss* as your source directory and *app/css* or *dist/css* as your output directory.

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
