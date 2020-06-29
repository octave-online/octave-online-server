Octave Online Server: GNU Octave Utilities
==========================================

This directory contains machinery for talking to the GNU Octave process.

The *containers* directory contains up-to-date Dockerfiles for building GNU Octave with the custom patch sets.  Read more below.

The *oo-changesets* directory contains patches against GNU Octave to add features required for Octave Online.  The primary feature added is a new flag `--json-sock`, which uses a UNIX Socket for passing messages back and forth between the Octave process and the outside world.

The file *host.c* is a thin GNU Octave wrapper process that creates the UNIX Socket for talking to GNU Octave.  It reads messages from STDIN and marshals them into the UNIX Socket, and when it receives a message from the socket, it prints the message to STDOUT.

The *Makefile* is used for building *host.c* into an executable.

The file *octaverc.m* is the default site-wide octaverc file for Octave Online Server.  It is installed either into the Docker instance or into the current local server via the *install-site-m* make target in the top-level directory.

## Building the Containers

There are four containers that are intended to be built in sequence, each one depending on the previous one.  The order is:

1. octave-deps (install build dependencies)
2. octave-stable (build vanilla GNU Octave from source)
3. octave-pkg (build packages)
4. octave-oo (build extensions for Octave Online Server)

Example commands to build these four containers in sequence:

```bash
# Run these commands from the top level directory
$ export SHORT_SHA=$(git rev-parse HEAD | cut -c 1-7)
$ docker build \
	--tag=octave-deps:$SHORT_SHA \
	--file=back-octave/containers/octave-deps/Dockerfile \
	.
$ docker build \
	--build-arg=FULL_BASE_IMAGE=octave-deps:$SHORT_SHA \
	--tag=octave-stable:$SHORT_SHA \
	--file=back-octave/containers/octave-stable/Dockerfile \
	.
$ docker build \
	--build-arg=FULL_BASE_IMAGE=octave-stable:$SHORT_SHA \
	--tag=octave-pkg:$SHORT_SHA \
	--file=back-octave/containers/octave-pkg/Dockerfile \
	.
$ docker build \
	--build-arg=FULL_BASE_IMAGE=octave-pkg:$SHORT_SHA \
	--tag=octave-oo:$SHORT_SHA \
	--file=back-octave/containers/octave-oo/Dockerfile \
	.
```

There are also *cloudbuild.yaml* files in each directory in case you want to use the Google Cloud Build service to build the Docker images.  With these files, you build each image in sequence, and when you get a clean build, set that image's tag as the `_BASE_REV` substitution on the subsequent image.  Each tag gets built based on the previous tag, so the tag in the end will have four short SHAs in sequence: "octave-oo:aaaaaaa-bbbbbbb-ccccccc-ddddddd"
