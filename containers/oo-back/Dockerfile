# Copyright © 2020, Octave Online LLC
#
# This file is part of Octave Online Server.
#
# Octave Online Server is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published by
# the Free Software Foundation, either version 3 of the License, or (at your
# option) any later version.
#
# Octave Online Server is distributed in the hope that it will be useful, but
# WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
# or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU Affero General Public
# License for more details.
#
# You should have received a copy of the GNU Affero General Public License
# along with Octave Online Server.  If not, see
# <https://www.gnu.org/licenses/>.

ARG FULL_BASE_IMAGE
FROM $FULL_BASE_IMAGE

# Core tmpfs directories:
VOLUME \
	/run \
	/tmp

# Install dependencies, including Node.js
RUN yum install -y nodejs gcc-c++ make libicu-devel python2 && \
	npm config set prefix /workspace

# Copy the application code into the container
RUN mkdir -p /srv/oo/projects
COPY shared /srv/oo/projects/shared
COPY back-filesystem /srv/oo/projects/back-filesystem
COPY back-master /srv/oo/projects/back-master
COPY config*.hjson /srv/oo/projects/

# Build Node.js projects for oo-back
# Use npm ci to install deps from lockfiles
RUN \
	cd /srv/oo/projects/shared && npm ci && \
	cd /srv/oo/projects/back-filesystem && npm ci && \
	cd /srv/oo/projects/back-master && npm ci

CMD DEBUG=* node /srv/oo/projects/back-master/app.js
