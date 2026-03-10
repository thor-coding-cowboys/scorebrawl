using Toybox.WatchUi;
using Toybox.System;
using Toybox.Lang;

class LeaguePickerDelegate extends WatchUi.BehaviorDelegate {
    function initialize() {
        BehaviorDelegate.initialize();
    }
}

class LeagueMenuDelegate extends WatchUi.Menu2InputDelegate {
    function initialize() {
        Menu2InputDelegate.initialize();
    }

    function onSelect(item as WatchUi.MenuItem) as Void {
        var slug = item.getId() as Lang.String;
        WatchUi.pushView(
            new SessionView(slug),
            new SessionDelegate(slug),
            WatchUi.SLIDE_LEFT
        );
    }

    function onBack() as Void {
        System.exit();
    }
}
