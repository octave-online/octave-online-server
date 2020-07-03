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

###############
# BOILERPLATE #
###############

FROM ubuntu:bionic

WORKDIR /root

# Disable all prompts when using apt-get
ENV DEBIAN_FRONTEND=noninteractive

# Core tmpfs directories:
VOLUME \
	/run \
	/tmp

# Essential setup
RUN \
	mkdir -p /srv/oo && \
	apt-get update && \
	apt-get install -y \
		curl \
		ca-certificates \
		openssl \
		apt-transport-https \
		gnupg \
		supervisor

# NodeSource
RUN \
	curl -s https://deb.nodesource.com/gpgkey/nodesource.gpg.key | apt-key add - && \
	echo 'deb https://deb.nodesource.com/node_10.x bionic main' > /etc/apt/sources.list.d/nodesource.list && \
	echo 'deb-src https://deb.nodesource.com/node_10.x bionic main' >> /etc/apt/sources.list.d/nodesource.list

####################
# MAIN BUILD RULES #
####################

RUN apt-get update && \
	apt-get install --no-install-recommends -y \
		nodejs \
		git

# Install oo-front
# Note: paths are relative to repository root
RUN mkdir -p /srv/oo/projects
COPY config*.hjson /srv/oo/projects/
COPY shared /srv/oo/projects/shared
COPY client /srv/oo/projects/client
COPY front /srv/oo/projects/front
RUN \
	cd /srv/oo/projects/shared && \
		npm ci && \
	cd /srv/oo/projects/front && \
		npm ci && \
		npm install --only=dev && \
		npm run build && \
	cd /srv/oo/projects/client && \
		npm ci && \
		npm install --only=dev && \
		npm run bower -- --allow-root install && \
		npm run grunt

############
# METADATA #
############

# Ports:
# 8080 = express
EXPOSE 8080/tcp

##################
# CONFIGURATIONS #
##################

CMD DEBUG=oo:* node /srv/oo/projects/front/dist/app.js
