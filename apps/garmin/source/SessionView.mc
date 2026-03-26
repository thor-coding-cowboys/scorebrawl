using Toybox.WatchUi;
using Toybox.Graphics;
using Toybox.Timer;
using Toybox.Lang;

class SessionView extends WatchUi.View {
    var _leagueSlug as Lang.String;
    var _timer as Timer.Timer?;
    var _sessionData as Lang.Dictionary?;
    var _loading as Lang.Boolean = true;
    var _error as Lang.String?;
    var _scrollOffset as Lang.Number = 0;
    var _shuffling as Lang.Boolean = false;

    function initialize(leagueSlug as Lang.String) {
        View.initialize();
        _leagueSlug = leagueSlug;
    }

    function onShow() as Void {
        fetchSession();
        _timer = new Timer.Timer();
        _timer.start(method(:fetchSession), 10000, true);
    }

    function onHide() as Void {
        stopTimer();
    }

    function stopTimer() as Void {
        if (_timer != null) {
            _timer.stop();
            _timer = null;
        }
    }

    function fetchSession() as Void {
        ApiClient.get(
            "/leagues/" + _leagueSlug + "/session/active",
            method(:onSessionResponse)
        );
    }

    function onSessionResponse(responseCode as Lang.Number, data as Lang.Object or Null) as Void {
        _loading = false;
        _shuffling = false;
        if (responseCode == 200 && data instanceof Lang.Dictionary) {
            _sessionData = (data as Lang.Dictionary)["session"] as Lang.Dictionary?;
            _error = null;
        } else if (responseCode < 0) {
            _error = "Connect phone";
        } else if (responseCode == 401) {
            _error = "Invalid API key";
        } else {
            _error = "Error: " + responseCode;
        }
        WatchUi.requestUpdate();
    }

    function getState() as Lang.String? {
        if (_sessionData == null) { return null; }
        return _sessionData["state"] as Lang.String?;
    }

    function scrollUp() as Void {
        _scrollOffset = _scrollOffset - 40;
        if (_scrollOffset < 0) {
            _scrollOffset = 0;
        }
    }

    function scrollDown() as Void {
        _scrollOffset = _scrollOffset + 40;
    }

    function onUpdate(dc as Graphics.Dc) as Void {
        dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_BLACK);
        dc.clear();

        if (_loading) {
            drawCentered(dc, "Loading...");
            return;
        }

        if (_shuffling) {
            drawCentered(dc, "Shuffling...");
            return;
        }

        if (_error != null) {
            drawCentered(dc, _error as Lang.String);
            return;
        }

        if (_sessionData == null) {
            drawCentered(dc, "No active session");
            return;
        }

        var state = getState();
        var w = dc.getWidth();
        var h = dc.getHeight();
        var cx = w / 2;

