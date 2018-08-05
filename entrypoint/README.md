Octave Online Server: Back Server Entrypoint Scripts
====================================================

This directory contains scripts used for actually running the back server.  **These scripts are primarilly intended for use with the SELinux implementation.**

*back-selinux.js* sets up log files and runs the *back-master* project.  This script is useful when running Octave Online Server as a service.  If debugging Octave Online Server, you should run *back-master* directory.

*oo-install-host.service* is a SystemCTL service that installs the latest version of the GNU Octave Host file (see the *back-octave* directory) to the local instance.  It will update the host file every time the machine is booted.  This is useful to help release updates to the host file and make sure that all instances are using up-to-date versions.

*oo.service* is the main SystemCTL service used in the SELinux implementation.  It runs *back-selinux.js* at startup.

*oo_utils_auth.service* is a SystemCTL service that runs the *utils-auth* project.  For more information, see that project directory.
