Containers for Octave Online Server
===================================

This directory contains up-to-date container definitions for various pieces of Octave Online Server.

Inside each directory, you will find at least two files:

- Dockerfile: The scripts to build the container.
- cloudbuild.yaml: For hooking up with Google Cloud Build.  You can ignore this file unless you want to use Google Cloud Build to build the containers.

Some directories contain additional assets used for building the respective containers.

**Important:** You should build all of the containers from the repository root and specify the Dockerfile via the `--file` option to `docker build`.

The containers are:

- octave-\*: GNU Octave containers
- utils-gitd: Essential Git file server
- oo-gith: Frontend for the human-friendly file history viewer
- utils-gith: Backend for the human-friendly file history viewer

## Building the GNU Octave Containers

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
	--file=containers/octave-deps/Dockerfile \
	.
$ docker build \
	--build-arg=FULL_BASE_IMAGE=octave-deps:$SHORT_SHA \
	--tag=octave-stable:$SHORT_SHA \
	--file=containers/octave-stable/Dockerfile \
	.
$ docker build \
	--build-arg=FULL_BASE_IMAGE=octave-stable:$SHORT_SHA \
	--tag=octave-pkg:$SHORT_SHA \
	--file=containers/octave-pkg/Dockerfile \
	.
$ docker build \
	--build-arg=FULL_BASE_IMAGE=octave-pkg:$SHORT_SHA \
	--tag=octave-oo:$SHORT_SHA \
	--file=containers/octave-oo/Dockerfile \
	.
```

There are also *cloudbuild.yaml* files in each directory in case you want to use the Google Cloud Build service to build the Docker images.  With these files, you build each image in sequence, and when you get a clean build, set that image's tag as the `_BASE_REV` substitution on the subsequent image.  Each tag gets built based on the previous tag, so the tag in the end will have four short SHAs in sequence: "octave-oo:aaaaaaa-bbbbbbb-ccccccc-ddddddd"

