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

RUN yum install -y \
	json-c-devel \
	libuv-devel

# Copy and compile host.c
# Note: path is relative to repository root
COPY back-octave back-octave
RUN cd back-octave && make && make install

# Apply patches

### 4.0.1-rc1 ###
# RUN cd octave && \
# 	hg update 323e92c4589f && \
# 	hg import ../back-octave/oo-changesets/001-d38b7c534496.hg.txt && \
# 	hg import ../back-octave/oo-changesets/002-d3de6023e846.hg.txt && \
# 	hg import ../back-octave/oo-changesets/003-4d28376c34a8.hg.txt && \
# 	hg import ../back-octave/oo-changesets/004-6ff3e34eea77.hg.txt && \
# 	hg import ../back-octave/oo-changesets/005-9e73fe0d92d5.hg.txt && \
# 	hg import ../back-octave/oo-changesets/006-15d21ceec728.hg.txt && \
# 	hg import ../back-octave/oo-changesets/007-4d778d6ebbd0.hg.txt && \
# 	hg import ../back-octave/oo-changesets/008-e8ef7f3333bf.hg.txt && \
# 	hg import ../back-octave/oo-changesets/009-05f7272c001e.hg.txt && \
# 	hg import ../back-octave/oo-changesets/010-4a1afb661c55.hg.txt && \
# 	hg import ../back-octave/oo-changesets/011-7327936fa23e.hg.txt && \
# 	hg import ../back-octave/oo-changesets/012-84390db50239.hg.txt && \
# 	hg import ../back-octave/oo-changesets/013-f4110d638cdb.hg.txt && \
# 	hg import ../back-octave/oo-changesets/014-21fd506b7530.hg.txt

### 4.2.1 ###
# RUN cd octave && \
# 	hg import ../back-octave/oo-changesets/100-2d1fd5fdd1d5.hg.txt && \
# 	hg import ../back-octave/oo-changesets/101-bc8cd93feec5.hg.txt && \
# 	hg import ../back-octave/oo-changesets/102-30d8ba0fbc32.hg.txt && \
# 	hg import ../back-octave/oo-changesets/103-352b599bc533.hg.txt && \
# 	hg import ../back-octave/oo-changesets/104-9475120a3110.hg.txt && \
# 	hg import ../back-octave/oo-changesets/105-ccbef5c9b050.hg.txt && \
# 	hg import ../back-octave/oo-changesets/106-91cb270ffac0.hg.txt && \
# 	hg import ../back-octave/oo-changesets/107-80081f9d8ff7.hg.txt && \
# 	hg import ../back-octave/oo-changesets/108-9b39ca8bcbfd.hg.txt

### 5.2 ###
# RUN cd octave && \
# 	hg import ../back-octave/oo-changesets/200-84cbf166497f.hg.txt && \
# 	hg import ../back-octave/oo-changesets/201-b993253f19d0.hg.txt && \
# 	hg import ../back-octave/oo-changesets/202-d9d23f97ba78.hg.txt && \
# 	hg import ../back-octave/oo-changesets/203-d6b5ffb8e4cc.hg.txt && \
# 	hg import ../back-octave/oo-changesets/204-e61d7b8918e2.hg.txt

### 6.0.1 (based on 9e7b2625e574) ###
# RUN cd octave && \
# 	hg import ../back-octave/oo-changesets/300-d78448f9c483.hg.txt && \
# 	hg import ../back-octave/oo-changesets/301-97f7d1f4fe83.hg.txt && \
# 	hg import ../back-octave/oo-changesets/302-8900d7cf8554.hg.txt

### 6.0.1 (based on 171a2857d6d1) ###
# RUN cd octave && \
# 	hg import ../back-octave/oo-changesets/310-1e1c91e6cddc.hg.txt

### 6.4.0 (based on 8d7671609955) ###
RUN cd octave && \
	hg import ../back-octave/oo-changesets/320-8d4683a83238.hg.txt && \
	hg import ../back-octave/oo-changesets/321-faad58416a3a.hg.txt

### 7.0.1 (based on 117ebe363f56) ###
# RUN cd octave && \
# 	hg import ../back-octave/oo-changesets/400-7ade2492e023.hg.txt && \
# 	hg import ../back-octave/oo-changesets/401-1b33dc797ec9.hg.txt && \
# 	hg import ../back-octave/oo-changesets/402-b01fa2864d4d.hg.txt && \
# 	hg import ../back-octave/oo-changesets/403-2813cb96e10f.hg.txt && \
# 	hg import ../back-octave/oo-changesets/404-acb523f25bb9.hg.txt && \
# 	hg import ../back-octave/oo-changesets/405-6ad34b0b69e1.hg.txt && \
# 	hg import ../back-octave/oo-changesets/406-d0df6f16f41e.hg.txt && \
# 	hg import ../back-octave/oo-changesets/407-df206dd11399.hg.txt && \
# 	hg import ../back-octave/oo-changesets/408-8184a51579f3.hg.txt

# Re-build with patches
RUN cd octave/build-oo && make -j8
RUN cd octave/build-oo && make install

# Monkey-patch bug #42352
# https://savannah.gnu.org/bugs/?42352
# RUN touch /usr/local/share/octave/4.2.1/etc/macros.texi

# # Monkey-patch json-c runtime errors
# ENV LD_LIBRARY_PATH /usr/local/lib

# Install site octaverc.m (formerly part of "install-site-m" in Makefile)
COPY containers/octave-pkg/octaverc.m /usr/local/share/octave/site/m/startup/octaverc

# Install the java.opts file
COPY containers/octave-oo/java.opts /usr/local/share/octave/6.4.0/m/java/java.opts
