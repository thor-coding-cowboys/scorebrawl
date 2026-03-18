using Toybox.WatchUi;
using Toybox.Graphics;
using Toybox.Timer;
using Toybox.Time;
using Toybox.Lang;

class ScoreEntryView extends WatchUi.View {
    var _leagueSlug as Lang.String;
    var _homeInitials as Lang.String;
    var _awayInitials as Lang.String;
    var _homeScore as Lang.Number;
    var _awayScore as Lang.Number;
    var _activeField as Lang.Number = 0;
    var _confirming as Lang.Boolean = false;
    var _submitting as Lang.Boolean = false;
    var _error as Lang.String? = null;

    function initialize(leagueSlug as Lang.String, homePlayers as Lang.Array, awayPlayers as Lang.Array, homeScore as Lang.Number, awayScore as Lang.Number) {
        View.initialize();
        _leagueSlug = leagueSlug;
        _homeInitials = getInitials(homePlayers);
        _awayInitials = getInitials(awayPlayers);
        _homeScore = homeScore;
        _awayScore = awayScore;
    }

    function getInitials(players as Lang.Array) as Lang.String {
        var initials = "";
        for (var i = 0; i < players.size(); i++) {
            var p = players[i] as Lang.Dictionary;
            var name = p["name"] as Lang.String;
            if (name.length() > 0) {
                if (initials.length() > 0) {
                    initials = initials + "/";
                }
                initials = initials + name.substring(0, 1);
            }
        }
        return initials;
    }

    function onUpdate(dc as Graphics.Dc) as Void {
        dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_BLACK);
        dc.clear();

        var w = dc.getWidth();
        var h = dc.getHeight();
        var cx = w / 2;

        if (_submitting) {
            dc.drawText(cx, h / 2, Graphics.FONT_SMALL, "Recording...",
                Graphics.TEXT_JUSTIFY_CENTER | Graphics.TEXT_JUSTIFY_VCENTER);
            return;
        }

        if (_error != null) {
            dc.setColor(Graphics.COLOR_RED, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h * 35 / 100, Graphics.FONT_TINY, _error as Lang.String,
                Graphics.TEXT_JUSTIFY_CENTER);
            dc.setColor(Graphics.COLOR_DK_GRAY, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h * 60 / 100, Graphics.FONT_XTINY, "BACK to retry",
                Graphics.TEXT_JUSTIFY_CENTER);
            return;
        }

        if (_confirming) {
            dc.setColor(Graphics.COLOR_YELLOW, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h * 6 / 100, Graphics.FONT_TINY, "Confirm?", Graphics.TEXT_JUSTIFY_CENTER);

            dc.setColor(Graphics.COLOR_YELLOW, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx - 40, h * 18 / 100, Graphics.FONT_TINY, "Home", Graphics.TEXT_JUSTIFY_RIGHT);
            dc.drawText(cx + 40, h * 18 / 100, Graphics.FONT_TINY, "Away", Graphics.TEXT_JUSTIFY_LEFT);

            dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx - 40, h * 26 / 100, Graphics.FONT_TINY, _homeInitials, Graphics.TEXT_JUSTIFY_RIGHT);
            dc.drawText(cx + 40, h * 26 / 100, Graphics.FONT_TINY, _awayInitials, Graphics.TEXT_JUSTIFY_LEFT);

            dc.setColor(Graphics.COLOR_GREEN, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx - 40, h * 40 / 100, Graphics.FONT_NUMBER_HOT, _homeScore.toString(), Graphics.TEXT_JUSTIFY_RIGHT);
            dc.drawText(cx + 40, h * 40 / 100, Graphics.FONT_NUMBER_HOT, _awayScore.toString(), Graphics.TEXT_JUSTIFY_LEFT);

            dc.setColor(Graphics.COLOR_GREEN, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h * 76 / 100, Graphics.FONT_XTINY, "SEL = Submit", Graphics.TEXT_JUSTIFY_CENTER);
            dc.setColor(Graphics.COLOR_RED, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h * 88 / 100, Graphics.FONT_XTINY, "BACK = Edit", Graphics.TEXT_JUSTIFY_CENTER);
            return;
        }

        dc.setColor(Graphics.COLOR_BLUE, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, h * 4 / 100, Graphics.FONT_TINY, "Record Score", Graphics.TEXT_JUSTIFY_CENTER);

        dc.setColor(Graphics.COLOR_YELLOW, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx - 40, h * 14 / 100, Graphics.FONT_TINY, "Home", Graphics.TEXT_JUSTIFY_RIGHT);
        dc.drawText(cx + 40, h * 14 / 100, Graphics.FONT_TINY, "Away", Graphics.TEXT_JUSTIFY_LEFT);

        var homeColor = _activeField == 0 ? Graphics.COLOR_GREEN : Graphics.COLOR_WHITE;
        dc.setColor(homeColor, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx - 40, h * 22 / 100, Graphics.FONT_TINY, _homeInitials, Graphics.TEXT_JUSTIFY_RIGHT);
        dc.drawText(cx - 40, h * 36 / 100, Graphics.FONT_NUMBER_HOT, _homeScore.toString(), Graphics.TEXT_JUSTIFY_RIGHT);

        var awayColor = _activeField == 1 ? Graphics.COLOR_GREEN : Graphics.COLOR_WHITE;
        dc.setColor(awayColor, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx + 40, h * 22 / 100, Graphics.FONT_TINY, _awayInitials, Graphics.TEXT_JUSTIFY_LEFT);
        dc.drawText(cx + 40, h * 36 / 100, Graphics.FONT_NUMBER_HOT, _awayScore.toString(), Graphics.TEXT_JUSTIFY_LEFT);

        dc.setColor(Graphics.COLOR_DK_GRAY, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, h * 76 / 100, Graphics.FONT_XTINY, "UP/DOWN +/- | SEL = next", Graphics.TEXT_JUSTIFY_CENTER);
    }
}
