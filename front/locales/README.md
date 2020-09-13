Octave Online Localization
==========================

Octave Online Server supports the localization of UI strings.

The source language is English, and the strings are stored in *en.yaml* using the i18next JSON format.  Additional translations should be submitted to the oos-translations project:

https://github.com/octave-online/oos-translations

When new strings are added to *en.yaml*, a corresponding description should be added to *qqq.yaml* to help translators produce more accurate translations.

Use the config options *front.locales_path* and *front.locales* to set an alternate load path for the localization files.
