# Copyright © 2018, Octave Online LLC
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

# Install dependencies from yum
RUN yum install -y git libicu-devel gcc-c++ make

# Set up Git authentication
ENV GIT_SSH $DIR/git/git_ssh.sh
RUN mkdir ~/.ssh && \
	ssh-keyscan -t rsa %GIT_HOST% >> ~/.ssh/known_hosts

# Make git dir
RUN mkdir -p %GIT_DIR%

# Copy package.json and npm install
COPY back-filesystem/package.json $DIR/
RUN cd $DIR && npm install

# Copy remaining source files
COPY back-filesystem $DIR
