using Toybox.WatchUi;
using Toybox.Lang;

class CoinTossDelegate extends WatchUi.BehaviorDelegate {
    var _leagueSlug as Lang.String;
    var _coinTossId as Lang.String;
    var _candidates as Lang.Array;

    function initialize(leagueSlug as Lang.String, coinTossId as Lang.String, candidates as Lang.Array) {
        BehaviorDelegate.initialize();
        _leagueSlug = leagueSlug;
        _coinTossId = coinTossId;
        _candidates = candidates;
    }

    function onBack() as Lang.Boolean {
        WatchUi.popView(WatchUi.SLIDE_RIGHT);
        return true;
    }
}

class CoinTossMenuDelegate extends WatchUi.Menu2InputDelegate {
    var _leagueSlug as Lang.String;
    var _coinTossId as Lang.String;

    function initialize(leagueSlug as Lang.String, coinTossId as Lang.String) {
        Menu2InputDelegate.initialize();
        _leagueSlug = leagueSlug;
        _coinTossId = coinTossId;
    }

    function onSelect(item as WatchUi.MenuItem) as Void {
        var winnerId = item.getId() as Lang.String;
        ApiClient.post(
            "/leagues/" + _leagueSlug + "/session/resolve-coin-toss",
            {
                "coinTossId" => _coinTossId,
                "winnerIds" => winnerId
            },
            method(:onResolveResponse)
        );
    }

    function onResolveResponse(responseCode as Lang.Number, data as Lang.Object or Null) as Void {
        if (responseCode == 200) {
            WatchUi.popView(WatchUi.SLIDE_RIGHT);
            var parentView = WatchUi.getCurrentView()[0];
            if (parentView instanceof SessionView) {
                (parentView as SessionView).fetchSession();
            }
        }
    }

    function onBack() as Void {
        WatchUi.popView(WatchUi.SLIDE_RIGHT);
    }
}
