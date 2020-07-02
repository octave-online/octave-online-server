# Copyright © 2019, Octave Online LLC
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

######################################
# utils-gitd: essential Git services #
# ================================== #
# - git-daemon                       #
# - create-repo-service              #
######################################

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

# The repository root is expected to be mounted here:
VOLUME /srv/oo/git

####################
# MAIN BUILD RULES #
####################

RUN apt-get update && \
	apt-get install --no-install-recommends -y \
		git \
		nodejs

############
# METADATA #
############

# Ports:
# 3003 = create-repo-service
# 9418 = git-daemon
EXPOSE 3003/tcp 9418/tcp

##################
# CONFIGURATIONS #
##################

# Note: paths are relative to repository root.
COPY back-filesystem/git/create-repo-service.js /usr/local/bin/create-repo-service
COPY containers/utils-gitd/supervisord.conf /etc/supervisor/conf.d/oo.conf

RUN \
	useradd -m -u 1600 git && \
	chmod a+x /usr/local/bin/create-repo-service

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/oo.conf"]
