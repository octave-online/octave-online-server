This is the source code for the Octave Online back server.

It is licensed under AGPL v3.

If using RHEL, the line "Defaults requiretty" must be commented out.

Remember to update /usr/bin/sandbox according to https://github.com/SELinuxProject/selinux/commit/0f4620d6111838ce78bf5a591bb80c99c9d88730

FIXME: known bug: arbitrary binary output created by the Octave process fails (generates JSON parse error)