        if (state != null && state.equals("match_in_progress")) {
            drawMatchInProgress(dc, cx, h);
        } else if (state != null && state.equals("coin_toss_pending")) {
            drawCoinTossPending(dc, cx, h);
        } else {
            drawProposedLineup(dc, cx, h);
        }
    }

    function drawMatchInProgress(dc as Graphics.Dc, cx as Lang.Number, h as Lang.Number) as Void {
        var match = _sessionData["currentMatch"] as Lang.Dictionary;
        var matchNum = match["matchNumber"] as Lang.Number;
        var home = match["home"] as Lang.Array;
        var away = match["away"] as Lang.Array;
        var homeScore = match["homeScore"] as Lang.Number;
        var awayScore = match["awayScore"] as Lang.Number;

        dc.setColor(Graphics.COLOR_BLUE, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, h * 6 / 100, Graphics.FONT_TINY, "Match #" + matchNum, Graphics.TEXT_JUSTIFY_CENTER);

        dc.setColor(Graphics.COLOR_GREEN, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, h * 14 / 100, Graphics.FONT_LARGE, homeScore + " - " + awayScore, Graphics.TEXT_JUSTIFY_CENTER);

        var needsScroll = home.size() >= 4 || away.size() >= 4;

        if (needsScroll) {
            var totalHeight = calculateTotalContentHeight(home, away);
            var contentStartY = h * 26 / 100;
            var contentEndY = h * 78 / 100;
            var maxContentHeight = contentEndY - contentStartY;
            var maxOffset = totalHeight - maxContentHeight;

            if (_scrollOffset > maxOffset) {
                _scrollOffset = maxOffset;
            }
            if (_scrollOffset < 0) {
                _scrollOffset = 0;
            }

            if (_scrollOffset > 0) {
                dc.setColor(Graphics.COLOR_DK_GRAY, Graphics.COLOR_TRANSPARENT);
                dc.drawText(cx, contentStartY - 8, Graphics.FONT_XTINY, "^", Graphics.TEXT_JUSTIFY_CENTER);
            }
            if (_scrollOffset < maxOffset) {
                dc.setColor(Graphics.COLOR_DK_GRAY, Graphics.COLOR_TRANSPARENT);
                dc.drawText(cx, contentEndY + 2, Graphics.FONT_XTINY, "v", Graphics.TEXT_JUSTIFY_CENTER);
            }

            var clipY = contentStartY;
            var clipHeight = maxContentHeight;

            dc.setColor(Graphics.COLOR_YELLOW, Graphics.COLOR_TRANSPARENT);
            var homeLabelY = contentStartY - _scrollOffset;
            if (homeLabelY + 20 > clipY && homeLabelY < clipY + clipHeight) {
                dc.drawText(cx, homeLabelY, Graphics.FONT_XTINY, "Home", Graphics.TEXT_JUSTIFY_CENTER);
            }

            var homeListY = homeLabelY + 30;
            drawPlayerListVerticalClipped(dc, cx, homeListY, home, clipY, clipHeight);

            var awayLabelY = homeListY + (home.size() * 28) + 14;
            if (awayLabelY + 20 > clipY && awayLabelY < clipY + clipHeight) {
                dc.setColor(Graphics.COLOR_YELLOW, Graphics.COLOR_TRANSPARENT);
                dc.drawText(cx, awayLabelY, Graphics.FONT_XTINY, "Away", Graphics.TEXT_JUSTIFY_CENTER);
            }

            var awayListY = awayLabelY + 30;
            drawPlayerListVerticalClipped(dc, cx, awayListY, away, clipY, clipHeight);
        } else {
            _scrollOffset = 0;
            var currentY = h * 28 / 100;

            dc.setColor(Graphics.COLOR_YELLOW, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, currentY, Graphics.FONT_XTINY, "Home", Graphics.TEXT_JUSTIFY_CENTER);
            currentY = currentY + 30;

            currentY = drawPlayerListVertical(dc, cx, currentY, home);

            currentY = currentY + 14;

            dc.setColor(Graphics.COLOR_YELLOW, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, currentY, Graphics.FONT_XTINY, "Away", Graphics.TEXT_JUSTIFY_CENTER);
            currentY = currentY + 30;

            currentY = drawPlayerListVertical(dc, cx, currentY, away);
        }

        dc.setColor(Graphics.COLOR_GREEN, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, h * 86 / 100, Graphics.FONT_XTINY, "SEL = Enter Score", Graphics.TEXT_JUSTIFY_CENTER);
    }

    function calculateTotalContentHeight(home as Lang.Array, away as Lang.Array) as Lang.Number {
        var height = 0;
        height = height + 20;
        height = height + 30;
        height = height + (home.size() * 28);
        height = height + 14;
        height = height + 20;
        height = height + 30;
        height = height + (away.size() * 28);
        return height;
    }

    function drawPlayerListVerticalClipped(dc as Graphics.Dc, cx as Lang.Number, startY as Lang.Number, players as Lang.Array, clipY as Lang.Number, clipHeight as Lang.Number) as Void {
        dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
        var currentY = startY;
        for (var i = 0; i < players.size(); i++) {
            if (currentY + 20 > clipY && currentY < clipY + clipHeight) {
                var p = players[i] as Lang.Dictionary;
                var name = p["name"] as Lang.String;
                var formattedName = formatPlayerName(name);
                var displayName = truncateName(formattedName, 18);
                dc.drawText(cx, currentY, Graphics.FONT_XTINY, displayName, Graphics.TEXT_JUSTIFY_CENTER);
            }
            currentY = currentY + 28;
        }
    }

    function drawPlayerListVertical(dc as Graphics.Dc, cx as Lang.Number, startY as Lang.Number, players as Lang.Array) as Lang.Number {
        dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
        var currentY = startY;
        for (var i = 0; i < players.size(); i++) {
            var p = players[i] as Lang.Dictionary;
            var name = p["name"] as Lang.String;
            var formattedName = formatPlayerName(name);
            var displayName = truncateName(formattedName, 18);
            dc.drawText(cx, currentY, Graphics.FONT_XTINY, displayName, Graphics.TEXT_JUSTIFY_CENTER);
            currentY = currentY + 28;
        }
        return currentY;
    }

    function formatPlayerName(name as Lang.String) as Lang.String {
        var parts = [] as Lang.Array<Lang.String>;
        var currentPart = "";
        for (var i = 0; i < name.length(); i++) {
            var char = name.substring(i, i + 1);
            if (char.equals(" ")) {
                if (currentPart.length() > 0) {
                    parts.add(currentPart);
                    currentPart = "";
                }
            } else {
                currentPart = currentPart + char;
            }
        }
        if (currentPart.length() > 0) {
            parts.add(currentPart);
        }

        if (parts.size() >= 3) {
            var result = parts[0];
            for (var j = 1; j < parts.size() - 1; j++) {
                var middle = parts[j];
                if (middle.length() > 0) {
                    result = result + " " + middle.substring(0, 1) + ".";
                }
            }
            var last = parts[parts.size() - 1];
            result = result + " " + last;
            return result;
        }

        return name;
    }

    function truncateName(name as Lang.String, maxLen as Lang.Number) as Lang.String {
        if (name.length() <= maxLen) {
            return name;
        }
        return name.substring(0, maxLen - 2) + "..";
    }

    function drawProposedLineup(dc as Graphics.Dc, cx as Lang.Number, h as Lang.Number) as Void {
        var lineup = _sessionData["proposedLineup"] as Lang.Dictionary?;
        if (lineup == null) {
            drawCentered(dc, "Waiting...");
            return;
        }

        var home = lineup["home"] as Lang.Array;
        var away = lineup["away"] as Lang.Array;
        var matchCount = _sessionData["matchCount"] as Lang.Number;

        dc.setColor(Graphics.COLOR_BLUE, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, h * 6 / 100, Graphics.FONT_TINY, "Match #" + (matchCount + 1), Graphics.TEXT_JUSTIFY_CENTER);

        var needsScroll = home.size() >= 4 || away.size() >= 4;

        if (needsScroll) {
            var totalHeight = calculateTotalContentHeight(home, away);
            var contentStartY = h * 18 / 100;
            var contentEndY = h * 78 / 100;
            var maxContentHeight = contentEndY - contentStartY;
            var maxOffset = totalHeight - maxContentHeight;

            if (_scrollOffset > maxOffset) {
                _scrollOffset = maxOffset;
            }
            if (_scrollOffset < 0) {
                _scrollOffset = 0;
            }

            if (_scrollOffset > 0) {
                dc.setColor(Graphics.COLOR_DK_GRAY, Graphics.COLOR_TRANSPARENT);
                dc.drawText(cx, contentStartY - 8, Graphics.FONT_XTINY, "^", Graphics.TEXT_JUSTIFY_CENTER);
            }
            if (_scrollOffset < maxOffset) {
                dc.setColor(Graphics.COLOR_DK_GRAY, Graphics.COLOR_TRANSPARENT);
                dc.drawText(cx, contentEndY + 2, Graphics.FONT_XTINY, "v", Graphics.TEXT_JUSTIFY_CENTER);
            }

            var clipY = contentStartY;
            var clipHeight = maxContentHeight;

            dc.setColor(Graphics.COLOR_YELLOW, Graphics.COLOR_TRANSPARENT);
            var homeLabelY = contentStartY - _scrollOffset;
            if (homeLabelY + 20 > clipY && homeLabelY < clipY + clipHeight) {
                dc.drawText(cx, homeLabelY, Graphics.FONT_XTINY, "Home", Graphics.TEXT_JUSTIFY_CENTER);
            }

            var homeListY = homeLabelY + 30;
            drawPlayerListVerticalClipped(dc, cx, homeListY, home, clipY, clipHeight);

            var awayLabelY = homeListY + (home.size() * 28) + 14;
            if (awayLabelY + 20 > clipY && awayLabelY < clipY + clipHeight) {
                dc.setColor(Graphics.COLOR_YELLOW, Graphics.COLOR_TRANSPARENT);
                dc.drawText(cx, awayLabelY, Graphics.FONT_XTINY, "Away", Graphics.TEXT_JUSTIFY_CENTER);
            }

            var awayListY = awayLabelY + 30;
            drawPlayerListVerticalClipped(dc, cx, awayListY, away, clipY, clipHeight);
        } else {
            _scrollOffset = 0;
            var currentY = h * 20 / 100;

            dc.setColor(Graphics.COLOR_YELLOW, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, currentY, Graphics.FONT_XTINY, "Home", Graphics.TEXT_JUSTIFY_CENTER);
            currentY = currentY + 30;

            currentY = drawPlayerListVertical(dc, cx, currentY, home);

            currentY = currentY + 14;

            dc.setColor(Graphics.COLOR_YELLOW, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, currentY, Graphics.FONT_XTINY, "Away", Graphics.TEXT_JUSTIFY_CENTER);
            currentY = currentY + 30;

            currentY = drawPlayerListVertical(dc, cx, currentY, away);
        }

        dc.setColor(Graphics.COLOR_GREEN, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, h * 86 / 100, Graphics.FONT_XTINY, "SEL = Options", Graphics.TEXT_JUSTIFY_CENTER);
    }

    function drawCoinTossPending(dc as Graphics.Dc, cx as Lang.Number, h as Lang.Number) as Void {
        var coinToss = _sessionData["pendingCoinToss"] as Lang.Dictionary;
        var candidates = coinToss["candidates"] as Lang.Array;

        dc.setColor(Graphics.COLOR_YELLOW, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, h * 6 / 100, Graphics.FONT_TINY, "Coin Toss", Graphics.TEXT_JUSTIFY_CENTER);

        dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, h * 14 / 100, Graphics.FONT_TINY, "Pick who stays:", Graphics.TEXT_JUSTIFY_CENTER);

        drawPlayerListVertical(dc, cx, h * 22 / 100, candidates);

        dc.setColor(Graphics.COLOR_GREEN, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, h * 88 / 100, Graphics.FONT_XTINY, "SEL = Pick Winner", Graphics.TEXT_JUSTIFY_CENTER);
    }

    function drawCentered(dc as Graphics.Dc, msg as Lang.String) as Void {
        dc.drawText(
            dc.getWidth() / 2,
            dc.getHeight() / 2,
            Graphics.FONT_SMALL,
            msg,
            Graphics.TEXT_JUSTIFY_CENTER | Graphics.TEXT_JUSTIFY_VCENTER
        );
    }
}
