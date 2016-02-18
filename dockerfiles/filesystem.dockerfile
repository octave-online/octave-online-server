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
