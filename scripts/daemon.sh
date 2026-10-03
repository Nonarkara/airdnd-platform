#!/bin/bash
# Retired. The workers now run under launchd, generated for whichever Mac
# this is: npm run ops:install (status: npm run ops:status).
#
# This loop ran the collector outside any single-instance guard; a copy left
# running in tmux next to the launchd worker put two clients on one Telegram
# session, which revokes it (AUTH_KEY_DUPLICATED). Exiting here also stops an
# old machine that still has the com.sabai.scraper job from collecting once it
# pulls this version.
echo "[$(date)] scripts/daemon.sh is retired — run: npm run ops:install" >&2
exit 0
