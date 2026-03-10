using Toybox.WatchUi;
using Toybox.Lang;

class SessionDelegate extends WatchUi.BehaviorDelegate {
    var _leagueSlug as Lang.String;

    function initialize(leagueSlug as Lang.String) {
        BehaviorDelegate.initialize();
        _leagueSlug = leagueSlug;
    }

    function onSelect() as Lang.Boolean {
        var view = WatchUi.getCurrentView()[0];
        if (!(view instanceof SessionView)) { return false; }

        var sessionView = view as SessionView;
        var state = sessionView.getState();
        if (state == null) { return false; }

        if (state.equals("proposed_lineup")) {
            showLineupMenu();
            return true;
        } else if (state.equals("match_in_progress")) {
            openScoreEntry(sessionView);
            return true;
        } else if (state.equals("coin_toss_pending")) {
            openCoinToss(sessionView);
            return true;
        }

        return false;
    }

    function showLineupMenu() as Void {
        var menu = new WatchUi.Menu2({:title => "Options"});
        menu.addItem(new WatchUi.MenuItem("Start Match", null, "start", {}));
        menu.addItem(new WatchUi.MenuItem("Shuffle Teams", null, "shuffle", {}));
        WatchUi.pushView(menu, new LineupMenuDelegate(_leagueSlug), WatchUi.SLIDE_LEFT);
    }

    function openScoreEntry(sessionView as SessionView) as Void {
        var sessionData = sessionView._sessionData;
        if (sessionData == null) { return; }
        var match = sessionData["currentMatch"] as Lang.Dictionary?;
        if (match == null) { return; }

        var home = match["home"] as Lang.Array;
        var away = match["away"] as Lang.Array;
        var homeScore = match["homeScore"] as Lang.Number;
        var awayScore = match["awayScore"] as Lang.Number;

        WatchUi.pushView(
            new ScoreEntryView(_leagueSlug, home, away, homeScore, awayScore),
            new ScoreEntryDelegate(_leagueSlug),
            WatchUi.SLIDE_LEFT
        );
    }

    function openCoinToss(sessionView as SessionView) as Void {
        var sessionData = sessionView._sessionData;
        if (sessionData == null) { return; }
        var coinToss = sessionData["pendingCoinToss"] as Lang.Dictionary?;
        if (coinToss == null) { return; }

        var coinTossId = coinToss["id"] as Lang.String;
        var candidates = coinToss["candidates"] as Lang.Array;
        var conflictType = coinToss["conflictType"] as Lang.String;

        WatchUi.pushView(
            new CoinTossView(_leagueSlug, coinTossId, candidates, conflictType),
            new CoinTossDelegate(_leagueSlug, coinTossId, candidates),
            WatchUi.SLIDE_LEFT
        );
    }

    function onBack() as Lang.Boolean {
        WatchUi.popView(WatchUi.SLIDE_RIGHT);
        return true;
    }

    function onNextPage() as Lang.Boolean {
        var view = WatchUi.getCurrentView()[0];
        if (!(view instanceof SessionView)) { return false; }
        var sessionView = view as SessionView;
        sessionView.scrollDown();
        WatchUi.requestUpdate();
        return true;
    }

    function onPreviousPage() as Lang.Boolean {
        var view = WatchUi.getCurrentView()[0];
        if (!(view instanceof SessionView)) { return false; }
        var sessionView = view as SessionView;
        sessionView.scrollUp();
        WatchUi.requestUpdate();
        return true;
    }
}

class LineupMenuDelegate extends WatchUi.Menu2InputDelegate {
    var _leagueSlug as Lang.String;

    function initialize(leagueSlug as Lang.String) {
        Menu2InputDelegate.initialize();
        _leagueSlug = leagueSlug;
    }

    function onSelect(item as WatchUi.MenuItem) as Void {
        var action = item.getId() as Lang.String;
        if (action.equals("start")) {
            startMatch();
        } else if (action.equals("shuffle")) {
            shuffleLineup();
        }
        WatchUi.popView(WatchUi.SLIDE_RIGHT);
    }

    function onBack() as Void {
        WatchUi.popView(WatchUi.SLIDE_RIGHT);
    }

    function startMatch() as Void {
        ApiClient.post(
            "/leagues/" + _leagueSlug + "/session/start-match",
            {},
            method(:onStartMatchResponse)
        );
    }

    function onStartMatchResponse(responseCode as Lang.Number, data as Lang.Object or Null) as Void {
        if (responseCode == 200) {
            var view = WatchUi.getCurrentView()[0];
            if (view instanceof SessionView) {
                (view as SessionView).fetchSession();
            }
        }
    }

    function shuffleLineup() as Void {
        var view = WatchUi.getCurrentView()[0];
        if (view instanceof SessionView) {
            var sessionView = view as SessionView;
            sessionView._shuffling = true;
            WatchUi.requestUpdate();
        }
        ApiClient.post(
            "/leagues/" + _leagueSlug + "/session/shuffle-lineup",
            {},
            method(:onShuffleResponse)
        );
    }

    function onShuffleResponse(responseCode as Lang.Number, data as Lang.Object or Null) as Void {
        if (responseCode == 200) {
            var view = WatchUi.getCurrentView()[0];
            if (view instanceof SessionView) {
                (view as SessionView).fetchSession();
            }
        }
    }
}
