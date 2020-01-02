Octave Online Server: Back Server, Filesystem Utilities
=======================================================

This directory contains the source code dealing with the filesystem for the Octave Online Server back server.  It also contains scripts for interacting with the Git file server.

## Git File Server

The subdirectory *git* contains files for running a Git file server for Octave Online Server.

*gitd.service* is a systemd service that enables the Git daemon with the repository root at */srv/oo/git*, which is expected to contain *repos* and *buckets* subdirectories that are read/write to the *git* user.

*create-repo.service* is a systemd service that runs a tiny server for creating empty repositories.  It has the same path expectations as *gitd.service*.  It invokes the path */usr/local/bin/create-repo-service*, which is expected to be a copy of *create-repo-service.js* from this project.

**CAUTION:** Neither *gitd.service* nor *create-repo.service* require any authentication.  You should therefore run these services behind a firewall.

## History

When using the SELinux backend, the code in this directory is run in the main event loop (Node.js process) along with the *back-master* code.  When the Docker backend is used, however, this code runs inside of a Docker container, while *back-master* runs outside of a Docker container.

This separation was done in order to make file permissions work correctly.  However, this separation is one reason why the Docker implementation is not able to handle as many concurrent sessions as the SELinux implementation.
