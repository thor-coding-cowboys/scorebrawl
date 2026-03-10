using Toybox.WatchUi;
using Toybox.Graphics;
using Toybox.Lang;

class CoinTossView extends WatchUi.View {
    var _leagueSlug as Lang.String;
    var _coinTossId as Lang.String;
    var _candidates as Lang.Array;
    var _conflictType as Lang.String;

    function initialize(leagueSlug as Lang.String, coinTossId as Lang.String, candidates as Lang.Array, conflictType as Lang.String) {
        View.initialize();
        _leagueSlug = leagueSlug;
        _coinTossId = coinTossId;
        _candidates = candidates;
        _conflictType = conflictType;
    }

    function onShow() as Void {
        showCandidateMenu();
    }

    function showCandidateMenu() as Void {
        var title = "Pick Winner";
        var menu = new WatchUi.Menu2({:title => title});

        for (var i = 0; i < _candidates.size(); i++) {
            var candidate = _candidates[i] as Lang.Dictionary;
            var name = candidate["name"] as Lang.String;
            var id = candidate["sessionPlayerId"] as Lang.String;
            menu.addItem(new WatchUi.MenuItem(name, null, id, {}));
        }

        WatchUi.switchToView(menu,
            new CoinTossMenuDelegate(_leagueSlug, _coinTossId),
            WatchUi.SLIDE_IMMEDIATE
        );
    }

    function onUpdate(dc as Graphics.Dc) as Void {
        dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_BLACK);
        dc.clear();
        dc.drawText(
            dc.getWidth() / 2,
            dc.getHeight() / 2,
            Graphics.FONT_SMALL,
            "Loading...",
            Graphics.TEXT_JUSTIFY_CENTER | Graphics.TEXT_JUSTIFY_VCENTER
        );
    }
}
