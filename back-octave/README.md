Octave Online Server: GNU Octave Utilities
==========================================

This directory contains machinery for talking to the GNU Octave process.

The *oo-changesets* directory contains patches against GNU Octave to add features required for Octave Online.  The primary feature added is a new flag `--json-sock`, which uses a UNIX Socket for passing messages back and forth between the Octave process and the outside world.

The file *host.c* is a thin GNU Octave wrapper process that creates the UNIX Socket for talking to GNU Octave.  It reads messages from STDIN and marshals them into the UNIX Socket, and when it receives a message from the socket, it prints the message to STDOUT.

The *Makefile* is used for building *host.c* into an executable.

The file *octaverc.m* is the default site-wide octaverc file for Octave Online Server.  It is installed either into the Docker instance or into the current local server via the *install-site-m* make target in the top-level directory.
