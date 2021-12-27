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

ARG FULL_BASE_IMAGE
FROM $FULL_BASE_IMAGE

# Enlist and Configure the correct Octave revision
### 4.2.1 ###
# RUN hg clone --insecure -r b9d482dd90f3 http://www.octave.org/hg/octave

### 5.2-rc ###
# RUN hg clone --insecure -r 56dd7419d7aa http://www.octave.org/hg/octave

### 6.0.1 ###
# RUN hg clone --insecure -r 9e7b2625e574 http://www.octave.org/hg/octave

### 6.0.1, after fix to bug #58698 ###
# RUN hg clone --insecure -r 171a2857d6d1 http://www.octave.org/hg/octave

### 6.4.0 ###
RUN hg clone --insecure -r 8d7671609955 http://www.octave.org/hg/octave

### 7.0.1 ###
# RUN hg clone --insecure -r 117ebe363f56 http://www.octave.org/hg/octave

RUN cd octave && \
	./bootstrap && \
	mkdir build-oo

### 4.0.1-rc1 ###
# RUN	cd octave/build-oo && \
# 	../configure --disable-readline --disable-gui --disable-docs

### 4.2.1 ###
# Note: set GNUPLOT=... if you are using a custom gnuplot!
# RUN cd octave/build-oo && \
# 	../configure --disable-readline --disable-docs --disable-atomic-refcount --without-qt

### 5.2-rc ###
# Note: rsvg-convert is not to be found in the CentOS repos, but it is not really necessary for a command-line build, so replace it with "echo"
# RUN cd octave/build-oo && \
# 	RSVG_CONVERT=echo ICOTOOL=echo ../configure --disable-readline --disable-docs --disable-atomic-refcount --without-qt --without-opengl

### 6.4.0 ###
### 7.0.1 ###
RUN cd octave/build-oo && \
	ICOTOOL=echo ../configure --disable-readline --disable-docs --without-qt --without-opengl

# Build Octave
# This is the slowest part of the Dockerfile
RUN cd octave/build-oo && make -j8
RUN cd octave/build-oo && make install
