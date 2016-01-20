FROM centos:latest
ENV DIR /root
WORKDIR $DIR

# Install build dependencies for Octave
RUN yum install -y epel-release yum-utils
RUN yum-builddep -y octave
RUN yum install -y \
	mercurial \
	libtool \
	gcc-c++ \
	make \
	net-tools \
	traceroute \
	git \
	tar \
	lapack64-devel \
	librsvg2-tools \
	icoutils \
	transfig

# When building without --disable-docs, the following additional packages are required:
# texlive-collection-latexrecommended
# texlive-metapost

# Build and install libuv
RUN git clone https://github.com/libuv/libuv.git && \
	cd libuv && \
	sh autogen.sh && \
	./configure && \
	make && \
	make install

# Build and install json-c
RUN git clone https://github.com/json-c/json-c.git && \
	cd json-c && \
	sh autogen.sh && \
	./configure && \
	make && \
	make install

# Enlist the correct Octave revision
RUN hg clone http://www.octave.org/hg/octave
COPY oo-changesets.tar.gz $DIR/
RUN tar zxf oo-changesets.tar.gz && \
	cd octave && \
	hg update 323e92c4589f && \
	hg import ../oo-changesets/001-d38b7c534496.hg.txt && \
	hg import ../oo-changesets/002-d3de6023e846.hg.txt && \
	hg import ../oo-changesets/003-4d28376c34a8.hg.txt && \
	hg import ../oo-changesets/004-6ff3e34eea77.hg.txt && \
	hg import ../oo-changesets/005-9e73fe0d92d5.hg.txt && \
	hg import ../oo-changesets/006-15d21ceec728.hg.txt

# Configure and Build Octave
# This is the slowest part of the Dockerfile
RUN cd octave && \
	./bootstrap && \
	mkdir build-oo && \
	cd build-oo && \
	../configure --disable-readline --disable-gui --disable-docs
RUN cd octave/build-oo && make
RUN cd octave/build-oo && make install

# Monkey-patch bug #42352
# https://savannah.gnu.org/bugs/?42352
RUN touch /usr/local/share/octave/4.0.1-rc1/etc/macros.texi

# Monkey-patch json-c runtime errors
ENV LD_LIBRARY_PATH /usr/local/lib

# Install some popular Octave Forge packages.
# Note that installing sympy involves installing numpy as well, which is rather large, but it is required for the symbolic package, which is one of the most popular packages in Octave Online.
# Install 5 at a time so it's easier to recover from build errors.  If a package fails to install, try building the image again and it might work the second time.
# The packages with -noauto have functions that shadow core library functions, or are packages that are slow to load.
RUN yum install -y \
	units \
	mpfr-devel \
	portaudio-devel \
	sympy \
	patch
RUN octave -q --eval "\
	pkg install -forge -auto control; \
	pkg install -forge -auto signal; \
	pkg install -forge -auto struct; \
	pkg install -forge -auto optim; \
	pkg install -forge -auto io; "
RUN octave -q --eval "\
	pkg install -forge -auto image; \
	pkg install -forge -auto symbolic; \
	pkg install -forge -auto statistics; \
	pkg install -forge -auto general; \
	pkg install -forge -auto odepkg; "
RUN octave -q --eval "\
	pkg install -forge -auto linear-algebra; \
	pkg install -forge -auto communications; \
	pkg install -forge -auto geometry; \
	pkg install -forge -auto data-smoothing; \
	pkg install -forge -noauto tsa; "
RUN octave -q --eval "\
	pkg install -forge -auto financial; \
	pkg install -forge -auto miscellaneous; \
	pkg install -forge -auto interval; \
	pkg install -forge -noauto stk; \
	pkg install -forge -noauto ltfat; "
RUN octave -q --eval "\
	pkg install -forge -noauto nan; \
	pkg install -forge -auto fuzzy-logic-toolkit; \
	pkg install -forge -auto mechanics; "

# Copy placeholders
COPY placeholders /usr/local/share/octave/site/m/placeholders/

# Copy and compile host.c
RUN mkdir $DIR/host
COPY host.c Makefile $DIR/host/
RUN cd host && make && make install

# Cleanup
RUN rm -rf /root/* && \
	yum remove -y \
		mercurial \
		libtool \
		gcc-c++ \
		make \
		net-tools \
		traceroute \
		git \
		icoutils \
		transfig

# Entrypoint
WORKDIR /home/oo
ENV GNUTERM "svg"
# ENV GNUTERM "svg mouse jsdir '/js/gnuplot'"
ENTRYPOINT [ "/usr/local/bin/octave-host" ]
