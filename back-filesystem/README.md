Octave Online Server: Back Server, Filesystem Utilities
=======================================================

This directory contains the source code dealing with the filesystem for the Octave Online Server back server.

When using the SELinux backend, the code in this directory is run in the main event loop (Node.js process) along with the *back-master* code.  When the Docker backend is used, however, this code runs inside of a Docker container, while *back-master* runs outside of a Docker container.

This separation was done in order to make file permissions work correctly.  However, this separation is one reason why the Docker implementation is not able to handle as many concurrent sessions as the SELinux implementation.
