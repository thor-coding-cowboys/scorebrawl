using Toybox.WatchUi;
using Toybox.Graphics;
using Toybox.Lang;

class LeaguePickerView extends WatchUi.View {
    var _leagues as Lang.Array?;
    var _loading as Lang.Boolean = true;
    var _error as Lang.String?;

    function initialize() {
        View.initialize();
    }

    function onShow() as Void {
        _loading = true;
        _error = null;
        ApiClient.get("/leagues", method(:onLeaguesResponse));
    }

    function onLeaguesResponse(responseCode as Lang.Number, data as Lang.Object or Null) as Void {
        _loading = false;
        if (responseCode == 200 && data instanceof Lang.Dictionary) {
            _leagues = (data as Lang.Dictionary)["leagues"] as Lang.Array?;
            if (_leagues != null && _leagues.size() > 0) {
                showLeagueMenu();
                return;
            }
            _error = "No leagues found";
        } else if (responseCode == 401) {
            _error = "Invalid API key";
        } else if (responseCode < 0) {
            _error = "No connection";
        } else {
            _error = "Error: " + responseCode;
        }
        WatchUi.requestUpdate();
    }

    function showLeagueMenu() as Void {
        var menu = new WatchUi.Menu2({:title => "Select League"});
        for (var i = 0; i < _leagues.size(); i++) {
            var league = _leagues[i] as Lang.Dictionary;
            var name = league["name"] as Lang.String;
            var slug = league["slug"] as Lang.String;
            menu.addItem(new WatchUi.MenuItem(name, null, slug, {}));
        }
        WatchUi.pushView(menu, new LeagueMenuDelegate(), WatchUi.SLIDE_IMMEDIATE);
    }

    function onUpdate(dc as Graphics.Dc) as Void {
        dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_BLACK);
        dc.clear();
        var msg = _loading ? "Loading..." : (_error != null ? _error : "");
        dc.drawText(
            dc.getWidth() / 2,
            dc.getHeight() / 2,
            Graphics.FONT_SMALL,
            msg as Lang.String,
            Graphics.TEXT_JUSTIFY_CENTER | Graphics.TEXT_JUSTIFY_VCENTER
        );
    }
}
